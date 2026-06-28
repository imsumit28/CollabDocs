import { Router, Response } from 'express';
import { Notification } from '../models';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { isValidObjectId } from '../utils/validation';

const router = Router();
router.use(authMiddleware);

// ─── List my notifications (newest first) + unread count ──────────────────────
router.get('/', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.sub;
  const [items, unread] = await Promise.all([
    Notification.find({ recipientId: userId }).sort({ createdAt: -1 }).limit(30).lean(),
    Notification.countDocuments({ recipientId: userId, read: false }),
  ]);
  res.json({ notifications: items, unread });
});

// ─── Mark one as read ─────────────────────────────────────────────────────────
router.patch('/:id/read', async (req: AuthRequest, res: Response) => {
  if (!isValidObjectId(req.params.id)) { res.status(400).json({ error: 'Invalid id' }); return; }
  const result = await Notification.updateOne(
    { _id: req.params.id, recipientId: req.user!.sub },
    { read: true }
  );
  if (result.matchedCount === 0) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ message: 'Marked read' });
});

// ─── Mark all as read ─────────────────────────────────────────────────────────
router.post('/read-all', async (req: AuthRequest, res: Response) => {
  await Notification.updateMany({ recipientId: req.user!.sub, read: false }, { read: true });
  res.json({ message: 'All marked read' });
});

export default router;
