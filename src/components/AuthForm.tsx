'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  LoaderCircle,
  LockKeyhole,
  Mail,
} from 'lucide-react';

export default function AuthForm({ redirectTo = '/' }: { redirectTo?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const response = await fetch(
        mode === 'register' ? '/api/auth/register' : '/api/auth/session',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), password }),
          cache: 'no-store',
        },
      );

      let result: unknown = null;
      try {
        result = await response.json();
      } catch {
        result = null;
      }

      if (!response.ok) {
        const message =
          result &&
          typeof result === 'object' &&
          'error' in result &&
          typeof result.error === 'string' &&
          result.error.trim().length > 0
            ? result.error
            : 'Não foi possível autenticar. Tente novamente.';

        setErrorMessage(message);
        return;
      }

      router.replace(redirectTo);
      router.refresh();
    } catch {
      setErrorMessage(
        'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#11151f] p-6 shadow-2xl shadow-black/30 sm:p-8">
      <div className="mb-7">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-300">
          {mode === 'login' ? 'Bem-vindo de volta' : 'Comece a organizar'}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
          {mode === 'login' ? 'Entre no Arcsync' : 'Crie sua conta'}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Planeje seus conteúdos para Instagram, TikTok e YouTube em um só lugar.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-slate-300">E-mail</span>
          <span className="relative block">
            <Mail
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="voce@empresa.com"
              className="h-11 w-full rounded-xl border border-white/[0.09] bg-[#0c1018] pl-10 pr-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-400/10"
            />
          </span>
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-slate-300">Senha</span>
          <span className="relative block">
            <LockKeyhole
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              type="password"
              name="password"
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              required
              minLength={mode === 'register' ? 12 : 1}
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={
                mode === 'register' ? 'Mínimo de 12 caracteres' : 'Sua senha'
              }
              className="h-11 w-full rounded-xl border border-white/[0.09] bg-[#0c1018] pl-10 pr-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-400/10"
            />
          </span>
        </label>

        {errorMessage && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-3 text-xs leading-5 text-rose-200"
          >
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            {errorMessage}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 text-sm font-semibold text-white shadow-lg shadow-indigo-950/30 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? (
            <LoaderCircle size={17} className="animate-spin" />
          ) : (
            <>
              {mode === 'login' ? 'Entrar' : 'Criar conta'}
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-slate-500">
        {mode === 'login' ? 'Ainda não tem uma conta?' : 'Já tem uma conta?'}{' '}
        <button
          type="button"
          onClick={() => {
            setMode((current) =>
              current === 'login' ? 'register' : 'login',
            );
            setErrorMessage('');
          }}
          className="font-medium text-indigo-300 transition hover:text-indigo-200"
        >
          {mode === 'login' ? 'Criar conta' : 'Entrar'}
        </button>
      </p>
      {mode === 'login' && (
        <Link
          href="/forgot-password"
          className="mt-4 block text-center text-xs font-medium text-indigo-300 transition hover:text-indigo-200"
        >
          Esqueceu sua senha?
        </Link>
      )}
      <p className="mt-4 text-center text-[11px] leading-5 text-slate-600">
        As senhas são armazenadas com hash scrypt.
      </p>
    </div>
  );
}