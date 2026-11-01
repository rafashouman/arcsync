'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowRight, LoaderCircle, LockKeyhole } from 'lucide-react';

export default function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    if (password !== confirmation) {
      setErrorMessage('As senhas não correspondem.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const response = await fetch('/api/auth/password-reset/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
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
            : 'Não foi possível redefinir a senha.';
        setErrorMessage(error);
        return;
      }
      setIsComplete(true);
    } catch {
      setErrorMessage(
        'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isComplete) {
    return (
      <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#11151f] p-6 text-center shadow-2xl shadow-black/30 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Senha atualizada
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Suas sessões anteriores foram encerradas. Entre novamente com a nova senha.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 text-sm font-semibold text-white transition hover:bg-indigo-400"
        >
          Ir para o login
          <ArrowRight size={16} />
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#11151f] p-6 shadow-2xl shadow-black/30 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-300">
        Recuperação de conta
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
        Crie uma nova senha
      </h1>
      <p className="mt-2 text-sm leading-6 text-slate-400">
        A senha deve ter entre 12 e 128 caracteres.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-slate-300">Nova senha</span>
          <span className="relative block">
            <LockKeyhole
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 w-full rounded-xl border border-white/[0.09] bg-[#0c1018] pl-10 pr-3 text-sm text-slate-100 outline-none transition focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-400/10"
            />
          </span>
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-slate-300">
            Confirme a nova senha
          </span>
          <input
            type="password"
            name="passwordConfirmation"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            className="h-11 w-full rounded-xl border border-white/[0.09] bg-[#0c1018] px-3 text-sm text-slate-100 outline-none transition focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-400/10"
          />
        </label>

        {errorMessage && (
          <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-3 text-xs leading-5 text-rose-200">
            {errorMessage}
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
            <>
              Salvar nova senha
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
