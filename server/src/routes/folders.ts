import { Router, Response } from 'express';
import { Types } from 'mongoose';
import { Folder, CollabDocument } from '../models';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { validateFolderName, isValidObjectId } from '../utils/validation';

const router = Router();
router.use(authMiddleware);

// ─── List folders (with live document counts) ──────────────────────────────────
router.get('/', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.sub;
  const folders = await Folder.find({ ownerId: userId }).sort({ name: 1 }).lean();

  // Count non-trashed docs per folder so the sidebar can show totals.
  const counts = await CollabDocument.aggregate([
    { $match: { ownerId: new Types.ObjectId(userId), folderId: { $ne: null }, deletedAt: null } },
    { $group: { _id: '$folderId', count: { $sum: 1 } } },
  ]);
  const countById = new Map(counts.map((c) => [String(c._id), c.count]));

  res.json(
    folders.map((f) => ({
      _id: f._id,
      name: f.name,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
      docCount: countById.get(String(f._id)) ?? 0,
    })),
  );
});

// ─── Create folder ─────────────────────────────────────────────────────────────
router.post('/', async (req: AuthRequest, res: Response) => {
  const nameError = validateFolderName(req.body?.name);
  if (nameError) { res.status(400).json({ error: nameError.message }); return; }

  const folder = await Folder.create({
    name: String(req.body.name).trim(),
    ownerId: req.user!.sub,
  });
  res.status(201).json(folder);
});

// ─── Rename folder ─────────────────────────────────────────────────────────────
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  if (!isValidObjectId(req.params.id)) { res.status(400).json({ error: 'Invalid folder id' }); return; }

  const nameError = validateFolderName(req.body?.name);
  if (nameError) { res.status(400).json({ error: nameError.message }); return; }

  const folder = await Folder.findById(req.params.id);
  if (!folder) { res.status(404).json({ error: 'Folder not found' }); return; }
  if (folder.ownerId.toString() !== req.user!.sub) { res.status(403).json({ error: 'Access denied' }); return; }

  folder.name = String(req.body.name).trim();
  await folder.save();
  res.json(folder);
});

// ─── Delete folder (documents inside are moved to root, not deleted) ────────────
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  if (!isValidObjectId(req.params.id)) { res.status(400).json({ error: 'Invalid folder id' }); return; }

  const folder = await Folder.findById(req.params.id);
  if (!folder) { res.status(404).json({ error: 'Folder not found' }); return; }
  if (folder.ownerId.toString() !== req.user!.sub) { res.status(403).json({ error: 'Access denied' }); return; }

  await CollabDocument.updateMany({ folderId: folder._id }, { $set: { folderId: null } });
  await folder.deleteOne();
  res.json({ message: 'Folder deleted', movedToRoot: true });
});

export default router;
