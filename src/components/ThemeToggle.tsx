'use client';
import { Moon, Sun } from 'lucide-react';
export default function ThemeToggle() {
  function choose(theme: 'dark' | 'light') {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('arcsync-theme', theme); } catch { /* Keep the choice for this visit. */ }
  }
  return <div className="theme-switch" role="group" aria-label="Aparência"><button type="button" className="theme-light" onClick={() => choose('light')} aria-label="Usar modo claro"><Sun size={15}/> Claro</button><button type="button" className="theme-dark" onClick={() => choose('dark')} aria-label="Usar modo escuro"><Moon size={15}/> Escuro</button></div>;
}
