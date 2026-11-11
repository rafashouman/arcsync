import type { Metadata } from 'next';
import { Suspense } from 'react';
import EmailVerificationForm from '@/src/components/EmailVerificationForm';

export const metadata: Metadata = {
  title: 'Confirmar e-mail | Arcsync',
  robots: { index: false, follow: false },
};

interface VerifyEmailPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default function VerifyEmailPage(props: VerifyEmailPageProps) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Suspense fallback={<p className="text-sm text-slate-400">Carregando...</p>}>
        <VerifyEmailContent {...props} />
      </Suspense>
    </main>
  );
}

async function VerifyEmailContent({ searchParams }: VerifyEmailPageProps) {
  const { token } = await searchParams;
  return <EmailVerificationForm token={typeof token === 'string' ? token : ''} />;
}
