import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ThemeToggle from '@/src/components/ThemeToggle';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FeedSync | Planejamento social",
  description: "Planeje e organize seus posts para Instagram, Facebook, TikTok e YouTube.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head><script dangerouslySetInnerHTML={{ __html: "try{document.documentElement.dataset.theme=localStorage.getItem('feedsync-theme')==='light'?'light':'dark'}catch{}" }}/></head>
      <body className="min-h-full flex flex-col"><div className="appearance-bar"><ThemeToggle /></div>{children}</body>
    </html>
  );
}
