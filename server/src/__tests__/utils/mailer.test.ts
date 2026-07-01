// Mock nodemailer + logger before importing the mailer. (jest hoists jest.mock
// above imports; the factory-referenced vars are `mock`-prefixed so the hoist is legal.)
const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'msg-1' });
const mockCreateTransport = jest.fn(() => ({ sendMail: mockSendMail }));
jest.mock('nodemailer', () => ({ __esModule: true, default: { createTransport: mockCreateTransport } }));
jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import {
  sendVerificationEmail,
  sendPasswordResetOtpEmail,
  sendOAuthResetNoticeEmail,
} from '../../utils/mailer';
import { logger } from '../../utils/logger';

// A handful of SMTP/Brevo env keys we toggle per test.
const MAIL_ENV_KEYS = ['BREVO_API_KEY', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'];

describe('mailer', () => {
  const OLD_ENV = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    for (const k of MAIL_ENV_KEYS) delete process.env[k];
  });

  afterEach(() => {
    process.env = { ...OLD_ENV };
    global.fetch = originalFetch;
  });

  // ─── Console fallback (no transport configured) ────────────────────────────────
  describe('console fallback (no BREVO/SMTP)', () => {
    it('logs a dev fallback instead of sending, and does not throw', async () => {
      await expect(sendVerificationEmail('user@example.com', 'raw-token')).resolves.toBeUndefined();
      expect(mockCreateTransport).not.toHaveBeenCalled();
      expect(mockSendMail).not.toHaveBeenCalled();
      // The dev fallback logs the payload (including the devLog fields).
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'user@example.com' }),
        expect.stringMatching(/dev fallback/),
      );
    });
  });

  // ─── SMTP transport ────────────────────────────────────────────────────────────
  describe('SMTP transport', () => {
    beforeEach(() => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_PORT = '587';
      process.env.SMTP_USER = 'u';
      process.env.SMTP_PASS = 'p';
    });

    it('sends the OTP email via nodemailer with the code in the body', async () => {
      await sendPasswordResetOtpEmail('user@example.com', '135790', 'Jane');
      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({ host: 'smtp.example.com', port: 587, auth: { user: 'u', pass: 'p' } }),
      );
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const arg = mockSendMail.mock.calls[0][0];
      expect(arg.to).toBe('user@example.com');
      expect(arg.subject).toMatch(/OTP/i);
      expect(arg.text).toContain('135790');
      expect(arg.html).toContain('135790');
    });

    it('sends the verification email with the verify URL', async () => {
      process.env.API_URL = 'https://api.example.com';
      await sendVerificationEmail('user@example.com', 'raw-token');
      const arg = mockSendMail.mock.calls[0][0];
      expect(arg.text).toContain('https://api.example.com/api/auth/verify-email/raw-token');
    });

    it('surfaces a send failure to the caller (fire-and-forget callers rely on this)', async () => {
      mockSendMail.mockRejectedValueOnce(new Error('SMTP down'));
      await expect(sendPasswordResetOtpEmail('user@example.com', '111111')).rejects.toThrow('SMTP down');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  // ─── Brevo HTTP API ──────────────────────────────────────────────────────────
  describe('Brevo HTTP transport', () => {
    beforeEach(() => {
      process.env.BREVO_API_KEY = 'brevo-key';
      process.env.SMTP_FROM = 'CollabDocs <no-reply@collabdocs.app>';
    });

    it('POSTs to the Brevo API with the api-key header and parsed sender', async () => {
      const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 201, text: async () => '' });
      global.fetch = fetchMock as any;

      await sendOAuthResetNoticeEmail('user@example.com', 'Jane');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.brevo.com/v3/smtp/email');
      expect(opts.headers['api-key']).toBe('brevo-key');
      const body = JSON.parse(opts.body);
      expect(body.sender).toEqual({ name: 'CollabDocs', email: 'no-reply@collabdocs.app' });
      expect(body.to).toEqual([{ email: 'user@example.com' }]);
      // SMTP transport must NOT be used when Brevo is configured.
      expect(mockCreateTransport).not.toHaveBeenCalled();
    });

    it('throws when the Brevo API responds non-2xx', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' }) as any;
      await expect(sendPasswordResetOtpEmail('user@example.com', '222222')).rejects.toThrow(/Brevo API responded 500/);
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
