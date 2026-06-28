import nodemailer from 'nodemailer';
import { logger } from './logger';

function createTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
}

export async function sendVerificationEmail(to: string, rawToken: string): Promise<void> {
  const apiUrl = process.env.API_URL || 'http://localhost:4000';
  const verifyUrl = `${apiUrl}/api/auth/verify-email/${rawToken}`;
  const from = process.env.SMTP_FROM || 'CollabDocs <noreply@collabdocs.app>';

  const transport = createTransport();
  if (!transport) {
    logger.info({ to, verifyUrl }, '[mailer] SMTP not configured — verification URL (dev fallback)');
    return;
  }

  await transport.sendMail({
    from,
    to,
    subject: 'Verify your CollabDocs email',
    text: `Click the link below to verify your email address (expires in 24 hours):\n\n${verifyUrl}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="margin-bottom:8px">Verify your email</h2>
        <p style="color:#64748b">Click the button below to confirm your address. The link expires in 24 hours.</p>
        <a href="${verifyUrl}"
           style="display:inline-block;margin-top:16px;padding:12px 24px;background:#0f172a;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
          Verify email
        </a>
        <p style="margin-top:24px;font-size:13px;color:#94a3b8">
          If you didn't create a CollabDocs account, you can ignore this email.
        </p>
      </div>`,
  });
}

export async function sendPasswordResetEmail(to: string, rawToken: string): Promise<void> {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const resetUrl = `${clientUrl}/reset-password?token=${rawToken}`;
  const from = process.env.SMTP_FROM || 'CollabDocs <noreply@collabdocs.app>';

  const transport = createTransport();
  if (!transport) {
    logger.info({ to, resetUrl }, '[mailer] SMTP not configured — password reset URL (dev fallback)');
    return;
  }

  await transport.sendMail({
    from,
    to,
    subject: 'Reset your CollabDocs password',
    text: `We received a request to reset your password. Click the link below (expires in 1 hour):\n\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="margin-bottom:8px">Reset your password</h2>
        <p style="color:#64748b">Click the button below to choose a new password. The link expires in 1 hour.</p>
        <a href="${resetUrl}"
           style="display:inline-block;margin-top:16px;padding:12px 24px;background:#0f172a;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
          Reset password
        </a>
        <p style="margin-top:24px;font-size:13px;color:#94a3b8">
          If you didn't request a password reset, you can ignore this email — your password won't change.
        </p>
      </div>`,
  });
}
