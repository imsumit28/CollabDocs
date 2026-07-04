import { Types } from 'mongoose';
import { CollabDocument, PendingInvite } from '../models';
import { notifyShare } from './notifications';
import { logger } from './logger';

/**
 * Convert any share invitations addressed to `email` into real collaborator
 * grants on their documents, now that `userId` has proven ownership of that
 * address (email verification or Google OAuth).
 *
 * For each pending invite we add the user as a collaborator on the document
 * (deduping, and never on their own doc), fire the in-app "shared with you"
 * notification, then delete the pending record. Best-effort — a failure to claim
 * must never block the auth flow that triggered it. Returns how many invites were
 * claimed (handy for tests/logging).
 */
export async function claimPendingInvites(userId: string, email: string): Promise<number> {
  try {
    const normalized = email.toLowerCase().trim();
    const invites = await PendingInvite.find({ email: normalized });
    if (invites.length === 0) return 0;

    let claimed = 0;
    for (const invite of invites) {
      try {
        const doc = await CollabDocument.findById(invite.documentId);

        // Drop invites whose document vanished (deleted/purged) or that point at
        // the user's own document — nothing to grant in either case.
        const stale =
          !doc || doc.deletedAt || doc.ownerId.toString() === userId;

        if (!stale) {
          const already = doc!.collaborators.some((c) => c.userId.toString() === userId);
          if (!already) {
            doc!.collaborators.push({ userId: new Types.ObjectId(userId), permission: invite.permission });
            await doc!.save();
          }
          await notifyShare({
            recipientId: userId,
            actorId: invite.invitedBy.toString(),
            actorName: invite.invitedByName,
            documentId: doc!.id,
            documentTitle: doc!.title,
            permission: invite.permission,
          });
          claimed += 1;
        }

        await invite.deleteOne();
      } catch (err) {
        // Skip a single bad invite without aborting the rest.
        logger.warn({ err, inviteId: invite.id }, '[pendingInvites] failed to claim one invite');
      }
    }

    if (claimed > 0) logger.info({ userId, email: normalized, claimed }, '[pendingInvites] claimed invites');
    return claimed;
  } catch (err) {
    logger.error({ err, email }, '[pendingInvites] claim sweep failed');
    return 0;
  }
}
