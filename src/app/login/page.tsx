import type { Metadata } from 'next';
import { Suspense } from 'react';
import AuthForm from '@/src/components/AuthForm';

export const metadata: Metadata = {
  title: 'Entrar | FeedSync',
  description: 'Entre ou crie sua conta FeedSync.',
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
      ? new URL(next, 'https://feedsync.invalid')
      : null;
  const redirectTo =
    candidate?.origin === 'https://feedsync.invalid'
      ? `${candidate.pathname}${candidate.search}${candidate.hash}`
      : '/';

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-7 flex items-center justify-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 to-violet-600 font-bold text-white shadow-lg shadow-indigo-950/50">
            F
          </div>
          <span className="text-lg font-semibold tracking-tight text-white">
            Feed<span className="text-indigo-300">Sync</span>
          </span>
        </div>
        <AuthForm redirectTo={redirectTo} />
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
