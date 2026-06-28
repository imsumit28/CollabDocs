import { notifyDocumentMentions } from '../../utils/notifications';
import { User, CollabDocument, Notification } from '../../models';
import { Types } from 'mongoose';

async function makeUser(username: string) {
  return User.create({
    email: `${username}@example.com`,
    displayName: username,
    username,
    passwordHash: 'x',
  });
}

describe('notifyDocumentMentions', () => {
  it('notifies a mentioned collaborator (not the editor)', async () => {
    const owner = await makeUser('alice');
    const collab = await makeUser('bob');
    const doc = await CollabDocument.create({
      title: 'Spec',
      ownerId: owner._id,
      collaborators: [{ userId: collab._id, permission: 'edit' }],
    });

    const created = await notifyDocumentMentions({
      documentId: doc.id,
      actorId: owner.id,
      actorName: 'alice',
      text: 'Hey @bob please review this',
    });

    expect(created).toBe(1);
    const notes = await Notification.find({ recipientId: collab._id });
    expect(notes).toHaveLength(1);
    expect(notes[0].type).toBe('mention');
  });

  it('does not notify the same handle twice', async () => {
    const owner = await makeUser('carol');
    const collab = await makeUser('dave');
    const doc = await CollabDocument.create({
      title: 'Doc',
      ownerId: owner._id,
      collaborators: [{ userId: collab._id, permission: 'edit' }],
    });

    await notifyDocumentMentions({ documentId: doc.id, actorId: owner.id, actorName: 'carol', text: 'ping @dave' });
    const second = await notifyDocumentMentions({ documentId: doc.id, actorId: owner.id, actorName: 'carol', text: 'ping @dave again' });

    expect(second).toBe(0);
    expect(await Notification.countDocuments({ recipientId: collab._id })).toBe(1);
  });

  it('never notifies the editor about their own mention', async () => {
    const owner = await makeUser('erin');
    const doc = await CollabDocument.create({ title: 'Solo', ownerId: owner._id, collaborators: [] });

    const created = await notifyDocumentMentions({
      documentId: doc.id,
      actorId: owner.id,
      actorName: 'erin',
      text: 'note to self @erin',
    });

    expect(created).toBe(0);
  });

  it('ignores handles that match no participant', async () => {
    const owner = await makeUser('frank');
    const collab = await makeUser('grace');
    const doc = await CollabDocument.create({
      title: 'Doc',
      ownerId: owner._id,
      collaborators: [{ userId: collab._id, permission: 'edit' }],
    });

    const created = await notifyDocumentMentions({
      documentId: doc.id,
      actorId: owner.id,
      actorName: 'frank',
      text: 'hello @nobody and @stranger',
    });

    expect(created).toBe(0);
  });

  it('returns 0 when there are no mentions', async () => {
    const owner = await makeUser('heidi');
    const doc = await CollabDocument.create({ title: 'Plain', ownerId: owner._id, collaborators: [] });
    const created = await notifyDocumentMentions({ documentId: doc.id, actorId: owner.id, actorName: 'heidi', text: 'no mentions here' });
    expect(created).toBe(0);
  });

  it('returns 0 for a missing document', async () => {
    const created = await notifyDocumentMentions({
      documentId: new Types.ObjectId().toString(),
      actorId: new Types.ObjectId().toString(),
      actorName: 'x',
      text: '@someone',
    });
    expect(created).toBe(0);
  });
});
