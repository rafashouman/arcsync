'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, LoaderCircle } from 'lucide-react';

export default function SignOutButton({ email }: { email: string | null }) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const signOut = async () => {
    setIsSigningOut(true);
    setErrorMessage('');
    try {
      const response = await fetch('/api/auth/session', {
        method: 'DELETE',
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error('O servidor não encerrou a sessão.');
      }
      router.replace('/login');
      router.refresh();
    } catch (error) {
      console.error('Erro ao encerrar sessão:', error);
      setErrorMessage('Não foi possível sair. Tente novamente.');
      setIsSigningOut(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <span className="hidden max-w-[220px] truncate text-xs text-slate-400 sm:inline">
        {email ?? 'Conta Arcsync'}
      </span>
      {errorMessage && (
        <span role="alert" className="text-[11px] text-rose-300">
          {errorMessage}
        </span>
      )}
      <button
        type="button"
        onClick={() => void signOut()}
        disabled={isSigningOut}
        aria-label="Sair da conta"
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/[0.08] px-3 text-xs font-medium text-slate-300 transition hover:border-white/15 hover:bg-white/[0.04] hover:text-white disabled:opacity-50"
      >
        {isSigningOut ? (
          <LoaderCircle size={14} className="animate-spin" />
        ) : (
          <LogOut size={14} />
        )}
        Sair
      </button>
    </div>
  );
}
