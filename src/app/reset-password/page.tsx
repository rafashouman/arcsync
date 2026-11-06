import type { Metadata } from 'next';
import { Suspense } from 'react';
import ResetPasswordContent from '@/src/components/ResetPasswordContent';

export const metadata: Metadata = {
  title: 'Redefinir senha | Arcsync',
  description: 'Crie uma nova senha para sua conta Arcsync.',
};

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center text-sm text-slate-500">
          Carregando recuperação...
        </main>
      }
    >
      <ResetPasswordContent searchParams={searchParams} />
    </Suspense>
  );
}
