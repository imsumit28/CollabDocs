import request from 'supertest';
import express, { Express } from 'express';
import { Types } from 'mongoose';
import cookieParser from 'cookie-parser';
import documentRoutes from '../routes/documents';
import versionRoutes from '../routes/versions';
import commentRoutes from '../routes/comments';
import { generateAccessToken } from './helpers';
import { CollabDocument, Comment } from '../models';

// Security & robustness checks: DoS regression guards, cross-user IDOR, content
// storage (XSS), malformed JSON, and that the rate limiter actually triggers.
describe('security & robustness', () => {
  const userA = new Types.ObjectId().toString();
  const userB = new Types.ObjectId().toString();
  const tokA = generateAccessToken(userA);
  const tokB = generateAccessToken(userB);
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  function appWith(mount: (app: Express) => void): Express {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    mount(app);
    // Mirror the production global error handler: pass 4xx through, else 500.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    app.use((err: any, _req: any, res: any, _next: any) => {
      const status = err?.status ?? err?.statusCode;
      if (status && status >= 400 && status < 500) { res.status(status).json({ error: err.message }); return; }
      res.status(500).json({ error: 'Internal server error' });
    });
    return app;
  }

  afterEach(async () => {
    await CollabDocument.deleteMany({});
    await Comment.deleteMany({});
  });

  // ─── DoS regression: malformed ObjectId must not hang ─────────────────────────
  describe('malformed :id does not hang the request (DoS regression)', () => {
    it('versions GET/POST reject a malformed :docId with 400', async () => {
      const app = appWith((a) => a.use('/api/versions', versionRoutes));
      const list = await request(app).get('/api/versions/not-an-id').set(auth(tokA));
      expect(list.status).toBe(400);
      const save = await request(app).post('/api/versions/not-an-id').set(auth(tokA));
      expect(save.status).toBe(400);
    });

    it('versions restore rejects a malformed :id with 400', async () => {
      const app = appWith((a) => a.use('/api/versions', versionRoutes));
      const res = await request(app).post('/api/versions/bad-id/restore').set(auth(tokA));
      expect(res.status).toBe(400);
    });

    it('documents routes reject a malformed :id with 400', async () => {
      const app = appWith((a) => a.use('/api/docs', documentRoutes));
      for (const path of ['/api/docs/xx', '/api/docs/xx/share', '/api/docs/xx/collaborators']) {
        const res = await request(app).get(path).set(auth(tokA));
        expect([400, 404]).toContain(res.status); // 400 from the id guard (never a hang)
      }
    });
  });

  // ─── IDOR: cross-user access is denied ────────────────────────────────────────
  describe('IDOR — cross-user access control', () => {
    it("user B cannot read, edit, or delete user A's document", async () => {
      const app = appWith((a) => a.use('/api/docs', documentRoutes));
      const doc = await CollabDocument.create({ title: 'A private', ownerId: userA });

      expect((await request(app).get(`/api/docs/${doc.id}`).set(auth(tokB))).status).toBe(403);
      expect((await request(app).patch(`/api/docs/${doc.id}`).set(auth(tokB)).send({ title: 'hax' })).status).toBe(403);
      expect((await request(app).delete(`/api/docs/${doc.id}`).set(auth(tokB))).status).toBe(403);

      const fresh = await CollabDocument.findById(doc.id);
      expect(fresh!.title).toBe('A private'); // untouched
    });

    it("a stranger cannot save a version to user A's document (403)", async () => {
      const app = appWith((a) => a.use('/api/versions', versionRoutes));
      const doc = await CollabDocument.create({ title: 'A doc', ownerId: userA });
      const res = await request(app).post(`/api/versions/${doc.id}`).set(auth(tokB));
      expect(res.status).toBe(403);
    });

    it("a stranger cannot delete user A's comment (403)", async () => {
      const app = appWith((a) => a.use('/api/comments', commentRoutes));
      const doc = await CollabDocument.create({ title: 'A doc', ownerId: userA });
      const comment = await Comment.create({ documentId: doc.id, authorId: userA, anchorText: 'x', body: 'mine' });
      const res = await request(app).delete(`/api/comments/${comment.id}`).set(auth(tokB));
      expect(res.status).toBe(403);
      expect(await Comment.findById(comment.id)).not.toBeNull();
    });
  });

  // ─── Content storage: server does not mutate user content (client must escape) ─
  describe('content storage (XSS boundary)', () => {
    it('stores a document title containing HTML verbatim (React escapes on render)', async () => {
      const app = appWith((a) => a.use('/api/docs', documentRoutes));
      const xss = '<img src=x onerror=alert(1)>';
      const res = await request(app).post('/api/docs').set(auth(tokA)).send({ title: xss });
      expect(res.status).toBe(201);
      // The server persists the raw string unchanged — it is the client's job to
      // escape on render (React does by default). This test documents that the
      // API is NOT an XSS sanitizer, so any raw-HTML sink on the client is unsafe.
      expect(res.body.title).toBe(xss);
    });

    it('stores a comment body containing a script tag verbatim', async () => {
      const app = appWith((a) => a.use('/api/comments', commentRoutes));
      const doc = await CollabDocument.create({ title: 'D', ownerId: userA });
      const xss = '<script>steal(document.cookie)</script>';
      const res = await request(app).post('/api/comments').set(auth(tokA)).send({ documentId: doc.id, anchorText: 'a', body: xss });
      expect(res.status).toBe(201);
      expect(res.body.body).toBe(xss);
    });
  });

  // ─── Malformed JSON body ──────────────────────────────────────────────────────
  describe('malformed JSON', () => {
    it('returns 400 for a malformed JSON body (not a hang or 500)', async () => {
      const app = appWith((a) => a.use('/api/docs', documentRoutes));
      const res = await request(app)
        .post('/api/docs')
        .set(auth(tokA))
        .set('Content-Type', 'application/json')
        .send('{ this is not valid json ');
      // body-parser raises a SyntaxError with status 400; the global error
      // handler now passes that through instead of masking it as 500.
      expect(res.status).toBe(400);
    });
  });

  // ─── Rate limiting actually triggers ──────────────────────────────────────────
  describe('rate limiter triggers when not skipped', () => {
    const savedWorker = process.env.JEST_WORKER_ID;
    const savedNodeEnv = process.env.NODE_ENV;

    afterEach(() => {
      if (savedWorker !== undefined) process.env.JEST_WORKER_ID = savedWorker;
      process.env.NODE_ENV = savedNodeEnv;
    });

    it('returns 429 after exceeding the signup limit (max 5 / 15 min)', async () => {
      // The limiter's skip() reads env at request time, so flipping these makes the
      // real, exported limiter active for this test only.
      delete process.env.JEST_WORKER_ID;
      process.env.NODE_ENV = 'production';
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { signupRateLimit } = require('../middleware/rateLimit');

      const app = express();
      app.use(express.json());
      app.use('/hit', signupRateLimit, (_req: any, res: any) => res.json({ ok: true }));

      const statuses: number[] = [];
      for (let i = 0; i < 7; i++) {
        const r = await request(app).post('/hit').send({});
        statuses.push(r.status);
      }
      expect(statuses.filter((s) => s === 200)).toHaveLength(5);
      expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0);
    });
  });
});
