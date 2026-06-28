import { Types } from 'mongoose';
import { resolveJoinPermission, permissionFor, canEdit } from '../../utils/documentAccess';

const owner = new Types.ObjectId().toString();
const editor = new Types.ObjectId().toString();
const viewer = new Types.ObjectId().toString();
const stranger = new Types.ObjectId().toString();

function makeDoc(overrides: Partial<any> = {}) {
  return {
    ownerId: new Types.ObjectId(owner),
    collaborators: [
      { userId: new Types.ObjectId(editor), permission: 'edit' },
      { userId: new Types.ObjectId(viewer), permission: 'view' },
    ],
    shareLink: null,
    shareLinkPermission: null,
    deletedAt: null,
    ...overrides,
  };
}

describe('canEdit', () => {
  it('is true for owner and edit, false otherwise', () => {
    expect(canEdit('owner')).toBe(true);
    expect(canEdit('edit')).toBe(true);
    expect(canEdit('view')).toBe(false);
    expect(canEdit(null)).toBe(false);
  });
});

describe('permissionFor', () => {
  it('resolves owner / collaborator / none', () => {
    const doc = makeDoc();
    expect(permissionFor(doc as any, owner)).toBe('owner');
    expect(permissionFor(doc as any, editor)).toBe('edit');
    expect(permissionFor(doc as any, viewer)).toBe('view');
    expect(permissionFor(doc as any, stranger)).toBeNull();
    expect(permissionFor(null, owner)).toBeNull();
  });

  it('never grants access from a share link alone', () => {
    const doc = makeDoc({ shareLink: 'secret-token', shareLinkPermission: 'edit' });
    expect(permissionFor(doc as any, stranger)).toBeNull();
  });
});

describe('resolveJoinPermission', () => {
  it('grants owner and collaborator access regardless of token', () => {
    const doc = makeDoc();
    expect(resolveJoinPermission(doc as any, owner)).toBe('owner');
    expect(resolveJoinPermission(doc as any, editor)).toBe('edit');
    expect(resolveJoinPermission(doc as any, viewer)).toBe('view');
  });

  it('denies a stranger when no token is given (the core IDOR fix)', () => {
    const doc = makeDoc({ shareLink: 'secret-token', shareLinkPermission: 'view' });
    expect(resolveJoinPermission(doc as any, stranger)).toBeNull();
    expect(resolveJoinPermission(doc as any, stranger, '')).toBeNull();
    expect(resolveJoinPermission(doc as any, stranger, 'wrong-token')).toBeNull();
  });

  it('grants the share-link permission when the correct token is presented', () => {
    const viewDoc = makeDoc({ shareLink: 'secret-token', shareLinkPermission: 'view' });
    expect(resolveJoinPermission(viewDoc as any, stranger, 'secret-token')).toBe('view');

    const editDoc = makeDoc({ shareLink: 'secret-token', shareLinkPermission: 'edit' });
    expect(resolveJoinPermission(editDoc as any, stranger, 'secret-token')).toBe('edit');
  });

  it('defaults to view when share permission is unset', () => {
    const doc = makeDoc({ shareLink: 'secret-token', shareLinkPermission: null });
    expect(resolveJoinPermission(doc as any, stranger, 'secret-token')).toBe('view');
  });

  it('rejects a share token for a trashed document', () => {
    const doc = makeDoc({ shareLink: 'secret-token', shareLinkPermission: 'edit', deletedAt: new Date() });
    expect(resolveJoinPermission(doc as any, stranger, 'secret-token')).toBeNull();
  });

  it('returns null for a missing document', () => {
    expect(resolveJoinPermission(null, owner, 'anything')).toBeNull();
  });
});
