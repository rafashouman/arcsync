import 'server-only';
import { assertRedirectUri, isRecord, SocialOAuthConfigurationError, SocialOAuthProviderError, type ConnectedSocialAccount } from '@/src/libs/socialOAuth';

export const FACEBOOK_SCOPES = ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts'];

export function getFacebookOAuthConfig() {
  const clientId = process.env.FACEBOOK_APP_ID?.trim();
  const clientSecret = process.env.FACEBOOK_APP_SECRET?.trim();
  const redirectUri = process.env.FACEBOOK_REDIRECT_URI?.trim();
  const version = process.env.FACEBOOK_GRAPH_API_VERSION?.trim() || 'v26.0';
  if (!clientId || !clientSecret || !redirectUri || !/^v\d+\.0$/.test(version)) throw new SocialOAuthConfigurationError();
  assertRedirectUri(redirectUri, '/api/social/facebook/callback', 'FACEBOOK_REDIRECT_URI', true);
  return { clientId, clientSecret, redirectUri, version };
}

export function createFacebookAuthorizationUrl(config: ReturnType<typeof getFacebookOAuthConfig>, state: string) {
  const url = new URL(`https://www.facebook.com/${config.version}/dialog/oauth`);
  url.search = new URLSearchParams({client_id:config.clientId, redirect_uri:config.redirectUri, state, response_type:'code', scope:FACEBOOK_SCOPES.join(',')}).toString();
  return url.toString();
}

export async function exchangeFacebookAuthorizationCode(config: ReturnType<typeof getFacebookOAuthConfig>, code: string, fetcher: typeof fetch = fetch): Promise<ConnectedSocialAccount[]> {
  async function get(path: string, params: Record<string,string>, token?: string) {
    const url = new URL(`https://graph.facebook.com/${config.version}/${path}`);
    url.search = new URLSearchParams(params).toString();
    let response: Response;
    try { response = await fetcher(url, {headers:token ? {Authorization:`Bearer ${token}`} : {}, cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)}); }
    catch { throw new SocialOAuthProviderError('Não foi possível acessar o Facebook.'); }
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok || !isRecord(body) || body.error) throw new SocialOAuthProviderError('O Facebook recusou a conexão. Confira as permissões e reconecte.');
    return body;
  }
  const short = await get('oauth/access_token', {client_id:config.clientId,client_secret:config.clientSecret,redirect_uri:config.redirectUri,code});
  if (typeof short.access_token !== 'string') throw new SocialOAuthProviderError();
  const long = await get('oauth/access_token', {grant_type:'fb_exchange_token',client_id:config.clientId,client_secret:config.clientSecret,fb_exchange_token:short.access_token});
  if (typeof long.access_token !== 'string') throw new SocialOAuthProviderError();
  const granted = await get('me/permissions', {}, long.access_token);
  const permissions = Array.isArray(granted.data) ? granted.data : [];
  if (!FACEBOOK_SCOPES.every(scope => permissions.some((p: unknown) => isRecord(p) && p.permission === scope && p.status === 'granted'))) throw new SocialOAuthProviderError('O Facebook não concedeu as permissões de Páginas necessárias.');
  const result: ConnectedSocialAccount[] = [];
  let after = '';
  for (let page = 0; page < 20; page++) {
    const body = await get('me/accounts', {fields:'id,name,access_token,tasks',limit:'100',...(after ? {after} : {})}, long.access_token);
    if (!Array.isArray(body.data)) throw new SocialOAuthProviderError();
    for (const item of body.data) {
      if (!isRecord(item) || typeof item.id !== 'string' || !/^\d+$/.test(item.id) || typeof item.name !== 'string' || typeof item.access_token !== 'string') continue;
      if (!Array.isArray(item.tasks) || !item.tasks.some(task => task === 'CREATE_CONTENT' || task === 'MANAGE')) continue;
      result.push({platformAccountId:item.id,accountName:item.name,accessToken:item.access_token,accessTokenExpiresAt:null,refreshToken:'',refreshTokenExpiresAt:null,permissions:FACEBOOK_SCOPES});
    }
    const paging = isRecord(body.paging) ? body.paging : undefined;
    if (!paging?.next) break;
    const cursors = isRecord(paging.cursors) ? paging.cursors : undefined;
    if (typeof cursors?.after !== 'string' || cursors.after === after || page === 19) throw new SocialOAuthProviderError('Não foi possível listar todas as Páginas autorizadas.');
    after = cursors.after;
  }
  if (!result.length) throw new SocialOAuthProviderError('Nenhuma Página com permissão para criar conteúdo foi autorizada.');
  return result;
}
