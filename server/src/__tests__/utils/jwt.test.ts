import jwt from 'jsonwebtoken';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  setRefreshCookie,
  clearRefreshCookie,
} from '../../utils/jwt';

describe('jwt utils', () => {
  const OLD_ENV = { ...process.env };
  afterEach(() => {
    process.env.JWT_ACCESS_SECRET = OLD_ENV.JWT_ACCESS_SECRET;
    process.env.JWT_REFRESH_SECRET = OLD_ENV.JWT_REFRESH_SECRET;
    process.env.NODE_ENV = OLD_ENV.NODE_ENV;
  });

  describe('sign/verify roundtrip', () => {
    it('round-trips an access token payload', () => {
      const token = signAccessToken({ sub: 'u1', email: 'a@b.co', displayName: 'A', username: 'a' });
      const decoded = verifyAccessToken(token);
      expect(decoded).toEqual(expect.objectContaining({ sub: 'u1', email: 'a@b.co', displayName: 'A', username: 'a' }));
    });

    it('round-trips a refresh token payload', () => {
      const token = signRefreshToken({ sub: 'u1', tokenVersion: 3 });
      const decoded = verifyRefreshToken(token);
      expect(decoded).toEqual(expect.objectContaining({ sub: 'u1', tokenVersion: 3 }));
    });

    it('access token expires in 15 minutes', () => {
      const token = signAccessToken({ sub: 'u1', email: 'a@b.co', displayName: 'A' });
      const decoded = jwt.decode(token) as { iat: number; exp: number };
      expect(decoded.exp - decoded.iat).toBe(15 * 60);
    });

    it('refresh token expires in 7 days', () => {
      const token = signRefreshToken({ sub: 'u1', tokenVersion: 0 });
      const decoded = jwt.decode(token) as { iat: number; exp: number };
      expect(decoded.exp - decoded.iat).toBe(7 * 24 * 60 * 60);
    });
  });

  describe('verification failures', () => {
    it('rejects a token signed with a different secret', () => {
      const forged = jwt.sign({ sub: 'u1' }, 'some-other-secret');
      expect(() => verifyAccessToken(forged)).toThrow();
    });

    it('rejects an expired token', () => {
      const expired = jwt.sign(
        { sub: 'u1', email: 'a@b.co', displayName: 'A' },
        process.env.JWT_ACCESS_SECRET!,
        { expiresIn: -10 },
      );
      expect(() => verifyAccessToken(expired)).toThrow(/jwt expired/);
    });

    it('rejects a malformed token', () => {
      expect(() => verifyAccessToken('garbage')).toThrow();
    });
  });

  describe('missing secret guards', () => {
    it('signAccessToken throws when JWT_ACCESS_SECRET is unset', () => {
      delete process.env.JWT_ACCESS_SECRET;
      expect(() => signAccessToken({ sub: 'u1', email: 'a@b.co', displayName: 'A' })).toThrow(/JWT_ACCESS_SECRET not defined/);
    });
    it('verifyAccessToken throws when JWT_ACCESS_SECRET is unset', () => {
      delete process.env.JWT_ACCESS_SECRET;
      expect(() => verifyAccessToken('whatever')).toThrow(/JWT_ACCESS_SECRET not defined/);
    });
    it('signRefreshToken throws when JWT_REFRESH_SECRET is unset', () => {
      delete process.env.JWT_REFRESH_SECRET;
      expect(() => signRefreshToken({ sub: 'u1', tokenVersion: 0 })).toThrow(/JWT_REFRESH_SECRET not defined/);
    });
    it('verifyRefreshToken throws when JWT_REFRESH_SECRET is unset', () => {
      delete process.env.JWT_REFRESH_SECRET;
      expect(() => verifyRefreshToken('whatever')).toThrow(/JWT_REFRESH_SECRET not defined/);
    });
  });

  describe('cookie helpers', () => {
    function mockRes() {
      return {
        cookie: jest.fn(),
        clearCookie: jest.fn(),
      } as any;
    }

    it('sets an HttpOnly, path-scoped refresh cookie in dev (strict/insecure)', () => {
      process.env.NODE_ENV = 'development';
      const res = mockRes();
      setRefreshCookie(res, 'tok');
      expect(res.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'tok',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
          secure: false,
          path: '/api/auth/refresh',
        }),
      );
    });

    it('uses sameSite=none + secure in production', () => {
      process.env.NODE_ENV = 'production';
      const res = mockRes();
      setRefreshCookie(res, 'tok');
      expect(res.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'tok',
        expect.objectContaining({ sameSite: 'none', secure: true }),
      );
    });

    it('clears the cookie on the same path', () => {
      const res = mockRes();
      clearRefreshCookie(res);
      expect(res.clearCookie).toHaveBeenCalledWith('refreshToken', { path: '/api/auth/refresh' });
    });
  });
});
