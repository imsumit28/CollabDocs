import { Types } from 'mongoose';
import { Notification, User, CollabDocument, IDocument } from '../models';

function snippet(text: string, max = 140): string {
  const t = text.trim().replace(/\s+/g, ' ');
  return t.length > max ? t.slice(0, max) + '…' : t;
}

/** Notify a user that a document was shared with them. */
export async function notifyShare(opts: {
  recipientId: string | Types.ObjectId;
  actorId: string;
  actorName: string;
  documentId: string | Types.ObjectId;
  documentTitle: string;
  permission: string;
}): Promise<void> {
  try {
    await Notification.create({
      recipientId: opts.recipientId,
      actorId: opts.actorId,
      actorName: opts.actorName,
      type: 'share',
      documentId: opts.documentId,
      documentTitle: opts.documentTitle || 'Untitled',
      snippet: `shared this document with you (${opts.permission === 'edit' ? 'can edit' : 'can view'})`,
    });
  } catch { /* notifications are best-effort */ }
}

/**
 * Notify participants @mentioned inside the document body itself (not a comment).
 * Called from the debounced socket save. Dedupes against the document's
 * `notifiedMentions` so editing the same doc doesn't re-notify the same handle.
 * `actorId` is the user whose edits triggered this save (best-effort attribution).
 * Returns the number of notifications created (handy for tests).
 */
export async function notifyDocumentMentions(opts: {
  documentId: string | Types.ObjectId;
  actorId: string;
  actorName: string;
  text: string;
}): Promise<number> {
  try {
    const handles = parseMentions(opts.text);
    if (handles.size === 0) return 0;

    const doc = await CollabDocument.findById(opts.documentId)
      .select('ownerId collaborators title notifiedMentions')
      .lean();
    if (!doc) return 0;

    const alreadyNotified = new Set((doc.notifiedMentions || []).map((h) => h.toLowerCase()));
    const newHandles = new Set([...handles].filter((h) => !alreadyNotified.has(h)));
    if (newHandles.size === 0) return 0;

    // Candidate recipients: owner + collaborators, excluding the editor.
    const participantIds = [
      doc.ownerId.toString(),
      ...doc.collaborators.map((c) => c.userId.toString()),
    ].filter((id, i, arr) => id !== opts.actorId && arr.indexOf(id) === i);
    if (participantIds.length === 0) return 0;

    const users = await User.find({ _id: { $in: participantIds } }, 'username').lean();
    const matched = users.filter(
      (u) => u.username && newHandles.has(u.username.toLowerCase()),
    );
    if (matched.length === 0) return 0;

    await Notification.insertMany(
      matched.map((u) => ({
        recipientId: u._id,
        actorId: opts.actorId,
        actorName: opts.actorName,
        type: 'mention',
        documentId: (doc as any)._id,
        documentTitle: doc.title || 'Untitled',
        snippet: `mentioned you in this document`,
      })),
    );

    // Remember the handles we actually notified so we don't repeat them.
    const matchedHandles = matched.map((u) => u.username!.toLowerCase());
    await CollabDocument.findByIdAndUpdate(opts.documentId, {
      $addToSet: { notifiedMentions: { $each: matchedHandles } },
    });

    return matched.length;
  } catch {
    return 0; // best-effort
  }
}

// Parse @handles (matching the username normalisation: a-z0-9_)
function parseMentions(body: string): Set<string> {
  const handles = new Set<string>();
  const re = /@([a-z0-9_]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) handles.add(m[1].toLowerCase());
  return handles;
}

/**
 * Notify a document's participants (owner + collaborators) about a new comment.
 * Participants named via @handle get a 'mention'; everyone else gets a 'comment'.
 * The comment's author is never notified about their own comment.
 */
export async function notifyComment(opts: {
  doc: Pick<IDocument, 'ownerId' | 'collaborators' | 'title'> & { _id: Types.ObjectId | string };
  authorId: string;
  authorName: string;
  body: string;
}): Promise<void> {
  try {
    const { doc, authorId } = opts;

    const participantIds = [
      doc.ownerId.toString(),
      ...doc.collaborators.map((c) => c.userId.toString()),
    ].filter((id, i, arr) => id !== authorId && arr.indexOf(id) === i);

    if (participantIds.length === 0) return;

    const mentioned = parseMentions(opts.body);
    // Map usernames → userId for mention matching (only among participants)
    const users = await User.find({ _id: { $in: participantIds } }, 'username').lean();
    const mentionedIds = new Set(
      users.filter((u) => u.username && mentioned.has(u.username.toLowerCase())).map((u) => u._id.toString())
    );

    const docId = (doc as any)._id;
    const docs = participantIds.map((recipientId) => ({
      recipientId,
      actorId: authorId,
      actorName: opts.authorName,
      type: mentionedIds.has(recipientId) ? 'mention' : 'comment',
      documentId: docId,
      documentTitle: doc.title || 'Untitled',
      snippet: snippet(opts.body),
    }));

    await Notification.insertMany(docs);
  } catch { /* best-effort */ }
}
