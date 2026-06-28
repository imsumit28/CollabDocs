import request from 'supertest';
import express, { Express } from 'express';
import { Types } from 'mongoose';
import * as Y from 'yjs';
import versionRoutes from '../../routes/versions';
import { generateAccessToken } from '../helpers';
import { CollabDocument, Version } from '../../models';

function yState(text = 'hello'): Buffer {
  const ydoc = new Y.Doc();
  ydoc.getText('content').insert(0, text);
  return Buffer.from(Y.encodeStateAsUpdate(ydoc));
}

describe('Version Routes', () => {
  let app: Express;
  let ownerId: string, editorId: string, viewerId: string, strangerId: string;
  let ownerToken: string, editorToken: string, viewerToken: string, strangerToken: string;
  let docId: string;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/versions', versionRoutes);
    ownerId = new Types.ObjectId().toString();
    editorId = new Types.ObjectId().toString();
    viewerId = new Types.ObjectId().toString();
    strangerId = new Types.ObjectId().toString();
    ownerToken = generateAccessToken(ownerId);
    editorToken = generateAccessToken(editorId);
    viewerToken = generateAccessToken(viewerId);
    strangerToken = generateAccessToken(strangerId);
  });

  beforeEach(async () => {
    const doc = await CollabDocument.create({
      title: 'Doc',
      ownerId,
      collaborators: [
        { userId: editorId, permission: 'edit' },
        { userId: viewerId, permission: 'view' },
      ],
      yjsState: yState('initial'),
    });
    docId = doc.id;
  });

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  describe('GET /:docId', () => {
    beforeEach(async () => {
      await Version.create({ documentId: docId, yjsSnapshot: yState(), savedBy: ownerId, label: 'v1' });
    });

    it('lets owner list versions', async () => {
      const res = await request(app).get(`/api/versions/${docId}`).set(auth(ownerToken));
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    it('lets a collaborator list versions', async () => {
      const res = await request(app).get(`/api/versions/${docId}`).set(auth(viewerToken));
      expect(res.status).toBe(200);
    });

    it('denies a stranger (403)', async () => {
      const res = await request(app).get(`/api/versions/${docId}`).set(auth(strangerToken));
      expect(res.status).toBe(403);
    });

    it('404 for a missing document', async () => {
      const res = await request(app).get(`/api/versions/${new Types.ObjectId()}`).set(auth(ownerToken));
      expect(res.status).toBe(404);
    });
  });

  describe('POST /:docId - save snapshot', () => {
    it('lets an editor save a snapshot', async () => {
      const res = await request(app).post(`/api/versions/${docId}`).set(auth(editorToken));
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('label');
    });

    it('denies a viewer (403)', async () => {
      const res = await request(app).post(`/api/versions/${docId}`).set(auth(viewerToken));
      expect(res.status).toBe(403);
    });

    it('400 when the document has no state to snapshot', async () => {
      const empty = await CollabDocument.create({ title: 'Empty', ownerId });
      const res = await request(app).post(`/api/versions/${empty.id}`).set(auth(ownerToken));
      expect(res.status).toBe(400);
    });
  });

  describe('POST /:id/restore', () => {
    let versionId: string;
    let snapshot: Buffer;
    beforeEach(async () => {
      // Y.Doc embeds a random clientID, so two yState() calls differ byte-wise.
      // Keep the exact buffer we stored so we can assert it was restored.
      snapshot = yState('restored');
      const v = await Version.create({ documentId: docId, yjsSnapshot: snapshot, savedBy: ownerId, label: 'v1' });
      versionId = v.id;
    });

    it('lets the owner restore a version', async () => {
      const res = await request(app).post(`/api/versions/${versionId}/restore`).set(auth(ownerToken));
      expect(res.status).toBe(200);
      const doc = await CollabDocument.findById(docId);
      expect(Buffer.compare(doc!.yjsState as Buffer, snapshot)).toBe(0);
    });

    it('denies a stranger (403)', async () => {
      const res = await request(app).post(`/api/versions/${versionId}/restore`).set(auth(strangerToken));
      expect(res.status).toBe(403);
    });

    it('404 for a missing version', async () => {
      const res = await request(app).post(`/api/versions/${new Types.ObjectId()}/restore`).set(auth(ownerToken));
      expect(res.status).toBe(404);
    });
  });
});
