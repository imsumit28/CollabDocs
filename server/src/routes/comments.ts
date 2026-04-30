import { Router, Response } from 'express';
import { Comment, CollabDocument } from '../models';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// ─── List comments for a document ─────────────────────────────────────────────
router.get('/:docId', async (req: AuthRequest, res: Response) => {
  const comments = await Comment.find({ documentId: req.params.docId })
    .populate('authorId', 'displayName avatarUrl')
    .sort({ createdAt: 1 })
    .lean();
  res.json(comments);
});

// ─── Create comment ───────────────────────────────────────────────────────────
router.post('/', async (req: AuthRequest, res: Response) => {
  const { documentId, anchorText, body, parentId } = req.body;
  if (!documentId || !anchorText || !body) {
    res.status(400).json({ error: 'documentId, anchorText, and body are required' });
    return;
  }

  const doc = await CollabDocument.findById(documentId);
  if (!doc) { res.status(404).json({ error: 'Document not found' }); return; }

  const comment = await Comment.create({
    documentId,
    authorId: req.user!.sub,
    anchorText,
    body,
    parentId: parentId || null,
  });

  await comment.populate('authorId', 'displayName avatarUrl');
  res.status(201).json(comment);
});

// ─── Toggle resolve ────────────────────────────────────────────────────────────
router.patch('/:id/resolve', async (req: AuthRequest, res: Response) => {
  const comment = await Comment.findById(req.params.id);
  if (!comment) { res.status(404).json({ error: 'Comment not found' }); return; }

  comment.resolved = !comment.resolved;
  await comment.save();
  res.json(comment);
});

// ─── Delete comment ────────────────────────────────────────────────────────────
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const comment = await Comment.findById(req.params.id);
  if (!comment) { res.status(404).json({ error: 'Not found' }); return; }
  if (comment.authorId.toString() !== req.user!.sub) {
    res.status(403).json({ error: 'Can only delete your own comments' });
    return;
  }
  await comment.deleteOne();
  res.json({ message: 'Deleted' });
});

export default router;
