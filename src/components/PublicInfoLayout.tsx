import Link from 'next/link';
import { Suspense, type ReactNode } from 'react';
import { connection } from 'next/server';

export default function PublicInfoLayout({title, children}: {title:string; children:ReactNode}) {
  return <Suspense fallback={<main className="p-12">Carregando informações…</main>}><PublicInfoContent title={title}>{children}</PublicInfoContent></Suspense>;
}

async function PublicInfoContent({title, children}: {title:string; children:ReactNode}) {
  await connection();
  const operator = process.env.LEGAL_OPERATOR_NAME?.trim();
  const contact = process.env.SUPPORT_EMAIL?.trim();
  const validContact = contact && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(contact);
  return <main className="mx-auto w-full max-w-3xl space-y-6 px-6 py-12 text-slate-200">
    <h1 className="text-3xl font-semibold">{title}</h1>
    {(!operator || !validContact) && <p role="status" className="rounded border border-amber-300/30 p-3 text-sm text-amber-200">Ambiente de preparação. Os dados do responsável e o contato de suporte precisam ser preenchidos antes da abertura ao público.</p>}
    <div className="space-y-5 leading-7">{children}</div>
    <footer className="space-y-3 border-t border-white/10 pt-6 text-sm text-slate-400">
      {operator && <p>Responsável: {operator}</p>}
      {validContact && <p>Contato: <a className="underline" href={`mailto:${contact}`}>{contact}</a></p>}
      <nav className="flex flex-wrap gap-4" aria-label="Informações públicas">
        <Link href="/about">Sobre</Link><Link href="/privacy">Privacidade</Link><Link href="/terms">Termos</Link><Link href="/support">Suporte</Link><Link href="/data-deletion">Exclusão de dados</Link><Link href="/login">Entrar</Link>
      </nav>
    </footer>
  </main>;
}
