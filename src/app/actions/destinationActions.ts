'use server';
import { getCurrentUser } from '@/src/libs/authSession';
import { getWorkspaceContext } from '@/src/data/workspaces';
import { listInstagramAccountsForWorkspace } from '@/src/data/accounts';
import { listSocialAccountsForWorkspace } from '@/src/data/socialAccounts';
export async function listPostAccounts() {
  const user = await getCurrentUser();
  if (!user) return { accounts: [], error: 'Sua sessão expirou.' };
  try {
    const { workspaceId } = await getWorkspaceContext(user.uid, user.email);
    const [instagram, tiktok, youtube, facebook] = await Promise.all([listInstagramAccountsForWorkspace(workspaceId), listSocialAccountsForWorkspace(workspaceId, 'tiktok'), listSocialAccountsForWorkspace(workspaceId, 'youtube'), listSocialAccountsForWorkspace(workspaceId, 'facebook')]);
    return { accounts: [ ...facebook.map(a => ({id:a.id,name:a.accountName,platform:'facebook' as const})), ...instagram.map(a => ({ id:a.id, name:a.accountName, platform:'instagram' as const })), ...tiktok.map(a => ({ id:a.id,name:a.accountName,platform:'tiktok' as const })), ...youtube.map(a => ({ id:a.id,name:a.accountName,platform:'youtube' as const })) ], error: '' };
  } catch { return { accounts: [], error: 'Contas indisponíveis. Você pode preparar rascunhos e conectar as redes depois.' }; }
}
