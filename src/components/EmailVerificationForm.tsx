'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LoaderCircle } from 'lucide-react';

export default function EmailVerificationForm({ token }: { token: string }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const confirmEmail = async () => {
    if (isSubmitting || !/^[A-Za-z0-9_-]{43}$/.test(token)) return;

    setIsSubmitting(true);
    setMessage('');
    setErrorMessage('');
    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
        cache: 'no-store',
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const error =
          result &&
          typeof result === 'object' &&
          'error' in result &&
          typeof result.error === 'string'
            ? result.error
            : 'Não foi possível confirmar o e-mail.';
        setErrorMessage(error);
        return;
      }
      setMessage('E-mail confirmado. Agora você já pode entrar no Arcsync.');
    } catch {
      setErrorMessage(
        'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const tokenIsValid = /^[A-Za-z0-9_-]{43}$/.test(token);

  return (
    <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#11151f] p-6 shadow-2xl shadow-black/30 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-300">
        Verificação de conta
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
        Confirme seu e-mail
      </h1>
      <p className="mt-2 text-sm leading-6 text-slate-400">
        {tokenIsValid
          ? 'Clique no botão para confirmar que este endereço de e-mail é seu.'
          : 'Este link de verificação está incompleto ou inválido.'}
      </p>

      {errorMessage && (
        <p role="alert" className="mt-5 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-3 text-xs leading-5 text-rose-200">
          {errorMessage}
        </p>
      )}
      {message && (
        <p role="status" className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-3 text-xs leading-5 text-emerald-100">
          {message}
        </p>
      )}

      {tokenIsValid && !message && (
        <button
          type="button"
          onClick={confirmEmail}
          disabled={isSubmitting}
          className="mt-6 flex h-11 w-full items-center justify-center rounded-xl bg-indigo-500 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? <LoaderCircle size={17} className="animate-spin" /> : 'Confirmar e-mail'}
        </button>
      )}

      <Link
        href="/login"
        className="mt-6 inline-flex w-full items-center justify-center text-xs font-medium text-indigo-300 transition hover:text-indigo-200"
      >
        Ir para entrar
      </Link>
    </div>
  );
}
