import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { Suspense } from "react";
import "./globals.css";
import AnalyticsConsentSync from '@/src/components/AnalyticsConsentSync';
import AppNavigation from '@/src/components/AppNavigation';
import { getCurrentUser } from '@/src/libs/authSession';

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

async function UserAnalyticsConsentSync() {
  const user = await getCurrentUser();
  if (!user) return null;
  return <AnalyticsConsentSync granted={Boolean(user.analyticsConsent)} />;
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head><script dangerouslySetInnerHTML={{ __html: "try{document.documentElement.dataset.theme=localStorage.getItem('arcsync-theme')==='light'?'light':'dark'}catch{}" }}/></head>
      <body className="min-h-full flex flex-col">
        <AppNavigation />
        <div id="page-content" tabIndex={-1}>{children}</div>
        <Suspense fallback={null}>
          <UserAnalyticsConsentSync />
        </Suspense>
        <Script
          src="https://www.googletagmanager.com/gtm.js?id=GTM-P8MB87PK"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            var analyticsConsent = 'denied';
            try {
              if (localStorage.getItem('arcsync-analytics-consent') === 'granted') {
                analyticsConsent = 'granted';
              }
            } catch {}
            gtag('consent', 'default', {
              analytics_storage: analyticsConsent
            });
            gtag('js', new Date());
            gtag('config', 'G-JW630EJ2RD');
          `}
        </Script>
      </body>
    </html>
  );
}
