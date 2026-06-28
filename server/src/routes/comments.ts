import { Router, Response } from 'express';
import { Comment } from '../models';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { isValidObjectId, validateCommentBody, validateAnchorText, firstError } from '../utils/validation';
import { loadDocumentForUser, canEdit } from '../utils/documentAccess';
import { notifyComment } from '../utils/notifications';

const router = Router();
router.use(authMiddleware);

// ─── List comments for a document ─────────────────────────────────────────────
// Requires read access (owner / editor / viewer) to the parent document.
router.get('/:docId', async (req: AuthRequest, res: Response) => {
  try {
    const { docId } = req.params;
    if (!isValidObjectId(docId)) {
      res.status(400).json({ error: 'Invalid document id' });
      return;
    }

    const { doc, permission } = await loadDocumentForUser(docId, req.user!.sub);
    if (!doc) { res.status(404).json({ error: 'Document not found' }); return; }
    if (!permission) { res.status(403).json({ error: 'Access denied' }); return; }

    const comments = await Comment.find({ documentId: docId })
      .populate('authorId', 'displayName avatarUrl')
      .sort({ createdAt: 1 })
      .lean();
    res.json(comments);
  } catch {
    res.status(500).json({ error: 'Failed to load comments' });
  }
});

// ─── Create comment ───────────────────────────────────────────────────────────
// Requires read access to the document. Viewers may leave comments.
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { documentId, anchorText, body, parentId } = req.body;
    if (!documentId) {
      res.status(400).json({ error: 'documentId is required' });
      return;
    }
    if (!isValidObjectId(documentId)) {
      res.status(400).json({ error: 'Invalid document id' });
      return;
    }
    const validationError = firstError(
      validateAnchorText(anchorText),
      validateCommentBody(body),
    );
    if (validationError) {
      res.status(400).json({ error: validationError.message, field: validationError.field });
      return;
    }

    const { doc, permission } = await loadDocumentForUser(documentId, req.user!.sub);
    if (!doc) { res.status(404).json({ error: 'Document not found' }); return; }
    if (!permission) { res.status(403).json({ error: 'Access denied' }); return; }

    // A reply must reference a real comment on the same document
    if (parentId) {
      if (!isValidObjectId(parentId)) {
        res.status(400).json({ error: 'Invalid parentId' });
        return;
      }
      const parent = await Comment.findById(parentId);
      if (!parent || parent.documentId.toString() !== documentId.toString()) {
        res.status(400).json({ error: 'Parent comment does not belong to this document' });
        return;
      }
    }

    const comment = await Comment.create({
      documentId,
      authorId: req.user!.sub,
      anchorText,
      body,
      parentId: parentId || null,
    });

    await comment.populate('authorId', 'displayName avatarUrl');

    // Best-effort: notify document participants (mentions take priority)
    await notifyComment({
      doc: doc as any,
      authorId: req.user!.sub,
      authorName: req.user!.displayName,
      body,
    });

    res.status(201).json(comment);
  } catch {
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

// ─── Toggle resolve ────────────────────────────────────────────────────────────
// The comment author, or anyone with edit access to the document, may resolve.
router.patch('/:id/resolve', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      res.status(400).json({ error: 'Invalid comment id' });
      return;
    }

    const comment = await Comment.findById(id);
    if (!comment) { res.status(404).json({ error: 'Comment not found' }); return; }

    const { permission } = await loadDocumentForUser(comment.documentId.toString(), req.user!.sub);
    if (!permission) { res.status(403).json({ error: 'Access denied' }); return; }

    const isAuthor = comment.authorId.toString() === req.user!.sub;
    if (!isAuthor && !canEdit(permission)) {
      res.status(403).json({ error: 'Only the author or an editor can resolve this comment' });
      return;
    }

    comment.resolved = !comment.resolved;
    await comment.save();
    res.json(comment);
  } catch {
    res.status(500).json({ error: 'Failed to update comment' });
  }
});

// ─── Delete comment ────────────────────────────────────────────────────────────
// The comment author, or the document owner, may delete.
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      res.status(400).json({ error: 'Invalid comment id' });
      return;
    }

    const comment = await Comment.findById(id);
    if (!comment) { res.status(404).json({ error: 'Not found' }); return; }

    const { permission } = await loadDocumentForUser(comment.documentId.toString(), req.user!.sub);
    const isAuthor = comment.authorId.toString() === req.user!.sub;
    if (!isAuthor && permission !== 'owner') {
      res.status(403).json({ error: 'Can only delete your own comments' });
      return;
    }

    await comment.deleteOne();
    res.json({ message: 'Deleted' });
  } catch {
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

export default router;
