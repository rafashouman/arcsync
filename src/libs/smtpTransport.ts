import 'server-only';

import { createTransport } from 'nodemailer';
import { getSmtpConfiguration } from '@/src/libs/passwordResetConfig';

export function createSmtpTransport() {
  const smtp = getSmtpConfiguration();
  if (!smtp) {
    throw new Error(
      'Configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD e SMTP_FROM.',
    );
  }

  return {
    from: smtp.from,
    transporter: createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465,
      requireTLS: smtp.port !== 465,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
      auth: { user: smtp.user, pass: smtp.password },
      tls: { minVersion: 'TLSv1.2' },
    }),
  };
}
