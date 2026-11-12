'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { updateUserAnalyticsConsent } from '@/src/data/auth';
import { getCurrentUser } from '@/src/libs/authSession';

export async function updateAnalyticsConsentAction(granted: boolean) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const updated = await updateUserAnalyticsConsent(user.uid, Boolean(granted));
  revalidatePath('/settings/privacy');
  revalidatePath('/settings/accounts');

  return {
    analyticsConsent: updated.analyticsConsent,
    updatedAt: updated.analyticsConsentUpdatedAt
      ? updated.analyticsConsentUpdatedAt.toISOString()
      : null,
  };
}
