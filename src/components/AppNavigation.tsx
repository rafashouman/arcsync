'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import BrandLogo from './BrandLogo';
import ThemeToggle from './ThemeToggle';

const links = [['/', 'Início'], ['/calendar', 'Calendário'], ['/analytics', 'Estatísticas'], ['/monitoring', 'Monitoramento'], ['/settings/accounts', 'Contas sociais'], ['/settings/team', 'Equipe'], ['/settings/privacy', 'Privacidade'], ['/approvals', 'Aprovações']];
function NavigationLinks({ pathname }: { pathname?: string }) {
  return <nav aria-label="Navegação principal">{links.map(([href, label]) => <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined}>{label}</Link>)}</nav>;
}
function ActiveNavigation() { return <NavigationLinks pathname={usePathname()}/>; }
export default function AppNavigation() {
  return <header className="app-navigation">
    <a className="skip-link" href="#page-content">Pular para o conteúdo</a>
    <div className="app-navigation-top"><Link href="/" aria-label="Arcsync — início"><BrandLogo /></Link><ThemeToggle /></div>
    <Suspense fallback={<NavigationLinks/>}><ActiveNavigation/></Suspense>
  </header>;
}
