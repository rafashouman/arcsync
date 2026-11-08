import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppNavigation from '@/src/components/AppNavigation';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Arcsync | Agendamento de publicações",
  description: "Planeje, organize e agende suas publicações para Instagram, Facebook, TikTok e YouTube com o Arcsync.",
  applicationName: "Arcsync",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head><script dangerouslySetInnerHTML={{ __html: "try{document.documentElement.dataset.theme=localStorage.getItem('arcsync-theme')==='light'?'light':'dark'}catch{}" }}/></head>
      <body className="min-h-full flex flex-col"><AppNavigation /><div id="page-content" tabIndex={-1}>{children}</div></body>
    </html>
  );
}
