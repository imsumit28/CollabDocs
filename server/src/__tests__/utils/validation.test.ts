import {
  firstError,
  validateEmail,
  validatePassword,
  validateOtp,
  validateDisplayName,
  validateAvatarUrl,
  validateTitle,
  validateFolderName,
  validateCommentBody,
  validateAnchorText,
  validateAIInput,
  isValidObjectId,
  validateObjectId,
  validatePermission,
  validateShareLinkPermission,
} from '../../utils/validation';

describe('validation utils', () => {
  describe('firstError', () => {
    it('returns the first non-null error', () => {
      const e = { field: 'a', message: 'bad' };
      expect(firstError(null, e, { field: 'b', message: 'x' })).toBe(e);
    });
    it('returns null when all pass', () => {
      expect(firstError(null, null)).toBeNull();
    });
  });

  describe('validateEmail', () => {
    it('accepts a well-formed email', () => {
      expect(validateEmail('a@b.co')).toBeNull();
    });
    it.each([
      ['', 'empty'],
      ['no-at-sign', 'no @'],
      ['a@b', 'no TLD'],
      ['a b@c.com', 'space'],
    ])('rejects %s (%s)', (email) => {
      expect(validateEmail(email as string)).not.toBeNull();
    });
    it('rejects a non-string', () => {
      expect(validateEmail(undefined as unknown as string)?.field).toBe('email');
    });
    it('rejects an over-length email', () => {
      const email = 'a'.repeat(250) + '@b.com';
      expect(validateEmail(email)?.message).toMatch(/too long/);
    });
  });

  describe('validatePassword (default policy)', () => {
    it('accepts an 8+ char password', () => {
      expect(validatePassword('abcdefgh')).toBeNull();
    });
    it('rejects a short password', () => {
      expect(validatePassword('abc')?.message).toMatch(/at least 8/);
    });
    it('rejects a missing password', () => {
      expect(validatePassword(undefined as unknown as string)?.field).toBe('password');
    });
  });

  describe('validatePassword (strict policy via env)', () => {
    const OLD = { ...process.env };
    afterEach(() => {
      process.env = { ...OLD };
      jest.resetModules();
    });

    function strictValidator() {
      jest.resetModules();
      process.env.PASSWORD_MIN_LENGTH = '10';
      process.env.PASSWORD_REQUIRE_UPPERCASE = 'true';
      process.env.PASSWORD_REQUIRE_LOWERCASE = 'true';
      process.env.PASSWORD_REQUIRE_NUMBERS = 'true';
      process.env.PASSWORD_REQUIRE_SPECIAL_CHARS = 'true';
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return require('../../utils/validation').validatePassword as typeof validatePassword;
    }

    it('enforces uppercase, lowercase, numbers, and special chars', () => {
      const v = strictValidator();
      expect(v('alllowercase1!')?.message).toMatch(/uppercase/);
      expect(v('ALLUPPERCASE1!')?.message).toMatch(/lowercase/);
      expect(v('NoNumbersHere!')?.message).toMatch(/number/);
      expect(v('NoSpecials123')?.message).toMatch(/special/);
      expect(v('ValidPass123!')).toBeNull();
    });
  });

  describe('validateOtp', () => {
    it('accepts a 6-digit code', () => {
      expect(validateOtp('123456')).toBeNull();
    });
    it.each(['12345', '1234567', 'abcdef', '', '12 456'])('rejects %s', (otp) => {
      expect(validateOtp(otp)).not.toBeNull();
    });
    it('rejects a non-string', () => {
      expect(validateOtp(123456)).not.toBeNull();
    });
  });

  describe('validateDisplayName', () => {
    it('accepts a normal name', () => {
      expect(validateDisplayName('Jane Doe')).toBeNull();
    });
    it('rejects an all-whitespace name', () => {
      expect(validateDisplayName('   ')?.message).toMatch(/empty/);
    });
    it('rejects a missing name', () => {
      expect(validateDisplayName(undefined as unknown as string)?.field).toBe('displayName');
    });
    it('rejects an over-length name', () => {
      expect(validateDisplayName('x'.repeat(101))?.message).toMatch(/under 100/);
    });
  });

  describe('validateAvatarUrl', () => {
    it('treats empty/undefined/null as clearing (no error)', () => {
      expect(validateAvatarUrl('')).toBeNull();
      expect(validateAvatarUrl(undefined)).toBeNull();
      expect(validateAvatarUrl(null)).toBeNull();
    });
    it('accepts http(s) urls', () => {
      expect(validateAvatarUrl('https://x.com/a.png')).toBeNull();
      expect(validateAvatarUrl('http://x.com/a.png')).toBeNull();
    });
    it('rejects a non-http scheme (blocks javascript: XSS vectors)', () => {
      expect(validateAvatarUrl('javascript:alert(1)')?.field).toBe('avatarUrl');
    });
    it('rejects a non-string', () => {
      expect(validateAvatarUrl(42)).not.toBeNull();
    });
    it('rejects an over-length url', () => {
      expect(validateAvatarUrl('https://x.com/' + 'a'.repeat(2100))?.message).toMatch(/too long/);
    });
  });

  describe('validateTitle', () => {
    it('treats a missing/non-string title as optional (null)', () => {
      expect(validateTitle(undefined as unknown as string)).toBeNull();
      expect(validateTitle(123 as unknown as string)).toBeNull();
    });
    it('accepts a normal title', () => {
      expect(validateTitle('My Doc')).toBeNull();
    });
    it('rejects an over-length title', () => {
      expect(validateTitle('x'.repeat(501))?.message).toMatch(/under 500/);
    });
  });

  describe('validateFolderName', () => {
    it('accepts a normal name', () => {
      expect(validateFolderName('Work')).toBeNull();
    });
    it('rejects empty / whitespace / non-string', () => {
      expect(validateFolderName('')).not.toBeNull();
      expect(validateFolderName('   ')).not.toBeNull();
      expect(validateFolderName(5)).not.toBeNull();
    });
    it('rejects an over-length name', () => {
      expect(validateFolderName('x'.repeat(501))?.message).toMatch(/under 500/);
    });
  });

  describe('validateCommentBody', () => {
    it('accepts a normal comment', () => {
      expect(validateCommentBody('looks good')).toBeNull();
    });
    it('rejects empty / whitespace', () => {
      expect(validateCommentBody('   ')?.message).toMatch(/empty/);
    });
    it('rejects a missing body', () => {
      expect(validateCommentBody(undefined as unknown as string)?.field).toBe('body');
    });
    it('rejects an over-length body', () => {
      expect(validateCommentBody('x'.repeat(5001))?.message).toMatch(/under 5000/);
    });
  });

  describe('validateAnchorText', () => {
    it('accepts non-empty anchor text', () => {
      expect(validateAnchorText('selected')).toBeNull();
    });
    it('rejects empty / missing', () => {
      expect(validateAnchorText('   ')?.message).toMatch(/empty/);
      expect(validateAnchorText(undefined as unknown as string)?.field).toBe('anchorText');
    });
  });

  describe('validateAIInput', () => {
    it('accepts normal input', () => {
      expect(validateAIInput('improve this')).toBeNull();
    });
    it('rejects empty / whitespace / missing', () => {
      expect(validateAIInput('   ')?.message).toMatch(/empty/);
      expect(validateAIInput(undefined as unknown as string)?.field).toBe('text');
    });
    it('rejects input over the max length (cost/DoS guard)', () => {
      expect(validateAIInput('x'.repeat(10001))?.message).toMatch(/under 10000/);
    });
  });

  describe('object id + permission helpers', () => {
    it('isValidObjectId distinguishes valid ids', () => {
      expect(isValidObjectId('507f1f77bcf86cd799439011')).toBe(true);
      expect(isValidObjectId('nope')).toBe(false);
    });
    it('validateObjectId returns errors for missing/invalid', () => {
      expect(validateObjectId('507f1f77bcf86cd799439011')).toBeNull();
      expect(validateObjectId('', 'docId')?.field).toBe('docId');
      expect(validateObjectId('bad', 'docId')?.message).toMatch(/Invalid docId/);
    });
    it('validatePermission accepts view/edit/comment only', () => {
      expect(validatePermission('view')).toBe(true);
      expect(validatePermission('edit')).toBe(true);
      expect(validatePermission('comment')).toBe(true);
      expect(validatePermission('admin')).toBe(false);
    });
    it('validateShareLinkPermission accepts view/edit only', () => {
      expect(validateShareLinkPermission('view')).toBe(true);
      expect(validateShareLinkPermission('edit')).toBe(true);
      expect(validateShareLinkPermission('comment')).toBe(false);
    });
  });
});
