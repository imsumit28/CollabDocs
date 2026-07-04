import { Types } from 'mongoose';
import { claimPendingInvites } from '../../utils/pendingInvites';
import { CollabDocument, PendingInvite, Notification, User } from '../../models';

describe('claimPendingInvites', () => {
  let ownerId: string;
  let inviterId: string;
  let claimerId: string;
  const claimerEmail = 'claimer@example.com';

  beforeEach(async () => {
    const [owner, inviter, claimer] = await User.create([
      { email: 'owner@example.com', displayName: 'Owner', passwordHash: 'x' },
      { email: 'inviter@example.com', displayName: 'Inviter', passwordHash: 'x' },
      { email: claimerEmail, displayName: 'Claimer', passwordHash: 'x' },
    ]);
    ownerId = owner.id;
    inviterId = inviter.id;
    claimerId = claimer.id;
  });

  async function makeInvite(documentId: Types.ObjectId, permission: 'view' | 'edit' = 'view', email = claimerEmail) {
    return PendingInvite.create({
      documentId,
      email,
      permission,
      invitedBy: inviterId,
      invitedByName: 'Inviter',
      documentTitle: 'Doc',
    });
  }

  it('adds the user as a collaborator, notifies them, and deletes the invite', async () => {
    const doc = await CollabDocument.create({ title: 'Doc', ownerId });
    await makeInvite(doc._id, 'edit');

    const claimed = await claimPendingInvites(claimerId, claimerEmail);
    expect(claimed).toBe(1);

    const updated = await CollabDocument.findById(doc._id).lean();
    expect(updated?.collaborators).toHaveLength(1);
    expect(updated?.collaborators[0]).toMatchObject({ permission: 'edit' });
    expect(updated?.collaborators[0].userId.toString()).toBe(claimerId);

    expect(await PendingInvite.countDocuments({ email: claimerEmail })).toBe(0);
    expect(await Notification.countDocuments({ recipientId: claimerId, type: 'share' })).toBe(1);
  });

  it('is case-insensitive on the email', async () => {
    const doc = await CollabDocument.create({ title: 'Doc', ownerId });
    await makeInvite(doc._id, 'view');
    const claimed = await claimPendingInvites(claimerId, 'ClAiMeR@Example.com');
    expect(claimed).toBe(1);
  });

  it('claims multiple invites across documents at once', async () => {
    const d1 = await CollabDocument.create({ title: 'D1', ownerId });
    const d2 = await CollabDocument.create({ title: 'D2', ownerId });
    await makeInvite(d1._id, 'view');
    await makeInvite(d2._id, 'edit');

    const claimed = await claimPendingInvites(claimerId, claimerEmail);
    expect(claimed).toBe(2);
    expect(await PendingInvite.countDocuments({ email: claimerEmail })).toBe(0);
  });

  it('does not duplicate when the user is already a collaborator', async () => {
    const doc = await CollabDocument.create({
      title: 'Doc',
      ownerId,
      collaborators: [{ userId: new Types.ObjectId(claimerId), permission: 'view' }],
    });
    await makeInvite(doc._id, 'edit');

    await claimPendingInvites(claimerId, claimerEmail);
    const updated = await CollabDocument.findById(doc._id).lean();
    expect(updated?.collaborators).toHaveLength(1); // not doubled
    // The invite is still consumed even though no new grant was needed.
    expect(await PendingInvite.countDocuments({ email: claimerEmail })).toBe(0);
  });

  it('drops an invite to the user\'s own document without adding them', async () => {
    const doc = await CollabDocument.create({ title: 'Doc', ownerId: claimerId });
    await makeInvite(doc._id, 'edit');

    const claimed = await claimPendingInvites(claimerId, claimerEmail);
    expect(claimed).toBe(0); // owner, nothing to grant
    const updated = await CollabDocument.findById(doc._id).lean();
    expect(updated?.collaborators).toHaveLength(0);
    expect(await PendingInvite.countDocuments({ email: claimerEmail })).toBe(0); // still cleaned up
  });

  it('drops an invite whose document was deleted (soft-deleted)', async () => {
    const doc = await CollabDocument.create({ title: 'Doc', ownerId, deletedAt: new Date() });
    await makeInvite(doc._id, 'view');

    const claimed = await claimPendingInvites(claimerId, claimerEmail);
    expect(claimed).toBe(0);
    expect(await PendingInvite.countDocuments({ email: claimerEmail })).toBe(0);
  });

  it('returns 0 and does nothing when there are no invites', async () => {
    const claimed = await claimPendingInvites(claimerId, 'nobody@example.com');
    expect(claimed).toBe(0);
  });
});
