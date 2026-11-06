import './server-only-register.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { youtubeMetadata, validateYouTubeOptions } from '../src/libs/youtubeMetadata.ts';
import { initializeTikTokVideoFromUrl } from '../src/libs/tiktokPublishingApi.ts';
import { publishFacebookPagePost } from '../src/libs/facebookPublishingApi.ts';
import { exchangeFacebookAuthorizationCode } from '../src/libs/facebookOAuth.ts';
import { validatePostInput } from '../src/libs/postValidation.ts';
import { TikTokPostingQuota } from '../src/models/TikTokPostingQuota.ts';
import {
  createInstagramAuthorizationUrl,
  exchangeInstagramAuthorizationCodeForAccounts,
} from '../src/libs/instagramOAuth.ts';

const youtube = {title:'Título próprio',description:'Descrição',privacyStatus:'unlisted',madeForKids:true,containsSyntheticMedia:true};
test('Mongoose accepts the TikTok quota aggregation update pipeline when enabled', () => {
  assert.doesNotThrow(() => TikTokPostingQuota.findOneAndUpdate(
    { _id: 'content-posting' },
    [{ $set: { users: [] } }],
    { returnDocument: 'after', updatePipeline: true },
  ));
});
test('YouTube defaults private and respects explicit metadata and disclosures', () => {
  assert.equal(youtubeMetadata('Título\nDescrição').status.privacyStatus,'private');
  const metadata = youtubeMetadata('Não usar',youtube);
  assert.equal(metadata.snippet.title,youtube.title);
  assert.equal(metadata.status.privacyStatus,'unlisted');
  assert.equal(metadata.status.selfDeclaredMadeForKids,true);
  assert.equal(metadata.status.containsSyntheticMedia,true);
  for (const options of [{...youtube,title:''},{...youtube,title:'x'.repeat(101)},{...youtube,description:'á'.repeat(2501)},{...youtube,privacyStatus:'invalid'},{...youtube,madeForKids:'false'}]) assert.ok(validateYouTubeOptions(options));
});
test('structured YouTube fields survive destination validation with empty common caption', () => {
  const owner = 'a'.repeat(64);
  const input = {caption:'',platforms:['youtube'],scheduledFor:'2030-01-01T00:00:00Z',timeZone:'UTC',mediaUrls:[],destinations:[{platform:'youtube',accountId:'b'.repeat(24),format:'video',youtube,mediaUrls:[`/api/media/${owner}/00000000-0000-0000-0000-000000000000.mp4`]}]};
  const result = validatePostInput(input,owner,false,0);
  assert.equal(typeof result,'object');
  assert.deepEqual(result.destinations[0].youtube,youtube);
});
test('TikTok requests PULL_FROM_URL without requiring upload_url', async () => {
  const result = await initializeTikTokVideoFromUrl('fake-token',{title:'Teste',privacyLevel:'SELF_ONLY',allowComments:false,allowDuet:false,allowStitch:false,brandOrganic:false,brandContent:false},'https://media.example/video.mp4?signature=fake',async (url,init) => {
    assert.match(String(url),/video\/init\/$/);
    const body = JSON.parse(init.body);
    assert.deepEqual(body.source_info,{source:'PULL_FROM_URL',video_url:'https://media.example/video.mp4?signature=fake'});
    assert.equal(body.post_info.disable_comment,true);
    return Response.json({data:{publish_id:'pub-1'},error:{code:'ok'}});
  });
  assert.equal(result.publishId,'pub-1');
  await assert.rejects(initializeTikTokVideoFromUrl('fake',{},'http://localhost/video.mp4',async () => {assert.fail('must not fetch');}));
  await assert.rejects(initializeTikTokVideoFromUrl('fake',{},'https://media.example/video.mp4',async () => Response.json({data:{},error:{code:'ok'}})));
});
test('Facebook text/photo routing and returned post identity', async () => {
  for (const photo of [undefined,'https://media.example/photo.jpg']) {
    assert.equal(await publishFacebookPagePost('123','fake','v26.0','Texto',photo,async (url,init) => {
      assert.ok(url.endsWith(photo ? '/photos' : '/feed'));
      assert.equal(init.headers.Authorization,'Bearer fake');
      const body = JSON.parse(init.body);
      assert.equal(body[photo ? 'caption' : 'message'],'Texto');
      return Response.json({id:'99',post_id:'123_99'});
    }),'123_99');
  }
});
test('Facebook distinguishes confirmed rejection from ambiguous network/server outcomes', async () => {
  for (const [fetcher,uncertain] of [
    [async () => {throw new Error('timeout');},true],
    [async () => Response.json({}, {status:500}),true],
    [async () => Response.json({}, {status:400}),false],
    [async () => Response.json({}),true],
  ]) await assert.rejects(publishFacebookPagePost('123','fake','v26.0','Texto',undefined,fetcher),e => e.mayHaveSucceeded === uncertain);
});
test('Facebook page tokens do not inherit the user authorization expiry', async () => {
  for (const expiresIn of [undefined, 3600]) {
    const pages = await exchangeFacebookAuthorizationCode(
      {clientId:'fake',clientSecret:'fake',redirectUri:'https://test.example/api/social/facebook/callback',version:'v26.0'},
      'code',
      async (input) => {
        const url = String(input);
        if (url.includes('oauth/access_token')) return Response.json({access_token:'user-token',expires_in:expiresIn});
        if (url.includes('me/permissions')) return Response.json({data:['pages_show_list','pages_read_engagement','pages_manage_posts'].map(permission => ({permission,status:'granted'}))});
        return Response.json({data:[{id:'123',name:'Page',access_token:'page-token',tasks:['CREATE_CONTENT']}]});
      },
    );
    assert.equal(pages[0].accessTokenExpiresAt, null);
    assert.equal(pages[0].accessToken, 'page-token');
  }
});
test('Facebook reports rejected page authorization without exposing provider details', async () => {
  await assert.rejects(
    publishFacebookPagePost('123','fake','v26.0','Texto',undefined,
      async () => Response.json({error:{code:190,message:'secret-provider-details'}}, {status:400})),
    (error) => {
      assert.match(error.message, /Reconecte a conta/);
      assert.doesNotMatch(error.message, /secret-provider-details/);
      assert.equal(error.mayHaveSucceeded, false);
      return true;
    },
  );
});
test('Facebook rejects unavailable formats and supports text without media', () => {
  const input = {caption:'Texto',platforms:['facebook'],scheduledFor:'2030-01-01T00:00:00Z',timeZone:'UTC',mediaUrls:[],destinations:[{platform:'facebook',accountId:'b'.repeat(24),format:'feed'}]};
  assert.equal(typeof validatePostInput(input,'a'.repeat(64),false,0),'object');
  assert.equal(typeof validatePostInput({...input,destinations:[{...input.destinations[0],format:'story'}]},'a'.repeat(64),false,0),'string');
});
test('Instagram supports Meta Unified Login (config_id) and Facebook Login over graph.facebook.com', async () => {
  const baseConfig = {
    clientId: 'meta-app-id',
    clientSecret: 'meta-secret',
    redirectUri: 'https://feedsync.example/api/social/meta/callback',
    graphApiVersion: 'v26.0',
    loginMode: 'facebook',
  };
  const fbLoginUrl = createInstagramAuthorizationUrl(baseConfig, 'state-1');
  assert.equal(fbLoginUrl.origin, 'https://www.facebook.com');
  assert.ok(fbLoginUrl.searchParams.get('scope')?.includes('instagram_content_publish'));

  const unifiedUrl = createInstagramAuthorizationUrl({ ...baseConfig, configId: 'cfg-999' }, 'state-2');
  assert.equal(unifiedUrl.searchParams.get('config_id'), 'cfg-999');
  assert.equal(unifiedUrl.searchParams.get('scope'), null);

  const accounts = await exchangeInstagramAuthorizationCodeForAccounts(
    { ...baseConfig, configId: 'cfg-999' },
    'auth-code',
    async (input) => {
      const url = String(input);
      if (url.includes('oauth/access_token')) {
        return Response.json({ access_token: 'EAA-unified-token' });
      }
      if (url.includes('me/permissions')) {
        return Response.json({
          data: [
            { permission: 'instagram_basic', status: 'granted' },
            { permission: 'instagram_content_publish', status: 'granted' },
          ],
        });
      }
      if (url.includes('me/accounts')) {
        return Response.json({ data: [] });
      }
      if (url.includes('me/assigned_instagram_accounts')) {
        return Response.json({
          data: [{ id: '17841400000000000', username: 'nexusync_oficial' }],
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
  );
  assert.equal(accounts.length, 1);
  assert.equal(accounts[0].platformAccountId, '17841400000000000');
  assert.equal(accounts[0].accountName, 'nexusync_oficial');
  assert.equal(accounts[0].accessToken, 'EAA-unified-token');
});
