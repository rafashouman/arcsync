import Link from 'next/link';
import ResetPasswordForm from '@/src/components/ResetPasswordForm';

export default async function ResetPasswordContent({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token: tokenValue } = await searchParams;
  const token = typeof tokenValue === 'string' ? tokenValue : '';
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return (
      <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#11151f] p-6 text-center shadow-2xl shadow-black/30 sm:p-8">
        <h1 className="text-xl font-semibold text-white">
          Link inválido ou expirado
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Solicite um novo link de recuperação para continuar.
        </p>
        <Link
          href="/forgot-password"
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-indigo-500 text-sm font-semibold text-white transition hover:bg-indigo-400"
        >
          Solicitar novo link
        </Link>
      </div>
    );
  }
  return <ResetPasswordForm token={token} />;
}
