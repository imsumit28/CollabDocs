import mongoose, { Document as MongoDoc, Schema, Types } from 'mongoose';

// ─── User ────────────────────────────────────────────────────────────────────
export interface IUser extends MongoDoc {
  email: string;
  passwordHash: string | null;
  oauthProvider: 'google' | null;
  oauthId: string | null;
  displayName: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  emailVerificationToken: string | null;
  emailVerificationExpiry: Date | null;
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
    avatarUrl: { type: String, default: null },
    emailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, default: null, index: true },
    emailVerificationExpiry: { type: Date, default: null },
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', UserSchema);

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
