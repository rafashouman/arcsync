'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { CheckCircle2, LoaderCircle, ShieldCheck } from 'lucide-react';
import { updateAnalyticsConsentAction } from '@/src/app/actions/privacyActions';
import { applyAnalyticsConsent } from '@/src/libs/analyticsConsent';

interface AnalyticsConsentCardProps {
  initialConsent: boolean;
  updatedAt?: string | null;
  userEmail: string;
}

export default function AnalyticsConsentCard({
  initialConsent,
  updatedAt,
  userEmail,
}: AnalyticsConsentCardProps) {
  const [consent, setConsent] = useState(initialConsent);
  const [lastUpdated, setLastUpdated] = useState<string | null>(updatedAt ?? null);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleToggle = (nextValue: boolean) => {
    setErrorMessage('');
    setStatusMessage('');

    startTransition(async () => {
      try {
        const result = await updateAnalyticsConsentAction(nextValue);
        setConsent(result.analyticsConsent);
        setLastUpdated(result.updatedAt);
        applyAnalyticsConsent(result.analyticsConsent);
        setStatusMessage(
          result.analyticsConsent
            ? 'Consentimento de analytics ativado.'
            : 'Consentimento de analytics revogado.',
        );
      } catch {
        setErrorMessage('Não foi possível atualizar sua preferência de privacidade.');
      }
    });
  };

  return (
    <section
      aria-labelledby="analytics-consent-heading"
      className="rounded-2xl border border-white/[0.08] bg-[#11151f] p-6 shadow-xl shadow-black/20"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-400/10 text-indigo-300">
            <ShieldCheck size={20} />
          </span>
          <div>
            <h2
              id="analytics-consent-heading"
              className="text-base font-semibold text-white"
            >
              Consentimento de analytics e cookies
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Conta: <span className="text-slate-200">{userEmail}</span>
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Permite o uso do Google Analytics para medir o uso do Arcsync e melhorar o produto. Você pode ativar ou revogar este consentimento a qualquer momento.
            </p>
            <p className="mt-2 text-xs text-slate-400">
              Status atual:{' '}
              <span
                className={
                  consent
                    ? 'font-medium text-emerald-300'
                    : 'font-medium text-slate-300'
                }
              >
                {consent ? 'Ativado' : 'Desativado'}
              </span>
              {lastUpdated && (
                <>
                  {' '}
                  • Atualizado em{' '}
                  {new Date(lastUpdated).toLocaleString('pt-BR')}
                </>
              )}
            </p>
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={consent}
          disabled={isPending}
          onClick={() => handleToggle(!consent)}
          className={`inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
            consent
              ? 'border border-emerald-400/30 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20'
              : 'bg-indigo-500 text-white hover:bg-indigo-400'
          }`}
        >
          {isPending ? (
            <LoaderCircle size={15} className="animate-spin" />
          ) : consent ? (
            'Revogar consentimento'
          ) : (
            'Permitir analytics'
          )}
        </button>
      </div>

      {statusMessage && (
        <p
          role="status"
          className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-2 text-xs text-emerald-200"
        >
          <CheckCircle2 size={15} className="shrink-0" />
          {statusMessage}
        </p>
      )}

      {errorMessage && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] px-3 py-2 text-xs text-rose-200"
        >
          {errorMessage}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-4 border-t border-white/[0.06] pt-4 text-xs text-slate-400">
        <Link href="/privacy" className="text-indigo-300 underline hover:text-indigo-200">
          Política de Privacidade
        </Link>
        <Link href="/data-deletion" className="text-indigo-300 underline hover:text-indigo-200">
          Solicitar exclusão de dados
        </Link>
      </div>
    </section>
  );
}
