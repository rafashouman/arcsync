'use client';

import { useEffect } from 'react';
import { applyAnalyticsConsent } from '@/src/libs/analyticsConsent';

export default function AnalyticsConsentSync({ granted }: { granted: boolean }) {
  useEffect(() => {
    applyAnalyticsConsent(granted);
  }, [granted]);

  return null;
}
