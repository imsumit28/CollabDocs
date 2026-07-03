import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { CollabDocument, User, Folder, IDocument } from '../models';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { validateTitle, validateEmail, validateShareLinkPermission, isValidObjectId } from '../utils/validation';
import { notifyShare } from '../utils/notifications';
import { refreshDocPermissions } from '../socket';
import { logger } from '../utils/logger';
import { Types } from 'mongoose';

// Merge collaborator subdocs with their user details for client display.
async function buildCollaboratorList(doc: IDocument) {
  const ids = doc.collaborators.map((c) => c.userId);
  const users = await User.find({ _id: { $in: ids } }, 'email displayName avatarUrl').lean();
  const byId = new Map(users.map((u) => [u._id.toString(), u]));
  return doc.collaborators.map((c) => {
    const u = byId.get(c.userId.toString());
    return {
      userId: c.userId.toString(),
      email: u?.email ?? null,
      displayName: u?.displayName ?? null,
      avatarUrl: u?.avatarUrl ?? null,
      permission: c.permission,
    };
  });
}

const router = Router();
router.use(authMiddleware);

// Reject a malformed :id up front. Without this, passing a non-ObjectId string
// to CollabDocument.findById() throws a Mongoose CastError inside an async
// handler — which Express 4 cannot route to the error middleware, so the request
// hangs (and an unhandled rejection can crash the process). Returns 400, matching
// the id guards already used by the comments/folders/notifications routers.
router.param('id', (req, res, next, val) => {
  if (!isValidObjectId(val)) { res.status(400).json({ error: 'Invalid id' }); return; }
  next();
});

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
        logger.info({ count: result.deletedCount }, 'Purged expired trash documents');
      }
    } catch (err) {
      logger.error({ err }, 'Trash purge error');
    }
  };
  purge(); // run immediately on startup
  // .unref() so the interval never keeps the process alive on its own
  setInterval(purge, 60 * 60 * 1000).unref(); // then every hour
}
// Don't run the background purge under Jest — it would hit the DB on import and
// leak a timer that prevents the test worker from exiting cleanly.
if (!process.env.JEST_WORKER_ID) {
  startTrashPurge();
}

// ─── List active documents ────────────────────────────────────────────────────
// Backward compatible: with no ?page/?limit it returns a plain array (the legacy
// shape the dashboard consumes). Pass ?page=N (and optionally ?limit=) to get a
// paginated envelope { items, total, page, limit, totalPages, hasMore } instead.
router.get('/', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.sub;

  // Optional folder scoping. Folders are owner-only organization, so a folder
  // filter restricts to the requester's own documents in that folder (or root).
  let query: Record<string, unknown>;
  const folderId = typeof req.query.folderId === 'string' ? req.query.folderId : undefined;
  if (folderId !== undefined) {
    if (folderId === 'root' || folderId === 'null' || folderId === '') {
      query = { deletedAt: null, ownerId: userId, folderId: null };
    } else if (isValidObjectId(folderId)) {
      query = { deletedAt: null, ownerId: userId, folderId: new Types.ObjectId(folderId) };
    } else {
      res.status(400).json({ error: 'Invalid folder id' });
      return;
    }
  } else {
    query = {
      deletedAt: null,
      $or: [
        { ownerId: userId },
        { 'collaborators.userId': new Types.ObjectId(userId) },
      ],
    };
  }

  const paginated = req.query.page !== undefined || req.query.limit !== undefined;
  if (!paginated) {
    const docs = await CollabDocument.find(query)
      .select('-yjsState')
      .sort({ updatedAt: -1 })
      .lean();
    res.json(docs);
    return;
  }

  const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit), 10) || 20));
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    CollabDocument.find(query)
      .select('-yjsState')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CollabDocument.countDocuments(query),
  ]);

  res.json({
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasMore: skip + items.length < total,
  });
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

// ─── Search documents (title + content) ───────────────────────────────────────
router.get('/search', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.sub;
  const q = (typeof req.query.q === 'string' ? req.query.q : '').trim();
  if (!q) { res.json([]); return; }

  // Escape regex metacharacters so the query is treated as literal text
  const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rx = new RegExp(safe, 'i');

  const docs = await CollabDocument.find({
    deletedAt: null,
    $and: [
      { $or: [{ ownerId: userId }, { 'collaborators.userId': new Types.ObjectId(userId) }] },
      { $or: [{ title: rx }, { contentText: rx }] },
    ],
  })
    .select('-yjsState -contentText')
    .sort({ updatedAt: -1 })
    .limit(50)
    .lean();

  res.json(docs);
});

// ─── Create document ──────────────────────────────────────────────────────────
router.post('/', async (req: AuthRequest, res: Response) => {
  const { title = 'Untitled', content } = req.body;

  const titleError = validateTitle(title);
  if (titleError) { res.status(400).json({ error: titleError.message }); return; }

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

  if (req.body.title !== undefined) {
    const titleError = validateTitle(req.body.title);
    if (titleError) { res.status(400).json({ error: titleError.message }); return; }
    doc.title = req.body.title;
  }

  // Move into / out of a folder. Folders are owner-scoped organization, so only
  // the owner can change a document's folder. folderId: null moves it to root.
  if (req.body.folderId !== undefined) {
    if (doc.ownerId.toString() !== req.user!.sub) {
      res.status(403).json({ error: 'Only the owner can move this document' });
      return;
    }
    if (req.body.folderId === null) {
      doc.folderId = null;
    } else {
      if (!isValidObjectId(req.body.folderId)) { res.status(400).json({ error: 'Invalid folder id' }); return; }
      const folder = await Folder.findOne({ _id: req.body.folderId, ownerId: req.user!.sub });
      if (!folder) { res.status(404).json({ error: 'Folder not found' }); return; }
      doc.folderId = folder._id;
    }
  }

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

  // Push the new link permission (or the revoked link) to everyone currently in
  // the live room so read-only state flips without a refresh.
  await refreshDocPermissions(doc.id);

  res.json({
    shareLink: doc.shareLink,
    shareLinkPermission: doc.shareLinkPermission,
    shareUrl: doc.shareLink ? `${process.env.CLIENT_URL}/doc/${doc.id}?share=${doc.shareLink}` : null,
  });
});

// ─── List collaborators (owner or collaborator) ───────────────────────────────
router.get('/:id/collaborators', async (req: AuthRequest, res: Response) => {
  const doc = await CollabDocument.findById(req.params.id);
  if (!doc) { res.status(404).json({ error: 'Not found' }); return; }
  if (!getUserPermission(doc, req.user!.sub)) { res.status(403).json({ error: 'Access denied' }); return; }

  const owner = await User.findById(doc.ownerId, 'email displayName avatarUrl').lean();
  res.json({
    owner: owner
      ? { userId: doc.ownerId.toString(), email: owner.email, displayName: owner.displayName, avatarUrl: owner.avatarUrl ?? null }
      : null,
    collaborators: await buildCollaboratorList(doc),
  });
});

// ─── Invite a collaborator by email (owner only) ──────────────────────────────
router.post('/:id/collaborators', async (req: AuthRequest, res: Response) => {
  const doc = await CollabDocument.findById(req.params.id);
  if (!doc) { res.status(404).json({ error: 'Not found' }); return; }
  if (doc.ownerId.toString() !== req.user!.sub) { res.status(403).json({ error: 'Only owner can manage collaborators' }); return; }

  const { email, permission = 'view' } = req.body;
  const emailError = validateEmail(email);
  if (emailError) { res.status(400).json({ error: emailError.message }); return; }
  if (!validateShareLinkPermission(permission)) { res.status(400).json({ error: 'Permission must be "view" or "edit"' }); return; }

  const invitee = await User.findOne({ email: email.toLowerCase().trim() });
  if (!invitee) { res.status(404).json({ error: 'No CollabDocs user found with that email' }); return; }
  if (invitee.id === doc.ownerId.toString()) { res.status(400).json({ error: 'You already own this document' }); return; }

  const existing = doc.collaborators.findIndex((c) => c.userId.toString() === invitee.id);
  const isNew = existing < 0;
  if (existing >= 0) {
    doc.collaborators[existing].permission = permission;
  } else {
    doc.collaborators.push({ userId: new Types.ObjectId(invitee.id), permission });
  }

  await doc.save();

  // A re-permissioned collaborator who is already in the room flips live.
  await refreshDocPermissions(doc.id);

  // Notify the invitee only when newly added (not on a permission change)
  if (isNew) {
    await notifyShare({
      recipientId: invitee.id,
      actorId: req.user!.sub,
      actorName: req.user!.displayName,
      documentId: doc.id,
      documentTitle: doc.title,
      permission,
    });
  }

  res.status(201).json({ collaborators: await buildCollaboratorList(doc) });
});

// ─── Remove a collaborator (owner only) ───────────────────────────────────────
router.delete('/:id/collaborators/:userId', async (req: AuthRequest, res: Response) => {
  if (!isValidObjectId(req.params.userId)) { res.status(400).json({ error: 'Invalid user id' }); return; }

  const doc = await CollabDocument.findById(req.params.id);
  if (!doc) { res.status(404).json({ error: 'Not found' }); return; }
  if (doc.ownerId.toString() !== req.user!.sub) { res.status(403).json({ error: 'Only owner can manage collaborators' }); return; }

  const before = doc.collaborators.length;
  doc.collaborators = doc.collaborators.filter((c) => c.userId.toString() !== req.params.userId) as typeof doc.collaborators;
  if (doc.collaborators.length === before) { res.status(404).json({ error: 'Collaborator not found' }); return; }

  await doc.save();

  // A removed collaborator loses live access immediately (unless a share link
  // still covers them), so re-evaluate the room.
  await refreshDocPermissions(doc.id);

  res.json({ collaborators: await buildCollaboratorList(doc) });
});

export default router;
