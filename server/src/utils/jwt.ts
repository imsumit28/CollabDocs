import jwt from 'jsonwebtoken';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  displayName: string;
  username?: string | null;
}

export interface RefreshTokenPayload {
  sub: string;
  tokenVersion: number;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error('JWT_ACCESS_SECRET not defined');
  return jwt.sign(payload, secret, { expiresIn: '15m' });
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error('JWT_REFRESH_SECRET not defined');
  return jwt.sign(payload, secret, { expiresIn: '7d' });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error('JWT_ACCESS_SECRET not defined');
  return jwt.verify(token, secret) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error('JWT_REFRESH_SECRET not defined');
  return jwt.verify(token, secret) as RefreshTokenPayload;
}

export function setRefreshCookie(res: import('express').Response, token: string): void {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('refreshToken', token, {
    httpOnly: true,
    sameSite: isProd ? 'none' : 'strict',
    secure: isProd,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/api/auth/refresh',
  });
}

export function clearRefreshCookie(res: import('express').Response): void {
  res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
}
