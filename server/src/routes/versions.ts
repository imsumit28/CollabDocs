import { Router, Response } from 'express';
import { Version, CollabDocument } from '../models';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { getDocRoom } from '../socket/index';
import { plainTextFromState } from '../utils/yjsText';
import { isValidObjectId } from '../utils/validation';

const router = Router();
router.use(authMiddleware);

// Guard the id params so a malformed value doesn't throw an unhandled Mongoose
// CastError in these async handlers (Express 4 can't forward that to the error
// middleware, so the request would otherwise hang).
router.param('docId', (req, res, next, val) => {
  if (!isValidObjectId(val)) { res.status(400).json({ error: 'Invalid document id' }); return; }
  next();
});
router.param('id', (req, res, next, val) => {
  if (!isValidObjectId(val)) { res.status(400).json({ error: 'Invalid version id' }); return; }
  next();
});

// ─── List versions for a document ─────────────────────────────────────────────
router.get('/:docId', async (req: AuthRequest, res: Response) => {
  const { docId } = req.params;
  const doc = await CollabDocument.findById(docId);
  if (!doc) { res.status(404).json({ error: 'Document not found' }); return; }

  const isAuthorized =
    doc.ownerId.toString() === req.user!.sub ||
    doc.collaborators.some((c) => c.userId.toString() === req.user!.sub);
  if (!isAuthorized) { res.status(403).json({ error: 'Access denied' }); return; }

  const versions = await Version.find({ documentId: docId })
    .populate('savedBy', 'displayName avatarUrl')
    .sort({ createdAt: -1 })
    .lean();

  res.json(versions);
});

// ─── Save a version snapshot manually ────────────────────────────────────────
router.post('/:docId', async (req: AuthRequest, res: Response) => {
  const { docId } = req.params;
  const doc = await CollabDocument.findById(docId);
  if (!doc) { res.status(404).json({ error: 'Document not found' }); return; }

  const isEditor =
    doc.ownerId.toString() === req.user!.sub ||
    doc.collaborators.some((c) => c.userId.toString() === req.user!.sub && c.permission === 'edit');
  if (!isEditor) { res.status(403).json({ error: 'Edit permission required' }); return; }

  const snapshot = doc.yjsState;
  if (!snapshot) { res.status(400).json({ error: 'No document state to snapshot' }); return; }

  const now = new Date();
  const label = now.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const version = await Version.create({
    documentId: docId,
    yjsSnapshot: snapshot,
    savedBy: req.user!.sub,
    label,
  });

  res.status(201).json(version);
});

// ─── Restore a version ────────────────────────────────────────────────────────
router.post('/:id/restore', async (req: AuthRequest, res: Response) => {
  const version = await Version.findById(req.params.id);
  if (!version) { res.status(404).json({ error: 'Version not found' }); return; }

  const doc = await CollabDocument.findById(version.documentId);
  if (!doc) { res.status(404).json({ error: 'Document not found' }); return; }

  const isOwnerOrEditor =
    doc.ownerId.toString() === req.user!.sub ||
    doc.collaborators.some((c) => c.userId.toString() === req.user!.sub && c.permission === 'edit');
  if (!isOwnerOrEditor) { res.status(403).json({ error: 'Edit permission required' }); return; }

  doc.yjsState = version.yjsSnapshot;
  doc.contentText = plainTextFromState(version.yjsSnapshot);
  await doc.save();

  // Broadcast reset to all clients in the room
  const room = getDocRoom(doc.id);
  if (room) {
    room.io.to(doc.id).emit('yjs:reset', {
      state: Buffer.from(version.yjsSnapshot).toString('base64'),
    });
  }

  res.json({ message: 'Version restored', versionId: version.id });
});

export default router;
