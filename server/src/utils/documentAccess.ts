import crypto from 'crypto';
import { CollabDocument, IDocument } from '../models';

export type DocPermission = 'owner' | 'edit' | 'view';

/** Constant-time string comparison — avoids leaking share tokens via timing. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Resolve a user's permission on an already-loaded document.
 * Returns 'owner' | 'edit' | 'view', or null if the user has no access.
 *
 * Note: link-share access is intentionally NOT granted here. REST callers
 * don't present the share token, so granting access from `shareLink` alone
 * would let any authenticated user read/modify any link-shared document.
 */
export function permissionFor(doc: Pick<IDocument, 'ownerId' | 'collaborators'> | null, userId: string): DocPermission | null {
  if (!doc) return null;
  if (doc.ownerId.toString() === userId) return 'owner';
  const collab = doc.collaborators?.find((c) => c.userId.toString() === userId);
  return collab?.permission ?? null;
}

export function canEdit(permission: DocPermission | null): boolean {
  return permission === 'owner' || permission === 'edit';
}

type JoinableDoc = Pick<
  IDocument,
  'ownerId' | 'collaborators' | 'shareLink' | 'shareLinkPermission' | 'deletedAt'
>;

/**
 * Decide what permission a user has when joining a document's live session.
 *
 * Access is granted to:
 *   - the owner (always 'owner'),
 *   - a named collaborator (their stored permission),
 *   - anyone presenting a share token that matches the document's active
 *     share link (gets the link's permission level, default 'view').
 *
 * Crucially, a share link does NOT grant access unless the correct token is
 * presented — merely having sharing enabled is not enough. Returns null when
 * the user has no access.
 */
export function resolveJoinPermission(
  doc: JoinableDoc | null,
  userId: string,
  shareToken?: string | null
): DocPermission | null {
  if (!doc) return null;

  if (doc.ownerId.toString() === userId) return 'owner';

  const collab = doc.collaborators?.find((c) => c.userId.toString() === userId);
  if (collab) return collab.permission;

  if (
    shareToken &&
    doc.shareLink &&
    !doc.deletedAt &&
    safeEqual(shareToken, doc.shareLink)
  ) {
    return doc.shareLinkPermission ?? 'view';
  }

  return null;
}

/**
 * Load a document and the caller's permission in one step.
 * `doc` is null when the document does not exist.
 */
export async function loadDocumentForUser(
  documentId: string,
  userId: string
): Promise<{ doc: IDocument | null; permission: DocPermission | null }> {
  const doc = await CollabDocument.findById(documentId);
  return { doc, permission: permissionFor(doc, userId) };
}
