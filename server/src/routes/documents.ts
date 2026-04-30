import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { CollabDocument } from '../models';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { Types } from 'mongoose';

const router = Router();
router.use(authMiddleware);

const TRASH_TTL_DAYS = 7;
const TRASH_TTL_MS   = TRASH_TTL_DAYS * 24 * 60 * 60 * 1000;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getUserPermission(doc: any, userId: string): 'owner' | 'edit' | 'view' | null {
  if (doc.ownerId.toString() === userId) return 'owner';
  const collab = doc.collaborators.find((c: any) => c.userId.toString() === userId);
  return collab?.permission ?? null;
}

// ─── Auto-purge cron (runs every hour) ────────────────────────────────────────
function startTrashPurge() {
  const purge = async () => {
    try {
      const cutoff = new Date(Date.now() - TRASH_TTL_MS);
      const result = await CollabDocument.deleteMany({
        deletedAt: { $ne: null, $lte: cutoff },
      });
      if (result.deletedCount > 0) {
        console.log(`🗑️  Purged ${result.deletedCount} expired trash document(s)`);
      }
    } catch (err) {
      console.error('Trash purge error:', err);
    }
  };
  purge(); // run immediately on startup
  setInterval(purge, 60 * 60 * 1000); // then every hour
}
startTrashPurge();

// ─── List active documents ────────────────────────────────────────────────────
router.get('/', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.sub;
  const docs = await CollabDocument.find({
    deletedAt: null,
    $or: [
      { ownerId: userId },
      { 'collaborators.userId': new Types.ObjectId(userId) },
    ],
  })
    .select('-yjsState')
    .sort({ updatedAt: -1 })
    .lean();

  res.json(docs);
});

// ─── List trash ───────────────────────────────────────────────────────────────
router.get('/trash', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.sub;
  const docs = await CollabDocument.find({
    deletedAt: { $ne: null },
    ownerId: userId,          // only owner can see their own trash
  })
    .select('-yjsState')
    .sort({ deletedAt: -1 })
    .lean();

  res.json(docs);
});

// ─── Create document ──────────────────────────────────────────────────────────
router.post('/', async (req: AuthRequest, res: Response) => {
  const { title = 'Untitled', template, content } = req.body;

  const doc = await CollabDocument.create({
    title: title || 'Untitled',
    ownerId: req.user!.sub,
    collaborators: [],
  });

  // If template content is provided, we'll pass it to the editor via response
  // The client will handle setting the initial content through the editor API
  res.status(201).json({
    ...doc.toObject(),
    templateContent: content, // Pass template content to client for initialization
  });
});

// ─── Share link resolution (no auth needed) ───────────────────────────────────
router.get('/shared/:token', async (req: AuthRequest, res: Response) => {
  const doc = await CollabDocument.findOne({ shareLink: req.params.token, deletedAt: null }).select('-yjsState');
  if (!doc) {
    res.status(404).json({ error: 'Share link not found' });
    return;
  }
  res.json({ document: doc, permission: doc.shareLinkPermission });
});

// ─── Restore from trash ───────────────────────────────────────────────────────
router.patch('/:id/restore', async (req: AuthRequest, res: Response) => {
  const doc = await CollabDocument.findById(req.params.id);
  if (!doc) { res.status(404).json({ error: 'Not found' }); return; }
  if (doc.ownerId.toString() !== req.user!.sub) { res.status(403).json({ error: 'Only owner can restore' }); return; }

  doc.deletedAt = null;
  await doc.save();
  res.json({ message: 'Document restored', document: doc });
});

// ─── Permanently delete (from trash) ─────────────────────────────────────────
router.delete('/:id/permanent', async (req: AuthRequest, res: Response) => {
  const doc = await CollabDocument.findById(req.params.id);
  if (!doc) { res.status(404).json({ error: 'Not found' }); return; }
  if (doc.ownerId.toString() !== req.user!.sub) { res.status(403).json({ error: 'Only owner can delete permanently' }); return; }

  await doc.deleteOne();
  res.json({ message: 'Document permanently deleted' });
});

// ─── Get single document ──────────────────────────────────────────────────────
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const doc = await CollabDocument.findById(req.params.id);
  if (!doc) { res.status(404).json({ error: 'Document not found' }); return; }

  const perm = getUserPermission(doc, req.user!.sub);
  if (!perm) { res.status(403).json({ error: 'Access denied' }); return; }

  res.json({ document: doc, permission: perm });
});

// ─── Update document title ────────────────────────────────────────────────────
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  const doc = await CollabDocument.findById(req.params.id);
  if (!doc) { res.status(404).json({ error: 'Not found' }); return; }

  const perm = getUserPermission(doc, req.user!.sub);
  if (!perm || perm === 'view') { res.status(403).json({ error: 'No edit permission' }); return; }

  if (req.body.title) doc.title = req.body.title;
  await doc.save();
  res.json(doc);
});

// ─── Soft delete (move to trash) ─────────────────────────────────────────────
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const doc = await CollabDocument.findById(req.params.id);
  if (!doc) { res.status(404).json({ error: 'Not found' }); return; }
  if (doc.ownerId.toString() !== req.user!.sub) { res.status(403).json({ error: 'Only owner can delete' }); return; }

  doc.deletedAt = new Date();
  await doc.save();
  res.json({ message: 'Document moved to trash' });
});

// ─── Share link ───────────────────────────────────────────────────────────────
router.post('/:id/share', async (req: AuthRequest, res: Response) => {
  const doc = await CollabDocument.findById(req.params.id);
  if (!doc) { res.status(404).json({ error: 'Not found' }); return; }
  if (doc.ownerId.toString() !== req.user!.sub) { res.status(403).json({ error: 'Only owner can share' }); return; }

  const { permission = 'view', disable } = req.body;

  if (disable) {
    doc.shareLink = null;
    doc.shareLinkPermission = null;
  } else {
    doc.shareLink = doc.shareLink || uuidv4();
    doc.shareLinkPermission = permission;
  }

  await doc.save();
  res.json({
    shareLink: doc.shareLink,
    shareLinkPermission: doc.shareLinkPermission,
    shareUrl: doc.shareLink ? `${process.env.CLIENT_URL}/doc/${doc.id}?share=${doc.shareLink}` : null,
  });
});

// ─── Add collaborator ─────────────────────────────────────────────────────────
router.post('/:id/collaborators', async (req: AuthRequest, res: Response) => {
  const doc = await CollabDocument.findById(req.params.id);
  if (!doc) { res.status(404).json({ error: 'Not found' }); return; }
  if (doc.ownerId.toString() !== req.user!.sub) { res.status(403).json({ error: 'Only owner can manage collaborators' }); return; }

  const { userId, permission } = req.body;
  const existing = doc.collaborators.findIndex((c) => c.userId.toString() === userId);
  if (existing >= 0) {
    doc.collaborators[existing].permission = permission;
  } else {
    doc.collaborators.push({ userId: new Types.ObjectId(userId), permission });
  }

  await doc.save();
  res.json(doc.collaborators);
});

export default router;
