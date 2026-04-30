import request from 'supertest';
import express, { Express } from 'express';
import commentRoutes from '../../routes/comments';
import { createTestUser, cleanupTestDB } from '../helpers';
import { CollabDocument, Comment } from '../../models';
import cookieParser from 'cookie-parser';

describe('Comment Routes', () => {
  let app: Express;
  let userToken: string;
  let userId: string;
  let docId: string;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/comments', commentRoutes);

    const { accessToken, user } = await createTestUser(app);
    userToken = accessToken;
    userId = user.id;
  });

  beforeEach(async () => {
    const doc = await CollabDocument.create({
      title: 'Test Doc',
      ownerId: userId,
    });
    docId = doc._id.toString();
  });

  afterEach(async () => {
    await Comment.deleteMany({});
    await CollabDocument.deleteMany({});
  });

  describe('POST / - Create comment', () => {
    it('should create a new comment', async () => {
      const res = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          docId,
          text: 'This needs work',
          startPos: 0,
          endPos: 5,
        });

      expect(res.status).toBe(201);
      expect(res.body).toEqual(expect.objectContaining({
        text: 'This needs work',
        docId,
        authorId: userId,
      }));
      expect(res.body).toHaveProperty('_id');
    });

    it('should reject comment without text', async () => {
      const res = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          docId,
          startPos: 0,
          endPos: 5,
        });

      expect(res.status).toBe(400);
    });

    it('should reject without authentication', async () => {
      const res = await request(app)
        .post('/api/comments')
        .send({
          docId,
          text: 'Unauthorized comment',
        });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /doc/:docId - Get document comments', () => {
    beforeEach(async () => {
      await Comment.create([
        {
          docId,
          text: 'Comment 1',
          authorId: userId,
          startPos: 0,
          endPos: 5,
        },
        {
          docId,
          text: 'Comment 2',
          authorId: userId,
          startPos: 10,
          endPos: 15,
        },
      ]);
    });

    it('should return all comments for document', async () => {
      const res = await request(app)
        .get(`/api/comments/doc/${docId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2);
    });

    it('should return empty array for document with no comments', async () => {
      const newDoc = await CollabDocument.create({
        title: 'Empty Doc',
        ownerId: userId,
      });

      const res = await request(app)
        .get(`/api/comments/doc/${newDoc._id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('POST /:id/reply - Reply to comment', () => {
    let commentId: string;

    beforeEach(async () => {
      const comment = await Comment.create({
        docId,
        text: 'Original comment',
        authorId: userId,
        startPos: 0,
        endPos: 5,
      });
      commentId = comment._id.toString();
    });

    it('should add reply to comment', async () => {
      const res = await request(app)
        .post(`/api/comments/${commentId}/reply`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          text: 'I agree!',
        });

      expect(res.status).toBe(200);
      expect(res.body.replies).toContainEqual(expect.objectContaining({
        text: 'I agree!',
        authorId: userId,
      }));
    });

    it('should reject reply without text', async () => {
      const res = await request(app)
        .post(`/api/comments/${commentId}/reply`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /:id/resolve - Resolve comment', () => {
    let commentId: string;

    beforeEach(async () => {
      const comment = await Comment.create({
        docId,
        text: 'Issue to fix',
        authorId: userId,
        startPos: 0,
        endPos: 5,
      });
      commentId = comment._id.toString();
    });

    it('should resolve comment', async () => {
      const res = await request(app)
        .patch(`/api/comments/${commentId}/resolve`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ resolved: true });

      expect(res.status).toBe(200);
      expect(res.body.resolved).toBe(true);
    });

    it('should reopen comment', async () => {
      // First resolve it
      await request(app)
        .patch(`/api/comments/${commentId}/resolve`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ resolved: true });

      // Then reopen
      const res = await request(app)
        .patch(`/api/comments/${commentId}/resolve`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ resolved: false });

      expect(res.status).toBe(200);
      expect(res.body.resolved).toBe(false);
    });
  });
});
