import 'server-only';
import { stat } from 'fs/promises';
import { completeClaimedPlatform, failClaimedPlatform, updateClaimedPost, type ClaimedPost } from '@/src/data/posts';
import { getDefaultSocialAccountForWorkspace } from '@/src/data/socialAccounts';
import { getValidSocialAccessToken } from '@/src/libs/socialTokens';
import { createSignedMediaUrl, getMediaFilePath, getMediaOwnerKey } from '@/src/libs/mediaStorage';
import { getPublishingIssue } from '@/src/libs/postValidation';
import { upsertPublishRecord, type PlatformPublishRecord } from '@/src/libs/publishPlanning';
import { PlatformPublishError } from '@/src/libs/publishTypes';
import { FacebookPublishError, publishFacebookPagePost } from '@/src/libs/facebookPublishingApi';

export async function publishClaimedFacebookPost(post: ClaimedPost) {
  let states = post.publishStates;
  let uncertain = states.some(s => s.platform === 'facebook' && s.mayHaveSucceeded);
  try {
    if (uncertain) throw new FacebookPublishError('Confira a Página: o envio anterior ficou sem confirmação.', true);
    const issue = getPublishingIssue('facebook', post.caption, post.mediaUrls);
    if (issue) throw new FacebookPublishError(issue);
    const accountId = post.destinations?.find(d => d.platform === 'facebook')?.accountId;
    if (!accountId) throw new FacebookPublishError('Selecione uma Página do Facebook.');
    const account = await getDefaultSocialAccountForWorkspace(post.workspaceId, 'facebook', accountId);
    if (!account || !account.permissions.includes('pages_manage_posts')) throw new FacebookPublishError('Reconecte a Página com permissão para publicar.');
    const token = await getValidSocialAccessToken(post.workspaceId, 'facebook', accountId);
    const version = process.env.FACEBOOK_GRAPH_API_VERSION || 'v26.0';
    if (!/^v\d+\.0$/.test(version) || !/^\d+$/.test(account.platformAccountId)) throw new FacebookPublishError('Configuração do Facebook inválida.');
    let photoUrl: string | undefined;
    if (post.mediaUrls.length) {
      const match = /^\/api\/media\/([a-f\d]{64})\/([a-f\d-]{36}\.(jpg|png))$/i.exec(post.mediaUrls[0]);
      const owners = [...(post.mediaOwnerKeys ?? []), getMediaOwnerKey(post.userId), getMediaOwnerKey(post.workspaceId)];
      if (!match || !owners.includes(match[1])) throw new FacebookPublishError('Foto inválida ou de outro workspace.');
      const file = getMediaFilePath(match[1],match[2]);
      if (!file || !(await stat(file)).isFile()) throw new FacebookPublishError('Foto indisponível.');
      if (!process.env.PUBLIC_APP_URL?.startsWith('https://')) throw new FacebookPublishError('Configure a URL pública HTTPS da mídia.');
      photoUrl = createSignedMediaUrl(process.env.PUBLIC_APP_URL,match[1],match[2]);
    }
    const intent: PlatformPublishRecord = {platform:'facebook',state:'processing',mayHaveSucceeded:true,startedAt:new Date().toISOString()};
    states = upsertPublishRecord(states,intent);
    if (!await updateClaimedPost(post._id,post.processingRunId,{publishStates:states})) return 'lost-claim' as const;
    uncertain = true;
    const id = await publishFacebookPagePost(account.platformAccountId,token,version,post.caption,photoUrl);
    states = upsertPublishRecord(states,{platform:'facebook',state:'published',externalId:id,startedAt:intent.startedAt});
    return await completeClaimedPlatform(post,id,states) ? 'published' as const : 'lost-claim' as const;
  } catch (error) {
    if (error instanceof FacebookPublishError) uncertain = error.mayHaveSucceeded;
    if (!(error instanceof FacebookPublishError)) console.error('Facebook publish failed', error);
    const message = error instanceof FacebookPublishError || error instanceof PlatformPublishError ? error.message : 'Não foi possível publicar no Facebook. Confira a conexão e a mídia.';
    states = upsertPublishRecord(states,{platform:'facebook',state:'failed',error:message,mayHaveSucceeded:uncertain});
    await failClaimedPlatform(post,states,uncertain);
    return uncertain ? 'uncertain' as const : 'failed' as const;
  }
}
