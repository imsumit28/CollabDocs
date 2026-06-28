import mongoose, { Document as MongoDoc, Schema, Types } from 'mongoose';

// ─── User ────────────────────────────────────────────────────────────────────
export interface IUser extends MongoDoc {
  email: string;
  passwordHash: string | null;
  oauthProvider: 'google' | null;
  oauthId: string | null;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  emailVerificationToken: string | null;
  emailVerificationExpiry: Date | null;
  passwordResetToken: string | null;
  passwordResetExpiry: Date | null;
  tokenVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, default: null },
    oauthProvider: { type: String, enum: ['google', null], default: null },
    oauthId: { type: String, default: null },
    displayName: { type: String, required: true, trim: true },
    username: { type: String, default: null, trim: true },
    avatarUrl: { type: String, default: null },
    emailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, default: null, index: true },
    emailVerificationExpiry: { type: Date, default: null },
    passwordResetToken: { type: String, default: null, index: true },
    passwordResetExpiry: { type: Date, default: null },
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', UserSchema);

// ─── Folder ───────────────────────────────────────────────────────────────────
// Flat (single-level) folders for organizing a user's own documents. A folder
// belongs to exactly one user; a document's folderId is only meaningful to that
// document's owner (shared docs stay in the recipient's root view).
export interface IFolder extends MongoDoc {
  name: string;
  ownerId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const FolderSchema = new Schema<IFolder>(
  {
    name: { type: String, required: true, trim: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true }
);

export const Folder = mongoose.model<IFolder>('Folder', FolderSchema);

// ─── Document ─────────────────────────────────────────────────────────────────
export interface ICollaborator {
  userId: Types.ObjectId;
  permission: 'view' | 'edit';
}

export interface IDocument extends MongoDoc {
  title: string;
  ownerId: Types.ObjectId;
  collaborators: ICollaborator[];
  shareLink: string | null;
  shareLinkPermission: 'view' | 'edit' | null;
  yjsState: Buffer | null;
  contentText: string;
  folderId: Types.ObjectId | null;
  notifiedMentions: string[];
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const DocumentSchema = new Schema<IDocument>(
  {
    title: { type: String, default: 'Untitled', trim: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    collaborators: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        permission: { type: String, enum: ['view', 'edit'] },
      },
    ],
    shareLink: { type: String, default: null, index: true },
    shareLinkPermission: { type: String, enum: ['view', 'edit', null], default: null },
    yjsState: { type: Buffer, default: null },
    // Plain-text mirror of the document body, kept in sync on save — powers
    // server-side content search without decoding the binary Y.js state per query.
    contentText: { type: String, default: '' },
    // Owner-only organization: which folder this doc lives in (null = root).
    folderId: { type: Schema.Types.ObjectId, ref: 'Folder', default: null, index: true },
    // Lowercased @handles already notified for in-document mentions, so editing
    // the same doc repeatedly doesn't re-notify the same person.
    notifiedMentions: { type: [String], default: [] },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

export const CollabDocument = mongoose.model<IDocument>('Document', DocumentSchema);

// ─── Version ──────────────────────────────────────────────────────────────────
export interface IVersion extends MongoDoc {
  documentId: Types.ObjectId;
  yjsSnapshot: Buffer;
  savedBy: Types.ObjectId;
  label: string;
  createdAt: Date;
}

const VersionSchema = new Schema<IVersion>(
  {
    documentId: { type: Schema.Types.ObjectId, ref: 'Document', required: true, index: true },
    yjsSnapshot: { type: Buffer, required: true },
    savedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    label: { type: String, required: true },
  },
  { timestamps: true }
);

export const Version = mongoose.model<IVersion>('Version', VersionSchema);

// ─── Comment ──────────────────────────────────────────────────────────────────
export interface IComment extends MongoDoc {
  documentId: Types.ObjectId;
  authorId: Types.ObjectId;
  anchorText: string;
  body: string;
  parentId: Types.ObjectId | null;
  resolved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema = new Schema<IComment>(
  {
    documentId: { type: Schema.Types.ObjectId, ref: 'Document', required: true, index: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    anchorText: { type: String, required: true },
    body: { type: String, required: true, trim: true },
    parentId: { type: Schema.Types.ObjectId, ref: 'Comment', default: null },
    resolved: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Comment = mongoose.model<IComment>('Comment', CommentSchema);

// ─── Notification ──────────────────────────────────────────────────────────────
export interface INotification extends MongoDoc {
  recipientId: Types.ObjectId;
  actorId: Types.ObjectId | null;
  actorName: string;
  type: 'mention' | 'comment' | 'share';
  documentId: Types.ObjectId;
  documentTitle: string;
  snippet: string;
  read: boolean;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    recipientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    actorName: { type: String, default: '' },
    type: { type: String, enum: ['mention', 'comment', 'share'], required: true },
    documentId: { type: Schema.Types.ObjectId, ref: 'Document', required: true },
    documentTitle: { type: String, default: 'Untitled' },
    snippet: { type: String, default: '' },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

// Most queries fetch a user's newest notifications first
NotificationSchema.index({ recipientId: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
