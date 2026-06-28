import request from 'supertest';
import express, { Express } from 'express';
import { Types } from 'mongoose';
import notificationRoutes from '../../routes/notifications';
import { generateAccessToken } from '../helpers';
import { Notification, User } from '../../models';
import { notifyShare, notifyComment } from '../../utils/notifications';

describe('Notifications', () => {
  let app: Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/notifications', notificationRoutes);
  });

  const auth = (id: string) => ({ Authorization: `Bearer ${generateAccessToken(id)}` });

  describe('notifyShare', () => {
    it('creates a share notification for the recipient', async () => {
      const recipient = new Types.ObjectId().toString();
      const actor = new Types.ObjectId().toString();
      const docId = new Types.ObjectId().toString();
      await notifyShare({ recipientId: recipient, actorId: actor, actorName: 'Owner', documentId: docId, documentTitle: 'Plan', permission: 'edit' });

      const n = await Notification.findOne({ recipientId: recipient });
      expect(n).not.toBeNull();
      expect(n!.type).toBe('share');
      expect(n!.documentTitle).toBe('Plan');
      expect(n!.snippet).toMatch(/can edit/);
    });
  });

  describe('notifyComment', () => {
    it('notifies participants (mention vs comment) and never the author', async () => {
      const [owner, alice, bob, author] = await User.create([
        { email: 'owner@ex.com', displayName: 'Owner', passwordHash: 'x', username: 'owner' },
        { email: 'alice@ex.com', displayName: 'Alice', passwordHash: 'x', username: 'alice' },
        { email: 'bob@ex.com', displayName: 'Bob', passwordHash: 'x', username: 'bob' },
        { email: 'author@ex.com', displayName: 'Author', passwordHash: 'x', username: 'author' },
      ]);

      const doc = {
        _id: new Types.ObjectId(),
        ownerId: owner._id,
        collaborators: [
          { userId: alice._id, permission: 'edit' as const },
          { userId: bob._id, permission: 'view' as const },
          { userId: author._id, permission: 'edit' as const },
        ],
        title: 'Spec',
      };

      await notifyComment({ doc: doc as any, authorId: author.id, authorName: 'Author', body: 'Hey @alice please review' });

      const all = await Notification.find({}).lean();
      const byRecipient = new Map(all.map((n) => [n.recipientId.toString(), n]));

      expect(byRecipient.get(author.id)).toBeUndefined();        // author not notified
      expect(byRecipient.get(alice.id)!.type).toBe('mention');   // @alice → mention
      expect(byRecipient.get(bob.id)!.type).toBe('comment');
      expect(byRecipient.get(owner.id)!.type).toBe('comment');
    });
  });

  describe('routes', () => {
    it('lists notifications with an unread count', async () => {
      const userId = new Types.ObjectId().toString();
      const docId = new Types.ObjectId().toString();
      await Notification.create([
        { recipientId: userId, type: 'comment', documentId: docId, documentTitle: 'A', read: false },
        { recipientId: userId, type: 'share', documentId: docId, documentTitle: 'B', read: true },
      ]);

      const res = await request(app).get('/api/notifications').set(auth(userId));
      expect(res.status).toBe(200);
      expect(res.body.notifications).toHaveLength(2);
      expect(res.body.unread).toBe(1);
    });

    it('marks one notification as read', async () => {
      const userId = new Types.ObjectId().toString();
      const n = await Notification.create({ recipientId: userId, type: 'comment', documentId: new Types.ObjectId(), documentTitle: 'A', read: false });
      const res = await request(app).patch(`/api/notifications/${n.id}/read`).set(auth(userId));
      expect(res.status).toBe(200);
      expect((await Notification.findById(n.id))!.read).toBe(true);
    });

    it("won't mark another user's notification (404)", async () => {
      const owner = new Types.ObjectId().toString();
      const other = new Types.ObjectId().toString();
      const n = await Notification.create({ recipientId: owner, type: 'comment', documentId: new Types.ObjectId(), documentTitle: 'A' });
      const res = await request(app).patch(`/api/notifications/${n.id}/read`).set(auth(other));
      expect(res.status).toBe(404);
    });

    it('marks all as read', async () => {
      const userId = new Types.ObjectId().toString();
      await Notification.create([
        { recipientId: userId, type: 'comment', documentId: new Types.ObjectId(), documentTitle: 'A', read: false },
        { recipientId: userId, type: 'comment', documentId: new Types.ObjectId(), documentTitle: 'B', read: false },
      ]);
      const res = await request(app).post('/api/notifications/read-all').set(auth(userId));
      expect(res.status).toBe(200);
      expect(await Notification.countDocuments({ recipientId: userId, read: false })).toBe(0);
    });

    it('requires authentication', async () => {
      const res = await request(app).get('/api/notifications');
      expect(res.status).toBe(401);
    });
  });
});
