import 'server-only';

import { createTransport } from 'nodemailer';
import {
  getPasswordResetUrl,
  getSmtpConfiguration,
} from '@/src/libs/passwordResetConfig';

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function isPasswordResetEmailConfigured() {
  return Boolean(
    getSmtpConfiguration() && getPasswordResetUrl('A'.repeat(43)),
  );
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const smtp = getSmtpConfiguration();
  const resetUrl = getPasswordResetUrl(token);
  if (!smtp || !resetUrl) {
    throw new Error(
      'Configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM e PUBLIC_APP_URL.',
    );
  }

  const transporter = createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    requireTLS: smtp.port !== 465,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
    auth: { user: smtp.user, pass: smtp.password },
    tls: { minVersion: 'TLSv1.2' },
  });
  const safeUrl = escapeHtml(resetUrl);

  await transporter.sendMail({
    from: smtp.from,
    to: email,
    subject: 'Redefina sua senha do FeedSync',
    text: [
      'Recebemos uma solicitação para redefinir sua senha do FeedSync.',
      `Use este link em até uma hora: ${resetUrl}`,
      'Se você não solicitou a redefinição, ignore este e-mail.',
    ].join('\n\n'),
    html: [
      '<p>Recebemos uma solicitação para redefinir sua senha do FeedSync.</p>',
      `<p><a href="${safeUrl}">Redefinir senha</a></p>`,
      '<p>O link expira em uma hora. Se você não solicitou a redefinição, ignore este e-mail.</p>',
    ].join(''),
  });
}
