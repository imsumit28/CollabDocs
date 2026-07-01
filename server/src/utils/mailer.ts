import nodemailer from 'nodemailer';
import { logger } from './logger';

// Public URL of the brand logo shown in email headers. Email clients can't load
// localhost, so this renders only in deployed environments (where CLIENT_URL is
// a real https origin). When unavailable, the layout falls back to a styled
// text wordmark so the email never shows a broken image.
const LOGO_URL =
  process.env.EMAIL_LOGO_URL ||
  (process.env.CLIENT_URL && /^https:\/\//.test(process.env.CLIENT_URL)
    ? `${process.env.CLIENT_URL}/collabdocs-logo-full.png`
    : '');

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

// Split a "Name <email>" string into Brevo's sender shape.
function parseSender(from: string): { name: string; email: string } {
  const match = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (match) return { name: match[1] || 'CollabDocs', email: match[2] };
  return { name: 'CollabDocs', email: from.trim() };
}

interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  // Extra fields logged only when no transport is configured (local dev), e.g.
  // the OTP or verification URL, so the flow is still testable without email.
  devLog?: Record<string, unknown>;
}

// Send an email via the best available transport:
//   1. Brevo HTTP API  — used when BREVO_API_KEY is set. Sends over HTTPS, so it
//      works on hosts that block outbound SMTP ports (e.g. Render).
//   2. SMTP (nodemailer) — used in local dev when SMTP_* is configured.
//   3. Console fallback  — neither configured: log the payload instead of sending.
async function dispatchEmail(opts: OutgoingEmail): Promise<void> {
  const from = process.env.SMTP_FROM || 'CollabDocs <noreply@collabdocs.app>';
  const brevoKey = process.env.BREVO_API_KEY;

  if (brevoKey) {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': brevoKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: parseSender(from),
        to: [{ email: opts.to }],
        subject: opts.subject,
        htmlContent: opts.html,
        textContent: opts.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Brevo API responded ${res.status}: ${body}`);
    }
    logger.info({ to: opts.to, via: 'brevo-api' }, '[mailer] email sent');
    return;
  }

  const transport = createTransport();
  if (!transport) {
    logger.info(
      { to: opts.to, ...opts.devLog },
      '[mailer] no email transport configured — dev fallback (logged, not sent)'
    );
    return;
  }
  const info = await transport.sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
  logger.info({ to: opts.to, via: 'smtp', messageId: info.messageId }, '[mailer] email sent');
}

export async function sendVerificationEmail(to: string, rawToken: string): Promise<void> {
  const apiUrl = process.env.API_URL || 'http://localhost:4000';
  const verifyUrl = `${apiUrl}/api/auth/verify-email/${rawToken}`;
  const greetingName = to.split('@')[0];

  try {
    await dispatchEmail({
      to,
      subject: 'Verify your CollabDocs email',
      text: `Hello ${greetingName},\n\nClick the link below to verify your email address (expires in 24 hours):\n\n${verifyUrl}\n\nIf you didn't create a CollabDocs account, you can ignore this email.`,
      html: renderVerificationHtml(verifyUrl, greetingName),
      devLog: { verifyUrl },
    });
  } catch (err) {
    logger.error({ to, err: (err as Error).message }, '[mailer] FAILED to send verification email');
    throw err;
  }
}

// Shared, table-based, inline-styled email shell for broad client compatibility
// (Gmail, Outlook, Apple Mail). `color-scheme` hints keep the light palette
// intact under clients that auto-darken messages. The branded header (with the
// inlined logo) and footer are identical across all transactional emails; only
// `content` — the inner <tr> rows — differs per email.
function renderEmailLayout(opts: { title: string; preheader: string; content: string }): string {
  const year = new Date().getFullYear();
  const header = LOGO_URL
    ? `<img src="${LOGO_URL}" alt="CollabDocs" height="32" style="height:32px;width:auto;display:block;border:0;outline:none;text-decoration:none;" />`
    : `<table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <span style="display:inline-block;width:32px;height:32px;line-height:32px;text-align:center;background-color:#3b82f6;border-radius:8px;font-size:17px;font-weight:700;color:#ffffff;">C</span>
                  </td>
                  <td style="vertical-align:middle;padding-left:12px;">
                    <span style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">CollabDocs</span>
                  </td>
                </tr>
              </table>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${opts.title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;">
  <!-- Preheader (hidden inbox preview text) -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f1f5f9;">${opts.preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e8edf3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          <!-- Header -->
          <tr>
            <td style="background-color:#0f172a;padding:24px 32px;">${header}</td>
          </tr>
          ${opts.content}
          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;padding:18px 32px;border-top:1px solid #eef2f7;">
              <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">© ${year} CollabDocs · This is an automated message, please don't reply.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function renderOtpHtml(otp: string, greetingName: string): string {
  const digits = otp
    .split('')
    .map(
      (d) =>
        `<span style="display:inline-block;width:44px;height:56px;line-height:56px;margin:0 4px;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;font-size:28px;font-weight:700;color:#0f172a;text-align:center;">${d}</span>`
    )
    .join('');

  const content = `
          <tr>
            <td style="padding:36px 32px 8px 32px;">
              <h1 style="margin:0 0 6px 0;font-size:22px;font-weight:800;color:#0f172a;letter-spacing:-0.4px;">Reset your password</h1>
              <p style="margin:0 0 4px 0;font-size:15px;color:#475569;">Hello ${greetingName},</p>
              <p style="margin:0 0 24px 0;font-size:15px;color:#64748b;line-height:1.5;">Use the verification code below to reset your password.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 24px 20px 24px;">
              <div style="white-space:nowrap;">${digits}</div>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 32px 28px 32px;">
              <span style="display:inline-block;background-color:#eff6ff;color:#2563eb;font-size:13px;font-weight:600;padding:7px 14px;border-radius:999px;">⏱ Expires in 10 minutes</span>
            </td>
          </tr>
          <tr><td style="padding:0 32px;"><div style="border-top:1px solid #eef2f7;"></div></td></tr>
          <tr>
            <td style="padding:20px 32px 32px 32px;">
              <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6;">
                If you didn't request a password reset, you can safely ignore this email — your password won't change. For your security, never share this code with anyone.
              </p>
            </td>
          </tr>`;

  return renderEmailLayout({
    title: 'Password Reset OTP',
    preheader: `Your CollabDocs password reset code is ${otp}. It expires in 10 minutes.`,
    content,
  });
}

function renderVerificationHtml(verifyUrl: string, greetingName: string): string {
  const content = `
          <tr>
            <td style="padding:36px 32px 8px 32px;">
              <h1 style="margin:0 0 6px 0;font-size:22px;font-weight:800;color:#0f172a;letter-spacing:-0.4px;">Verify your email</h1>
              <p style="margin:0 0 4px 0;font-size:15px;color:#475569;">Hello ${greetingName},</p>
              <p style="margin:0 0 24px 0;font-size:15px;color:#64748b;line-height:1.5;">Confirm your email address to finish setting up your CollabDocs account. This link expires in 24 hours.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 32px 28px 32px;">
              <a href="${verifyUrl}" style="display:inline-block;background-color:#0f172a;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:13px 30px;border-radius:10px;">Verify email</a>
            </td>
          </tr>
          <tr><td style="padding:0 32px;"><div style="border-top:1px solid #eef2f7;"></div></td></tr>
          <tr>
            <td style="padding:20px 32px 32px 32px;">
              <p style="margin:0 0 10px 0;font-size:13px;color:#94a3b8;line-height:1.6;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin:0;font-size:12px;color:#64748b;word-break:break-all;">
                <a href="${verifyUrl}" style="color:#2563eb;text-decoration:underline;">${verifyUrl}</a>
              </p>
              <p style="margin:16px 0 0 0;font-size:13px;color:#94a3b8;line-height:1.6;">
                If you didn't create a CollabDocs account, you can safely ignore this email.
              </p>
            </td>
          </tr>`;

  return renderEmailLayout({
    title: 'Verify your CollabDocs email',
    preheader: 'Confirm your email address to finish setting up your CollabDocs account.',
    content,
  });
}

export async function sendPasswordResetOtpEmail(to: string, otp: string, displayName?: string): Promise<void> {
  const greetingName = displayName?.trim() || to.split('@')[0];

  try {
    await dispatchEmail({
      to,
      subject: 'Password Reset OTP',
      text:
        `Hello ${greetingName},\n\n` +
        `Your password reset verification code is:\n\n${otp}\n\n` +
        `This OTP is valid for 10 minutes.\n\n` +
        `If you didn't request this, please ignore this email.`,
      html: renderOtpHtml(otp, greetingName),
      devLog: { otp },
    });
  } catch (err) {
    // Surface the real failure in logs — callers fire-and-forget, so without
    // this a failed send is invisible (the user still sees "code sent").
    logger.error({ to, err: (err as Error).message }, '[mailer] FAILED to send password reset OTP');
    throw err;
  }
}
