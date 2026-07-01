import request from 'supertest';
import express, { Express } from 'express';
import cookieParser from 'cookie-parser';
import commentRoutes from '../../routes/comments';
import { generateAccessToken } from '../helpers';
import { CollabDocument, Comment, User } from '../../models';

// Failure-path coverage for the comments router that the main suite skipped:
// malformed ids, missing fields, and the viewer-not-author resolve case.
describe('Comment Routes — failure paths', () => {
  let app: Express;
  let ownerId: string, viewerId: string, editorId: string;
  let ownerTok: string, viewerTok: string;
  let docId: string;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/comments', commentRoutes);
  });

  beforeEach(async () => {
    const [owner, viewer, editor] = await User.create([
      { email: 'o@c.test', displayName: 'Owner', passwordHash: 'x' },
      { email: 'v@c.test', displayName: 'Viewer', passwordHash: 'x' },
      { email: 'e@c.test', displayName: 'Editor', passwordHash: 'x' },
    ]);
    ownerId = owner.id; viewerId = viewer.id; editorId = editor.id;
    ownerTok = generateAccessToken(ownerId);
    viewerTok = generateAccessToken(viewerId);
    const doc = await CollabDocument.create({
      title: 'D', ownerId,
      collaborators: [{ userId: viewerId, permission: 'view' }, { userId: editorId, permission: 'edit' }],
    });
    docId = doc.id;
  });

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  describe('POST / validation', () => {
    it('400 when documentId is missing', async () => {
      const res = await request(app).post('/api/comments').set(auth(ownerTok)).send({ anchorText: 'a', body: 'b' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/documentId is required/);
    });

    it('400 when documentId is malformed', async () => {
      const res = await request(app).post('/api/comments').set(auth(ownerTok)).send({ documentId: 'bad', anchorText: 'a', body: 'b' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invalid document id/);
    });

    it('400 when anchorText is empty', async () => {
      const res = await request(app).post('/api/comments').set(auth(ownerTok)).send({ documentId: docId, anchorText: '   ', body: 'b' });
      expect(res.status).toBe(400);
    });

    it('404 when the document does not exist', async () => {
      const res = await request(app).post('/api/comments').set(auth(ownerTok))
        .send({ documentId: '507f1f77bcf86cd799439011', anchorText: 'a', body: 'b' });
      expect(res.status).toBe(404);
    });

    it('400 when parentId is malformed', async () => {
      const res = await request(app).post('/api/comments').set(auth(ownerTok))
        .send({ documentId: docId, anchorText: 'a', body: 'b', parentId: 'not-an-id' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invalid parentId/);
    });

    it('creates a valid threaded reply', async () => {
      const parent = await Comment.create({ documentId: docId, authorId: ownerId, anchorText: 'a', body: 'top' });
      const res = await request(app).post('/api/comments').set(auth(ownerTok))
        .send({ documentId: docId, anchorText: 'a', body: 'reply', parentId: parent.id });
      expect(res.status).toBe(201);
      expect(res.body.parentId).toBe(parent.id);
    });
  });

  describe('PATCH /:id/resolve', () => {
    it('400 for a malformed comment id', async () => {
      const res = await request(app).patch('/api/comments/bad-id/resolve').set(auth(ownerTok));
      expect(res.status).toBe(400);
    });

    it('404 for a missing comment', async () => {
      const res = await request(app).patch('/api/comments/507f1f77bcf86cd799439011/resolve').set(auth(ownerTok));
      expect(res.status).toBe(404);
    });

    it('403 when a viewer (not the author, no edit rights) tries to resolve', async () => {
      // Comment authored by the owner; a plain viewer is neither author nor editor.
      const c = await Comment.create({ documentId: docId, authorId: ownerId, anchorText: 'a', body: 'owned' });
      const res = await request(app).patch(`/api/comments/${c.id}/resolve`).set(auth(viewerTok));
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/author or an editor/);
    });
  });

  describe('DELETE /:id', () => {
    it('400 for a malformed comment id', async () => {
      const res = await request(app).delete('/api/comments/bad-id').set(auth(ownerTok));
      expect(res.status).toBe(400);
    });

    it('404 for a missing comment', async () => {
      const res = await request(app).delete('/api/comments/507f1f77bcf86cd799439011').set(auth(ownerTok));
      expect(res.status).toBe(404);
    });
  });
});
