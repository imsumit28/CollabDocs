import request from 'supertest';
import express, { Express } from 'express';
import { Types } from 'mongoose';
import documentRoutes from '../../routes/documents';
import { generateAccessToken } from '../helpers';
import { CollabDocument, Folder } from '../../models';
import cookieParser from 'cookie-parser';

// Covers document-route branches the original suite skipped: shared-link
// resolution, trash restore / permanent delete, folder filtering + moves, and
// the editor-vs-viewer permission split on PATCH.
describe('Document Routes — extra coverage', () => {
  let app: Express;
  let ownerId: string;
  let editorId: string;
  let viewerId: string;
  let strangerId: string;
  let ownerTok: string;
  let editorTok: string;
  let viewerTok: string;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/docs', documentRoutes);
    // Mirror the production global error handler (index.ts) so unhandled route
    // errors (e.g. a Mongoose CastError from a malformed :id) become a 500 rather
    // than hanging the request.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    app.use((_err: any, _req: any, res: any, _next: any) => {
      res.status(500).json({ error: 'Internal server error' });
    });

    ownerId = new Types.ObjectId().toString();
    editorId = new Types.ObjectId().toString();
    viewerId = new Types.ObjectId().toString();
    strangerId = new Types.ObjectId().toString();
    ownerTok = generateAccessToken(ownerId);
    editorTok = generateAccessToken(editorId);
    viewerTok = generateAccessToken(viewerId);
  });

  afterEach(async () => {
    await CollabDocument.deleteMany({});
    await Folder.deleteMany({});
  });

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  async function makeDoc(overrides: Record<string, unknown> = {}) {
    const doc = await CollabDocument.create({
      title: 'Doc',
      ownerId,
      collaborators: [
        { userId: editorId, permission: 'edit' },
        { userId: viewerId, permission: 'view' },
      ],
      ...overrides,
    });
    return doc;
  }

  // ─── Single-doc access for collaborators ────────────────────────────────────────
  describe('GET /:id permission surface', () => {
    it('returns edit for an edit collaborator and view for a viewer', async () => {
      const doc = await makeDoc();
      const edit = await request(app).get(`/api/docs/${doc.id}`).set(auth(editorTok));
      expect(edit.body.permission).toBe('edit');
      const view = await request(app).get(`/api/docs/${doc.id}`).set(auth(viewerTok));
      expect(view.body.permission).toBe('view');
    });

    it('a malformed :id returns 400 (regression: previously hung on a CastError)', async () => {
      // BUG FIX regression guard: a non-ObjectId :id used to throw a Mongoose
      // CastError inside the async handler, which Express 4 can't route to the
      // error middleware — so the request hung forever (DoS). The router.param
      // guard in documents.ts now rejects it with 400 before any DB call.
      const res = await request(app).get('/api/docs/not-a-valid-id').set(auth(ownerTok));
      expect(res.status).toBe(400);
    });

    it('a malformed :id is rejected on PATCH and DELETE too', async () => {
      const patch = await request(app).patch('/api/docs/bad-id').set(auth(ownerTok)).send({ title: 'x' });
      expect(patch.status).toBe(400);
      const del = await request(app).delete('/api/docs/bad-id').set(auth(ownerTok));
      expect(del.status).toBe(400);
    });
  });

  // ─── PATCH /:id — editor vs viewer ──────────────────────────────────────────────
  describe('PATCH /:id title permissions', () => {
    it('lets an edit collaborator change the title', async () => {
      const doc = await makeDoc();
      const res = await request(app).patch(`/api/docs/${doc.id}`).set(auth(editorTok)).send({ title: 'Edited' });
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Edited');
    });

    it('forbids a view collaborator from changing the title (403)', async () => {
      const doc = await makeDoc();
      const res = await request(app).patch(`/api/docs/${doc.id}`).set(auth(viewerTok)).send({ title: 'Nope' });
      expect(res.status).toBe(403);
    });

    it('rejects an over-length title (400)', async () => {
      const doc = await makeDoc();
      const res = await request(app).patch(`/api/docs/${doc.id}`).set(auth(ownerTok)).send({ title: 'x'.repeat(501) });
      expect(res.status).toBe(400);
    });
  });

  // ─── Folder move + filter ───────────────────────────────────────────────────────
  describe('folder move + filter', () => {
    it('moves an owned doc into an owned folder and back to root', async () => {
      const folder = await Folder.create({ name: 'Work', ownerId });
      const doc = await makeDoc();

      const into = await request(app).patch(`/api/docs/${doc.id}`).set(auth(ownerTok)).send({ folderId: folder.id });
      expect(into.status).toBe(200);
      expect(String(into.body.folderId)).toBe(folder.id);

      const out = await request(app).patch(`/api/docs/${doc.id}`).set(auth(ownerTok)).send({ folderId: null });
      expect(out.status).toBe(200);
      expect(out.body.folderId).toBeNull();
    });

    it('404 when moving into a folder the user does not own', async () => {
      const otherFolder = await Folder.create({ name: 'Theirs', ownerId: strangerId });
      const doc = await makeDoc();
      const res = await request(app).patch(`/api/docs/${doc.id}`).set(auth(ownerTok)).send({ folderId: otherFolder.id });
      expect(res.status).toBe(404);
    });

    it('400 for an invalid folderId on move', async () => {
      const doc = await makeDoc();
      const res = await request(app).patch(`/api/docs/${doc.id}`).set(auth(ownerTok)).send({ folderId: 'bogus' });
      expect(res.status).toBe(400);
    });

    it('forbids an edit collaborator (non-owner) from moving the doc (403)', async () => {
      const folder = await Folder.create({ name: 'Work', ownerId });
      const doc = await makeDoc();
      const res = await request(app).patch(`/api/docs/${doc.id}`).set(auth(editorTok)).send({ folderId: folder.id });
      expect(res.status).toBe(403);
    });

    it('filters the list by folderId=root and by folder id', async () => {
      const folder = await Folder.create({ name: 'Work', ownerId });
      await CollabDocument.create([
        { title: 'Root doc', ownerId, folderId: null },
        { title: 'Foldered doc', ownerId, folderId: folder._id },
      ]);

      const root = await request(app).get('/api/docs?folderId=root').set(auth(ownerTok));
      expect(root.body.map((d: any) => d.title)).toEqual(['Root doc']);

      const inFolder = await request(app).get(`/api/docs?folderId=${folder.id}`).set(auth(ownerTok));
      expect(inFolder.body.map((d: any) => d.title)).toEqual(['Foldered doc']);
    });

    it('400 for an invalid folderId filter', async () => {
      const res = await request(app).get('/api/docs?folderId=not-an-id').set(auth(ownerTok));
      expect(res.status).toBe(400);
    });
  });

  // ─── Trash lifecycle: restore + permanent delete ────────────────────────────────
  describe('restore + permanent delete', () => {
    it('owner restores a trashed document', async () => {
      const doc = await makeDoc({ deletedAt: new Date() });
      const res = await request(app).patch(`/api/docs/${doc.id}/restore`).set(auth(ownerTok));
      expect(res.status).toBe(200);
      const fresh = await CollabDocument.findById(doc.id);
      expect(fresh!.deletedAt).toBeNull();
    });

    it('forbids a non-owner from restoring (403)', async () => {
      const doc = await makeDoc({ deletedAt: new Date() });
      const res = await request(app).patch(`/api/docs/${doc.id}/restore`).set(auth(editorTok));
      expect(res.status).toBe(403);
    });

    it('404 restoring a missing document', async () => {
      const res = await request(app).patch('/api/docs/507f1f77bcf86cd799439011/restore').set(auth(ownerTok));
      expect(res.status).toBe(404);
    });

    it('owner permanently deletes a document', async () => {
      const doc = await makeDoc({ deletedAt: new Date() });
      const res = await request(app).delete(`/api/docs/${doc.id}/permanent`).set(auth(ownerTok));
      expect(res.status).toBe(200);
      expect(await CollabDocument.findById(doc.id)).toBeNull();
    });

    it('forbids a non-owner from permanent delete (403)', async () => {
      const doc = await makeDoc({ deletedAt: new Date() });
      const res = await request(app).delete(`/api/docs/${doc.id}/permanent`).set(auth(editorTok));
      expect(res.status).toBe(403);
      expect(await CollabDocument.findById(doc.id)).not.toBeNull();
    });
  });

  // ─── Share link re-use + disable ────────────────────────────────────────────────
  describe('POST /:id/share edge cases', () => {
    it('keeps the same token when re-sharing and updates the permission', async () => {
      const doc = await makeDoc();
      const first = await request(app).post(`/api/docs/${doc.id}/share`).set(auth(ownerTok)).send({ permission: 'view' });
      const token1 = first.body.shareLink;

      const second = await request(app).post(`/api/docs/${doc.id}/share`).set(auth(ownerTok)).send({ permission: 'edit' });
      expect(second.body.shareLink).toBe(token1); // token is stable
      expect(second.body.shareLinkPermission).toBe('edit');
    });
  });
});
