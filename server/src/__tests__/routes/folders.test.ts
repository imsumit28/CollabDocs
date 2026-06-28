import request from 'supertest';
import express, { Express } from 'express';
import { Types } from 'mongoose';
import folderRoutes from '../../routes/folders';
import documentRoutes from '../../routes/documents';
import { generateAccessToken } from '../helpers';
import { Folder, CollabDocument } from '../../models';

describe('Folder Routes', () => {
  let app: Express;
  let ownerId: string, otherId: string;
  let ownerToken: string, otherToken: string;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/folders', folderRoutes);
    app.use('/api/docs', documentRoutes);
    ownerId = new Types.ObjectId().toString();
    otherId = new Types.ObjectId().toString();
    ownerToken = generateAccessToken(ownerId);
    otherToken = generateAccessToken(otherId);
  });

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  describe('POST /', () => {
    it('creates a folder', async () => {
      const res = await request(app).post('/api/folders').set(auth(ownerToken)).send({ name: 'Work' });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Work');
      expect(res.body.ownerId).toBe(ownerId);
    });

    it('rejects an empty name', async () => {
      const res = await request(app).post('/api/folders').set(auth(ownerToken)).send({ name: '   ' });
      expect(res.status).toBe(400);
    });

    it('requires authentication', async () => {
      const res = await request(app).post('/api/folders').send({ name: 'Nope' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /', () => {
    it('lists only the requester\'s folders with doc counts', async () => {
      const f = await Folder.create({ name: 'Personal', ownerId });
      await Folder.create({ name: 'Someone else', ownerId: otherId });
      await CollabDocument.create({ title: 'A', ownerId, folderId: f._id });
      await CollabDocument.create({ title: 'B', ownerId, folderId: f._id });
      await CollabDocument.create({ title: 'Trashed', ownerId, folderId: f._id, deletedAt: new Date() });

      const res = await request(app).get('/api/folders').set(auth(ownerToken));
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Personal');
      expect(res.body[0].docCount).toBe(2); // trashed not counted
    });
  });

  describe('PATCH /:id', () => {
    it('renames a folder', async () => {
      const f = await Folder.create({ name: 'Old', ownerId });
      const res = await request(app).patch(`/api/folders/${f.id}`).set(auth(ownerToken)).send({ name: 'New' });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('New');
    });

    it('forbids renaming someone else\'s folder', async () => {
      const f = await Folder.create({ name: 'Theirs', ownerId });
      const res = await request(app).patch(`/api/folders/${f.id}`).set(auth(otherToken)).send({ name: 'Hacked' });
      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /:id', () => {
    it('deletes a folder and moves its documents to root', async () => {
      const f = await Folder.create({ name: 'Temp', ownerId });
      const doc = await CollabDocument.create({ title: 'Inside', ownerId, folderId: f._id });

      const res = await request(app).delete(`/api/folders/${f.id}`).set(auth(ownerToken));
      expect(res.status).toBe(200);

      const reloaded = await CollabDocument.findById(doc.id);
      expect(reloaded!.folderId).toBeNull();
      expect(await Folder.findById(f.id)).toBeNull();
    });

    it('forbids deleting someone else\'s folder', async () => {
      const f = await Folder.create({ name: 'Theirs', ownerId });
      const res = await request(app).delete(`/api/folders/${f.id}`).set(auth(otherToken));
      expect(res.status).toBe(403);
    });
  });

  describe('document move + folder filter', () => {
    it('moves a document into a folder and back to root', async () => {
      const f = await Folder.create({ name: 'Box', ownerId });
      const doc = await CollabDocument.create({ title: 'Movable', ownerId });

      const into = await request(app).patch(`/api/docs/${doc.id}`).set(auth(ownerToken)).send({ folderId: f.id });
      expect(into.status).toBe(200);
      expect(String(into.body.folderId)).toBe(f.id);

      const out = await request(app).patch(`/api/docs/${doc.id}`).set(auth(ownerToken)).send({ folderId: null });
      expect(out.status).toBe(200);
      expect(out.body.folderId).toBeNull();
    });

    it('rejects moving into a folder you do not own', async () => {
      const f = await Folder.create({ name: 'Not yours', ownerId: otherId });
      const doc = await CollabDocument.create({ title: 'Mine', ownerId });
      const res = await request(app).patch(`/api/docs/${doc.id}`).set(auth(ownerToken)).send({ folderId: f.id });
      expect(res.status).toBe(404);
    });

    it('lists documents filtered by folderId', async () => {
      const f = await Folder.create({ name: 'Filtered', ownerId });
      await CollabDocument.create({ title: 'In folder', ownerId, folderId: f._id });
      await CollabDocument.create({ title: 'At root', ownerId });

      const inFolder = await request(app).get(`/api/docs?folderId=${f.id}`).set(auth(ownerToken));
      expect(inFolder.status).toBe(200);
      expect(inFolder.body).toHaveLength(1);
      expect(inFolder.body[0].title).toBe('In folder');

      const atRoot = await request(app).get('/api/docs?folderId=root').set(auth(ownerToken));
      expect(atRoot.body.every((d: { title: string }) => d.title === 'At root')).toBe(true);
    });
  });
});
