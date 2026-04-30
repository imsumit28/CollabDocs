import nodemailer from 'nodemailer';

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
    console.log(`[mailer] SMTP not configured — verification URL for ${to}:\n  ${verifyUrl}`);
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
