import request from 'supertest';
import express, { Express } from 'express';
import { Types } from 'mongoose';
import documentRoutes from '../../routes/documents';
import { generateAccessToken } from '../helpers';
import { CollabDocument, User } from '../../models';
import cookieParser from 'cookie-parser';

describe('Document Routes', () => {
  let app: Express;
  let user1Token: string;
  let user2Token: string;
  let user1Id: string;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/docs', documentRoutes);

    // The document routes only read req.user.sub from the verified JWT — they
    // never look the user up in the DB — so signed tokens are all we need.
    user1Id = new Types.ObjectId().toString();
    user1Token = generateAccessToken(user1Id);
    user2Token = generateAccessToken(new Types.ObjectId().toString());
  });

  afterEach(async () => {
    await CollabDocument.deleteMany({});
  });

  describe('POST / - Create document', () => {
    it('should create a new document', async () => {
      const res = await request(app)
        .post('/api/docs')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'My Document',
        });

      expect(res.status).toBe(201);
      expect(res.body).toEqual(expect.objectContaining({
        title: 'My Document',
        ownerId: user1Id,
      }));
      expect(res.body).toHaveProperty('_id');
    });

    it('should create document with default title', async () => {
      const res = await request(app)
        .post('/api/docs')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({});

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Untitled');
    });

    it('should reject without authentication', async () => {
      const res = await request(app)
        .post('/api/docs')
        .send({ title: 'Unauthorized' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET / - List documents', () => {
    beforeEach(async () => {
      // Create documents for user1
      await CollabDocument.create([
        { title: 'Doc 1', ownerId: user1Id },
        { title: 'Doc 2', ownerId: user1Id },
      ]);
    });

    it('should return user\'s documents', async () => {
      const res = await request(app)
        .get('/api/docs')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2);
      expect(res.body[0].title).toMatch(/Doc [12]/);
    });

    it('should not include yjsState in list', async () => {
      const res = await request(app)
        .get('/api/docs')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body[0]).not.toHaveProperty('yjsState');
    });

    it('should reject without authentication', async () => {
      const res = await request(app)
        .get('/api/docs');

      expect(res.status).toBe(401);
    });

    it('should return a paginated envelope when ?page is provided', async () => {
      const res = await request(app)
        .get('/api/docs?page=1&limit=1')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(false);
      expect(res.body).toEqual(
        expect.objectContaining({ total: 2, page: 1, limit: 1, totalPages: 2, hasMore: true }),
      );
      expect(res.body.items).toHaveLength(1);
    });

    it('should return the second page with no more results', async () => {
      const res = await request(app)
        .get('/api/docs?page=2&limit=1')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.page).toBe(2);
      expect(res.body.hasMore).toBe(false);
      expect(res.body.items).toHaveLength(1);
    });

    it('should clamp an out-of-range limit', async () => {
      const res = await request(app)
        .get('/api/docs?page=1&limit=9999')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.limit).toBe(100);
    });
  });

  describe('GET /:id - Get single document', () => {
    let docId: string;

    beforeEach(async () => {
      const doc = await CollabDocument.create({
        title: 'Test Doc',
        ownerId: user1Id,
      });
      docId = doc._id.toString();
    });

    it('should return document for owner', async () => {
      const res = await request(app)
        .get(`/api/docs/${docId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.document.title).toBe('Test Doc');
      expect(res.body.permission).toBe('owner');
    });

    it('should reject access for unauthorized user', async () => {
      const res = await request(app)
        .get(`/api/docs/${docId}`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Access denied');
    });

    it('should return 404 for non-existent document', async () => {
      const res = await request(app)
        .get('/api/docs/507f1f77bcf86cd799439999')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /:id - Update document title', () => {
    let docId: string;

    beforeEach(async () => {
      const doc = await CollabDocument.create({
        title: 'Old Title',
        ownerId: user1Id,
      });
      docId = doc._id.toString();
    });

    it('should update document title', async () => {
      const res = await request(app)
        .patch(`/api/docs/${docId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ title: 'New Title' });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('New Title');
    });

    it('should reject update from non-owner', async () => {
      const res = await request(app)
        .patch(`/api/docs/${docId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ title: 'Hacked Title' });

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /:id - Soft delete document', () => {
    let docId: string;

    beforeEach(async () => {
      const doc = await CollabDocument.create({
        title: 'To Delete',
        ownerId: user1Id,
      });
      docId = doc._id.toString();
    });

    it('should soft delete document', async () => {
      const res = await request(app)
        .delete(`/api/docs/${docId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);

      // Verify it's in trash
      const trashRes = await request(app)
        .get('/api/docs/trash')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(trashRes.body.length).toBe(1);
      expect(trashRes.body[0]._id).toBe(docId);
    });

    it('should reject delete from non-owner', async () => {
      const res = await request(app)
        .delete(`/api/docs/${docId}`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /:id/share - Share document', () => {
    let docId: string;

    beforeEach(async () => {
      const doc = await CollabDocument.create({
        title: 'Share Me',
        ownerId: user1Id,
      });
      docId = doc._id.toString();
    });

    it('should create share link with view permission', async () => {
      const res = await request(app)
        .post(`/api/docs/${docId}/share`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ permission: 'view' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('shareLink');
      expect(res.body).toHaveProperty('shareUrl');
      expect(res.body.shareLinkPermission).toBe('view');
    });

    it('should reject share from non-owner', async () => {
      const res = await request(app)
        .post(`/api/docs/${docId}/share`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ permission: 'edit' });

      expect(res.status).toBe(403);
    });

    it('should disable share link', async () => {
      // Create share link
      await request(app)
        .post(`/api/docs/${docId}/share`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ permission: 'view' });

      // Disable it
      const res = await request(app)
        .post(`/api/docs/${docId}/share`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ disable: true });

      expect(res.status).toBe(200);
      expect(res.body.shareLink).toBeNull();
    });
  });

  describe('GET /search', () => {
    beforeEach(async () => {
      await CollabDocument.create([
        { title: 'Quarterly Report', ownerId: user1Id, contentText: 'revenue and growth figures' },
        { title: 'Holiday Plans', ownerId: user1Id, contentText: 'beach trip in summer' },
        { title: 'Secret', ownerId: user1Id, contentText: 'revenue projections', deletedAt: new Date() },
      ]);
      // a doc owned by another user that mentions "revenue"
      await CollabDocument.create({ title: 'Other revenue doc', ownerId: '507f1f77bcf86cd799439abc', contentText: 'revenue' });
    });

    it('finds documents by title', async () => {
      const res = await request(app).get('/api/docs/search?q=holiday').set('Authorization', `Bearer ${user1Token}`);
      expect(res.status).toBe(200);
      expect(res.body.map((d: any) => d.title)).toContain('Holiday Plans');
    });

    it('finds documents by content text', async () => {
      const res = await request(app).get('/api/docs/search?q=growth').set('Authorization', `Bearer ${user1Token}`);
      expect(res.body.map((d: any) => d.title)).toContain('Quarterly Report');
    });

    it('excludes trashed documents and other users\' documents', async () => {
      const res = await request(app).get('/api/docs/search?q=revenue').set('Authorization', `Bearer ${user1Token}`);
      const titles = res.body.map((d: any) => d.title);
      expect(titles).toContain('Quarterly Report');
      expect(titles).not.toContain('Secret');         // trashed
      expect(titles).not.toContain('Other revenue doc'); // another owner
    });

    it('never returns yjsState or contentText', async () => {
      const res = await request(app).get('/api/docs/search?q=report').set('Authorization', `Bearer ${user1Token}`);
      expect(res.body[0]).not.toHaveProperty('yjsState');
      expect(res.body[0]).not.toHaveProperty('contentText');
    });

    it('returns an empty array for a blank query', async () => {
      const res = await request(app).get('/api/docs/search?q=').set('Authorization', `Bearer ${user1Token}`);
      expect(res.body).toEqual([]);
    });

    it('requires authentication', async () => {
      const res = await request(app).get('/api/docs/search?q=x');
      expect(res.status).toBe(401);
    });
  });

  describe('Collaborators — invite by email', () => {
    let ownerToken: string;
    let ownerId: string;
    let inviteeId: string;
    let docId: string;

    beforeEach(async () => {
      const owner = await User.create({ email: 'owner@example.com', displayName: 'Owner', passwordHash: 'x' });
      const invitee = await User.create({ email: 'invitee@example.com', displayName: 'Invitee', passwordHash: 'x' });
      ownerId = owner.id;
      inviteeId = invitee.id;
      ownerToken = generateAccessToken(ownerId);
      const doc = await CollabDocument.create({ title: 'Shared Doc', ownerId });
      docId = doc.id;
    });

    const ownerAuth = () => ({ Authorization: `Bearer ${ownerToken}` });

    it('invites a user by email with the given permission', async () => {
      const res = await request(app)
        .post(`/api/docs/${docId}/collaborators`)
        .set(ownerAuth())
        .send({ email: 'invitee@example.com', permission: 'edit' });

      expect(res.status).toBe(201);
      expect(res.body.collaborators).toHaveLength(1);
      expect(res.body.collaborators[0]).toMatchObject({
        userId: inviteeId,
        email: 'invitee@example.com',
        displayName: 'Invitee',
        permission: 'edit',
      });
    });

    it('defaults to view permission', async () => {
      const res = await request(app)
        .post(`/api/docs/${docId}/collaborators`)
        .set(ownerAuth())
        .send({ email: 'invitee@example.com' });
      expect(res.body.collaborators[0].permission).toBe('view');
    });

    it('updates permission when inviting an existing collaborator again', async () => {
      await request(app).post(`/api/docs/${docId}/collaborators`).set(ownerAuth()).send({ email: 'invitee@example.com', permission: 'view' });
      const res = await request(app).post(`/api/docs/${docId}/collaborators`).set(ownerAuth()).send({ email: 'invitee@example.com', permission: 'edit' });
      expect(res.body.collaborators).toHaveLength(1);
      expect(res.body.collaborators[0].permission).toBe('edit');
    });

    it('404 when no user has that email', async () => {
      const res = await request(app).post(`/api/docs/${docId}/collaborators`).set(ownerAuth()).send({ email: 'ghost@example.com' });
      expect(res.status).toBe(404);
    });

    it('400 for a malformed email', async () => {
      const res = await request(app).post(`/api/docs/${docId}/collaborators`).set(ownerAuth()).send({ email: 'not-an-email' });
      expect(res.status).toBe(400);
    });

    it('400 when the owner invites themselves', async () => {
      const res = await request(app).post(`/api/docs/${docId}/collaborators`).set(ownerAuth()).send({ email: 'owner@example.com' });
      expect(res.status).toBe(400);
    });

    it('403 when a non-owner tries to invite', async () => {
      const stranger = generateAccessToken(inviteeId);
      const res = await request(app).post(`/api/docs/${docId}/collaborators`).set({ Authorization: `Bearer ${stranger}` }).send({ email: 'invitee@example.com' });
      expect(res.status).toBe(403);
    });

    it('lists collaborators with owner info', async () => {
      await request(app).post(`/api/docs/${docId}/collaborators`).set(ownerAuth()).send({ email: 'invitee@example.com', permission: 'edit' });
      const res = await request(app).get(`/api/docs/${docId}/collaborators`).set(ownerAuth());
      expect(res.status).toBe(200);
      expect(res.body.owner).toMatchObject({ email: 'owner@example.com' });
      expect(res.body.collaborators).toHaveLength(1);
    });

    it('removes a collaborator', async () => {
      await request(app).post(`/api/docs/${docId}/collaborators`).set(ownerAuth()).send({ email: 'invitee@example.com' });
      const res = await request(app).delete(`/api/docs/${docId}/collaborators/${inviteeId}`).set(ownerAuth());
      expect(res.status).toBe(200);
      expect(res.body.collaborators).toHaveLength(0);
    });

    it('403 when a non-owner tries to remove a collaborator', async () => {
      await request(app).post(`/api/docs/${docId}/collaborators`).set(ownerAuth()).send({ email: 'invitee@example.com' });
      const stranger = generateAccessToken(inviteeId);
      const res = await request(app).delete(`/api/docs/${docId}/collaborators/${inviteeId}`).set({ Authorization: `Bearer ${stranger}` });
      expect(res.status).toBe(403);
    });
  });
});
