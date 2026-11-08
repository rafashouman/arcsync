import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import AuthForm from '@/src/components/AuthForm';

export const metadata: Metadata = {
  title: 'Entrar | Arcsync',
  description: 'Entre ou crie sua conta Arcsync.',
};

interface LoginPageProps {
  searchParams: Promise<{ next?: string }>;
}

async function LoginContent({
  searchParams,
}: LoginPageProps) {
  const { next } = await searchParams;
  const candidate =
    typeof next === 'string' &&
    /^\/(?!\/)/.test(next) &&
    !next.includes('\\') &&
    !/[\u0000-\u001f]/.test(next)
      ? new URL(next, 'https://arcsync.invalid')
      : null;
  const redirectTo =
    candidate?.origin === 'https://arcsync.invalid'
      ? `${candidate.pathname}${candidate.search}${candidate.hash}`
      : '/';

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <AuthForm redirectTo={redirectTo} />
        <nav className="mt-5 flex flex-wrap justify-center gap-4 text-xs text-slate-400" aria-label="Informações públicas"><Link href="/about">Sobre</Link><Link href="/privacy">Privacidade</Link><Link href="/terms">Termos</Link><Link href="/support">Suporte</Link></nav>
        <p className="mt-5 text-center text-[11px] leading-5 text-slate-600">
          Suas publicações e arquivos são privados e vinculados à sua conta.
        </p>
      </div>
    </main>
  );
}

export default function LoginPage(props: LoginPageProps) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center text-sm text-slate-500">
          Carregando...
        </main>
      }
    >
      <LoginContent {...props} />
    </Suspense>
  );
}
