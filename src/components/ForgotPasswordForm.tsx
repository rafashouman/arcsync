'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, LoaderCircle, Mail } from 'lucide-react';

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage('');
    setMessage('');
    try {
      const response = await fetch('/api/auth/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
        cache: 'no-store',
      });
      let result: unknown = null;
      try {
        result = await response.json();
      } catch {
        result = null;
      }

      if (!response.ok) {
        const error =
          result &&
          typeof result === 'object' &&
          'error' in result &&
          typeof result.error === 'string'
            ? result.error
            : 'Não foi possível solicitar a recuperação agora.';
        setErrorMessage(error);
        return;
      }

      setMessage(
        'Se houver uma conta com esse e-mail, enviaremos um link de recuperação válido por uma hora.',
      );
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
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-300">
        Recuperação de conta
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
        Esqueceu sua senha?
      </h1>
      <p className="mt-2 text-sm leading-6 text-slate-400">
        Informe o e-mail da conta. Se ele estiver cadastrado, enviaremos um link
        para criar uma nova senha.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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

        {errorMessage && (
          <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-3 text-xs leading-5 text-rose-200">
            {errorMessage}
          </p>
        )}
        {message && (
          <p role="status" className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-3 text-xs leading-5 text-emerald-100">
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 text-sm font-semibold text-white shadow-lg shadow-indigo-950/30 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? (
            <LoaderCircle size={17} className="animate-spin" />
          ) : (
            'Enviar link de recuperação'
          )}
        </button>
      </form>

      <Link
        href="/login"
        className="mt-6 inline-flex w-full items-center justify-center gap-2 text-xs font-medium text-indigo-300 transition hover:text-indigo-200"
      >
        <ArrowLeft size={14} />
        Voltar para entrar
      </Link>
    </div>
  );
}
