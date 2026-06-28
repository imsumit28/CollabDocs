import { Types } from 'mongoose';

// Email validation regex (RFC 5322 simplified)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Password strength requirements
const PASSWORD_MIN_LENGTH = parseInt(process.env.PASSWORD_MIN_LENGTH || '8', 10);
const PASSWORD_REQUIRE_UPPERCASE = process.env.PASSWORD_REQUIRE_UPPERCASE === 'true';
const PASSWORD_REQUIRE_NUMBERS = process.env.PASSWORD_REQUIRE_NUMBERS === 'true';
const PASSWORD_REQUIRE_SPECIAL = process.env.PASSWORD_REQUIRE_SPECIAL_CHARS === 'true';

// Input limits
const MAX_TITLE_LENGTH = parseInt(process.env.MAX_TITLE_LENGTH || '500', 10);
const MAX_COMMENT_LENGTH = parseInt(process.env.MAX_COMMENT_LENGTH || '5000', 10);
const MAX_DISPLAY_NAME = parseInt(process.env.MAX_DISPLAY_NAME || '100', 10);
const MAX_AI_INPUT = parseInt(process.env.MAX_AI_INPUT || '10000', 10);

export interface ValidationError {
  field: string;
  message: string;
}

// Returns the first non-null validation error, or null if all pass.
export function firstError(...errors: (ValidationError | null)[]): ValidationError | null {
  return errors.find((e) => e !== null) ?? null;
}

// Email validation
export function validateEmail(email: string): ValidationError | null {
  if (!email || typeof email !== 'string') {
    return { field: 'email', message: 'Email is required' };
  }
  if (!EMAIL_REGEX.test(email.trim())) {
    return { field: 'email', message: 'Invalid email format' };
  }
  if (email.length > 255) {
    return { field: 'email', message: 'Email is too long' };
  }
  return null;
}

// Password validation
export function validatePassword(password: string): ValidationError | null {
  if (!password || typeof password !== 'string') {
    return { field: 'password', message: 'Password is required' };
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { field: 'password', message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` };
  }
  if (PASSWORD_REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
    return { field: 'password', message: 'Password must contain at least one uppercase letter' };
  }
  if (PASSWORD_REQUIRE_NUMBERS && !/[0-9]/.test(password)) {
    return { field: 'password', message: 'Password must contain at least one number' };
  }
  if (PASSWORD_REQUIRE_SPECIAL && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    return { field: 'password', message: 'Password must contain at least one special character' };
  }
  return null;
}

// Display name validation
export function validateDisplayName(name: string): ValidationError | null {
  if (!name || typeof name !== 'string') {
    return { field: 'displayName', message: 'Display name is required' };
  }
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { field: 'displayName', message: 'Display name cannot be empty' };
  }
  if (trimmed.length > MAX_DISPLAY_NAME) {
    return { field: 'displayName', message: `Display name must be under ${MAX_DISPLAY_NAME} characters` };
  }
  return null;
}

// Avatar URL validation (optional field — empty clears it)
export function validateAvatarUrl(url: unknown): ValidationError | null {
  if (url === undefined || url === null || url === '') return null;
  if (typeof url !== 'string') {
    return { field: 'avatarUrl', message: 'Invalid avatar URL' };
  }
  if (url.length > 2048) {
    return { field: 'avatarUrl', message: 'Avatar URL is too long' };
  }
  if (!/^https?:\/\//.test(url.trim())) {
    return { field: 'avatarUrl', message: 'Avatar URL must start with http:// or https://' };
  }
  return null;
}

// Document title validation
export function validateTitle(title: string): ValidationError | null {
  if (!title || typeof title !== 'string') {
    return null; // Optional, defaults to "Untitled"
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return { field: 'title', message: `Title must be under ${MAX_TITLE_LENGTH} characters` };
  }
  return null;
}

// Folder name validation (required, bounded by the title limit)
export function validateFolderName(name: unknown): ValidationError | null {
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return { field: 'name', message: 'Folder name is required' };
  }
  if (name.trim().length > MAX_TITLE_LENGTH) {
    return { field: 'name', message: `Folder name must be under ${MAX_TITLE_LENGTH} characters` };
  }
  return null;
}

// Comment body validation
export function validateCommentBody(body: string): ValidationError | null {
  if (!body || typeof body !== 'string') {
    return { field: 'body', message: 'Comment body is required' };
  }
  const trimmed = body.trim();
  if (trimmed.length === 0) {
    return { field: 'body', message: 'Comment cannot be empty' };
  }
  if (trimmed.length > MAX_COMMENT_LENGTH) {
    return { field: 'body', message: `Comment must be under ${MAX_COMMENT_LENGTH} characters` };
  }
  return null;
}

// Anchor text validation (for comments)
export function validateAnchorText(text: string): ValidationError | null {
  if (!text || typeof text !== 'string') {
    return { field: 'anchorText', message: 'Anchor text is required' };
  }
  if (text.trim().length === 0) {
    return { field: 'anchorText', message: 'Anchor text cannot be empty' };
  }
  return null;
}

// AI input validation
export function validateAIInput(text: string): ValidationError | null {
  if (!text || typeof text !== 'string') {
    return { field: 'text', message: 'Input text is required' };
  }
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { field: 'text', message: 'Input cannot be empty' };
  }
  if (trimmed.length > MAX_AI_INPUT) {
    return { field: 'text', message: `Input must be under ${MAX_AI_INPUT} characters` };
  }
  return null;
}

// MongoDB ObjectId validation
export function isValidObjectId(id: string): boolean {
  return Types.ObjectId.isValid(id);
}

export function validateObjectId(id: string, fieldName = 'id'): ValidationError | null {
  if (!id || typeof id !== 'string') {
    return { field: fieldName, message: `${fieldName} is required` };
  }
  if (!isValidObjectId(id)) {
    return { field: fieldName, message: `Invalid ${fieldName} format` };
  }
  return null;
}

// Permission validation
export function validatePermission(permission: string): boolean {
  return ['view', 'edit', 'comment'].includes(permission);
}

export function validateShareLinkPermission(permission: string): boolean {
  return ['view', 'edit'].includes(permission);
}
