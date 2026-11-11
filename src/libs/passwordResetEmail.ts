import 'server-only';

import {
  getPasswordResetUrl,
  getSmtpConfiguration,
} from '@/src/libs/passwordResetConfig';
import { createSmtpTransport } from '@/src/libs/smtpTransport';

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
  const resetUrl = getPasswordResetUrl(token);
  if (!getSmtpConfiguration() || !resetUrl) {
    throw new Error(
      'Configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM e PUBLIC_APP_URL.',
    );
  }

  const { from, transporter } = createSmtpTransport();
  const safeUrl = escapeHtml(resetUrl);

  await transporter.sendMail({
    from,
    to: email,
    subject: 'Redefina sua senha do Arcsync',
    text: [
      'Recebemos uma solicitação para redefinir sua senha do Arcsync.',
      `Use este link em até uma hora: ${resetUrl}`,
      'Se você não solicitou a redefinição, ignore este e-mail.',
    ].join('\n\n'),
    html: [
      '<p>Recebemos uma solicitação para redefinir sua senha do Arcsync.</p>',
      `<p><a href="${safeUrl}">Redefinir senha</a></p>`,
      '<p>O link expira em uma hora. Se você não solicitou a redefinição, ignore este e-mail.</p>',
    ].join(''),
  });
}
