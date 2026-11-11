import 'server-only';

import { getEmailVerificationUrl, getSmtpConfiguration } from '@/src/libs/passwordResetConfig';
import { createSmtpTransport } from '@/src/libs/smtpTransport';

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function isEmailVerificationEmailConfigured() {
  return Boolean(
    getSmtpConfiguration() && getEmailVerificationUrl('A'.repeat(43)),
  );
}

export async function sendEmailVerification(email: string, token: string) {
  const verificationUrl = getEmailVerificationUrl(token);
  if (!verificationUrl) {
    throw new Error(
      'Configure PUBLIC_APP_URL com uma origem HTTPS pública para verificar e-mails.',
    );
  }

  const { from, transporter } = createSmtpTransport();
  const safeUrl = escapeHtml(verificationUrl);

  await transporter.sendMail({
    from,
    to: email,
    subject: 'Confirme seu e-mail do Arcsync',
    text: [
      'Recebemos uma solicitação para criar uma conta no Arcsync com este e-mail.',
      `Para confirmar o endereço, acesse: ${verificationUrl}`,
      'O link expira em 24 horas e pode ser usado uma única vez.',
      'Se você não solicitou a criação da conta, ignore este e-mail.',
    ].join('\n\n'),
    html: [
      '<p>Recebemos uma solicitação para criar uma conta no Arcsync com este e-mail.</p>',
      `<p><a href="${safeUrl}">Confirmar meu e-mail</a></p>`,
      '<p>O link expira em 24 horas e pode ser usado uma única vez.</p>',
      '<p>Se você não solicitou a criação da conta, ignore este e-mail.</p>',
    ].join(''),
  });
}
