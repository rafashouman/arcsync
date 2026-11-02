'use client';
import {useEffect, useTransition} from 'react';
import {useRouter} from 'next/navigation';
export default function MonitorRefresh() {
 const router = useRouter(); const [pending,startTransition] = useTransition();
 useEffect(() => { const timer = setInterval(() => {if(document.visibilityState === 'visible') startTransition(() => router.refresh());},30000); return () => clearInterval(timer); },[router]);
 return <button type="button" disabled={pending} onClick={() => startTransition(() => router.refresh())} className="rounded border border-white/20 px-3 py-2">{pending ? 'Atualizando...' : 'Atualizar agora'}<span className="ml-2 text-xs">Atualização automática a cada 30 segundos</span></button>;
}
