import type { Metadata } from 'next';
import ForgotPasswordForm from '@/src/components/ForgotPasswordForm';

export const metadata: Metadata = {
  title: 'Recuperar senha | Arcsync',
  description: 'Solicite um link seguro para redefinir sua senha do Arcsync.',
};

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <ForgotPasswordForm />
    </main>
  );
}
