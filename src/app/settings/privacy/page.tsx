import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import AnalyticsConsentCard from '@/src/components/AnalyticsConsentCard';
import SignOutButton from '@/src/components/SignOutButton';
import { getUserAnalyticsConsent } from '@/src/data/auth';
import { getCurrentUser } from '@/src/libs/authSession';

export const metadata: Metadata = {
  title: 'Privacidade e consentimento | Arcsync',
  description: 'Gerencie suas preferências de privacidade e consentimento de analytics no Arcsync.',
};

async function PrivacySettingsContent() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const consentData = process.env.MONGODB_URI
    ? await getUserAnalyticsConsent(user.uid)
    : null;

  return (
    <main className="min-h-screen px-4 py-6 text-slate-200 sm:px-7 sm:py-9">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
          >
            <ArrowLeft size={16} />
            Voltar ao início
          </Link>
          <SignOutButton email={user.email} />
        </header>

        <div className="mb-6 flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-400/10 text-indigo-300">
            <ShieldCheck size={19} />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-300">
              Administração do usuário
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-white">
              Privacidade e consentimento
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Controle suas preferências de coleta de métricas e analytics associadas à sua conta.
            </p>
          </div>
        </div>

        <AnalyticsConsentCard
          initialConsent={consentData?.analyticsConsent ?? Boolean(user.analyticsConsent)}
          updatedAt={
            consentData?.analyticsConsentUpdatedAt
              ? consentData.analyticsConsentUpdatedAt.toISOString()
              : null
          }
          userEmail={user.email}
        />
      </div>
    </main>
  );
}

export default function PrivacySettingsPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center text-sm text-slate-500">
          Carregando preferências de privacidade...
        </main>
      }
    >
      <PrivacySettingsContent />
    </Suspense>
  );
}
