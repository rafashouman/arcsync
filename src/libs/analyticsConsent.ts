export const ANALYTICS_CONSENT_STORAGE_KEY = 'arcsync-analytics-consent';

export type AnalyticsConsentState = 'granted' | 'denied';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function applyAnalyticsConsent(granted: boolean): void {
  if (typeof window === 'undefined') return;
  const state: AnalyticsConsentState = granted ? 'granted' : 'denied';
  try {
    window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, state);
  } catch {
    // Ignore storage errors (e.g., private browsing restrictions)
  }
  if (typeof window.gtag === 'function') {
    window.gtag('consent', 'update', {
      analytics_storage: state,
    });
  }
}
