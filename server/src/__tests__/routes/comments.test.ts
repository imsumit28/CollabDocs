import request from 'supertest';
import express, { Express } from 'express';
import cookieParser from 'cookie-parser';
import commentRoutes from '../../routes/comments';
import { generateAccessToken } from '../helpers';
import { CollabDocument, Comment, User } from '../../models';

describe('Comment Routes', () => {
  let app: Express;

  // owner of the document
  let ownerId: string;
  let ownerToken: string;
  // a viewer collaborator on the document
  let viewerId: string;
  let viewerToken: string;
  // an editor collaborator on the document
  let editorId: string;
  let editorToken: string;
  // a user with no relationship to the document
  let outsiderId: string;
  let outsiderToken: string;

  let docId: string;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/comments', commentRoutes);
  });

  beforeEach(async () => {
    const [owner, viewer, editor, outsider] = await User.create([
      { email: 'owner@example.com', displayName: 'Owner', passwordHash: 'x' },
      { email: 'viewer@example.com', displayName: 'Viewer', passwordHash: 'x' },
      { email: 'editor@example.com', displayName: 'Editor', passwordHash: 'x' },
      { email: 'outsider@example.com', displayName: 'Outsider', passwordHash: 'x' },
    ]);
    ownerId = owner.id; viewerId = viewer.id; editorId = editor.id; outsiderId = outsider.id;
    ownerToken = generateAccessToken(ownerId);
    viewerToken = generateAccessToken(viewerId);
    editorToken = generateAccessToken(editorId);
    outsiderToken = generateAccessToken(outsiderId);

    const doc = await CollabDocument.create({
      title: 'Test Doc',
      ownerId,
      collaborators: [
        { userId: viewerId, permission: 'view' },
        { userId: editorId, permission: 'edit' },
      ],
    });
    docId = doc.id;
  });

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  // ─── Authentication ─────────────────────────────────────────────────────────
  describe('authentication', () => {
    it('rejects unauthenticated requests', async () => {
      const res = await request(app).get(`/api/comments/${docId}`);
      expect(res.status).toBe(401);
    });
  });

  // ─── GET /:docId ──────────────────────────────────────────────────────────────
  describe('GET /:docId - list comments', () => {
    beforeEach(async () => {
      await Comment.create([
        { documentId: docId, authorId: ownerId, anchorText: 'foo', body: 'Comment 1' },
        { documentId: docId, authorId: viewerId, anchorText: 'bar', body: 'Comment 2' },
      ]);
    });

    it('lets the owner list comments', async () => {
      const res = await request(app).get(`/api/comments/${docId}`).set(auth(ownerToken));
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it('lets a collaborator (viewer) list comments', async () => {
      const res = await request(app).get(`/api/comments/${docId}`).set(auth(viewerToken));
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it('denies a user with no access (403)', async () => {
      const res = await request(app).get(`/api/comments/${docId}`).set(auth(outsiderToken));
      expect(res.status).toBe(403);
    });

    it('returns 404 for a non-existent document', async () => {
      const res = await request(app)
        .get('/api/comments/507f1f77bcf86cd799439011')
        .set(auth(ownerToken));
      expect(res.status).toBe(404);
    });

    it('returns 400 for a malformed document id', async () => {
      const res = await request(app).get('/api/comments/not-an-id').set(auth(ownerToken));
      expect(res.status).toBe(400);
    });
  });

  // ─── POST / ─────────────────────────────────────────────────────────────────
  describe('POST / - create comment', () => {
    it('lets the owner create a comment', async () => {
      const res = await request(app)
        .post('/api/comments')
        .set(auth(ownerToken))
        .send({ documentId: docId, anchorText: 'hello', body: 'Needs work' });
      expect(res.status).toBe(201);
      expect(res.body).toEqual(expect.objectContaining({ body: 'Needs work' }));
    });

    it('lets a viewer create a comment', async () => {
      const res = await request(app)
        .post('/api/comments')
        .set(auth(viewerToken))
        .send({ documentId: docId, anchorText: 'hello', body: 'A viewer note' });
      expect(res.status).toBe(201);
    });

    it('denies an outsider creating a comment (403)', async () => {
      const res = await request(app)
        .post('/api/comments')
        .set(auth(outsiderToken))
        .send({ documentId: docId, anchorText: 'hello', body: 'sneaky' });
      expect(res.status).toBe(403);
      expect(await Comment.countDocuments({ documentId: docId })).toBe(0);
    });

    it('rejects missing required fields (400)', async () => {
      const res = await request(app)
        .post('/api/comments')
        .set(auth(ownerToken))
        .send({ documentId: docId, anchorText: 'hello' });
      expect(res.status).toBe(400);
    });

    it('rejects a comment body that exceeds the max length (400)', async () => {
      const res = await request(app)
        .post('/api/comments')
        .set(auth(ownerToken))
        .send({ documentId: docId, anchorText: 'hello', body: 'x'.repeat(5001) });
      expect(res.status).toBe(400);
      expect(await Comment.countDocuments({ documentId: docId })).toBe(0);
    });

    it('rejects a reply whose parent is on another document (400)', async () => {
      const otherDoc = await CollabDocument.create({ title: 'Other', ownerId });
      const otherComment = await Comment.create({
        documentId: otherDoc.id, authorId: ownerId, anchorText: 'x', body: 'elsewhere',
      });
      const res = await request(app)
        .post('/api/comments')
        .set(auth(ownerToken))
        .send({ documentId: docId, anchorText: 'hello', body: 'reply', parentId: otherComment.id });
      expect(res.status).toBe(400);
    });
  });

  // ─── PATCH /:id/resolve ───────────────────────────────────────────────────────
  describe('PATCH /:id/resolve - toggle resolve', () => {
    let commentId: string;
    beforeEach(async () => {
      const c = await Comment.create({
        documentId: docId, authorId: viewerId, anchorText: 'x', body: 'Issue',
      });
      commentId = c.id;
    });

    it('lets the comment author resolve and reopen', async () => {
      const r1 = await request(app).patch(`/api/comments/${commentId}/resolve`).set(auth(viewerToken));
      expect(r1.status).toBe(200);
      expect(r1.body.resolved).toBe(true);

      const r2 = await request(app).patch(`/api/comments/${commentId}/resolve`).set(auth(viewerToken));
      expect(r2.body.resolved).toBe(false);
    });

    it('lets an editor resolve someone else\'s comment', async () => {
      const res = await request(app).patch(`/api/comments/${commentId}/resolve`).set(auth(editorToken));
      expect(res.status).toBe(200);
      expect(res.body.resolved).toBe(true);
    });

    it('denies an outsider resolving (403)', async () => {
      const res = await request(app).patch(`/api/comments/${commentId}/resolve`).set(auth(outsiderToken));
      expect(res.status).toBe(403);
    });
  });

  // ─── DELETE /:id ──────────────────────────────────────────────────────────────
  describe('DELETE /:id - delete comment', () => {
    let commentId: string;
    beforeEach(async () => {
      const c = await Comment.create({
        documentId: docId, authorId: viewerId, anchorText: 'x', body: 'to delete',
      });
      commentId = c.id;
    });

    it('lets the author delete their own comment', async () => {
      const res = await request(app).delete(`/api/comments/${commentId}`).set(auth(viewerToken));
      expect(res.status).toBe(200);
      expect(await Comment.findById(commentId)).toBeNull();
    });

    it('lets the document owner delete any comment', async () => {
      const res = await request(app).delete(`/api/comments/${commentId}`).set(auth(ownerToken));
      expect(res.status).toBe(200);
    });

    it('denies a non-author editor deleting (403)', async () => {
      const res = await request(app).delete(`/api/comments/${commentId}`).set(auth(editorToken));
      expect(res.status).toBe(403);
      expect(await Comment.findById(commentId)).not.toBeNull();
    });

    it('denies an outsider deleting (403)', async () => {
      const res = await request(app).delete(`/api/comments/${commentId}`).set(auth(outsiderToken));
      expect(res.status).toBe(403);
    });
  });
});
