import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink, rmdir } from 'node:fs/promises';
import path from 'node:path';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27119/feedsync_mvp_integration';
process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString('base64');
process.env.MEDIA_URL_SIGNING_KEY = randomBytes(32).toString('base64');
process.env.PUBLIC_APP_URL = 'https://test.example';
process.env.TIKTOK_CLIENT_AUDITED = 'true';
const {default: mongoose} = await import('mongoose');
const data = await import('../src/data/posts');
const {Post} = await import('../src/models/Post');
const {Account} = await import('../src/models/Account');
const {saveSocialAccount, listSocialAccountsForWorkspace} = await import('../src/data/socialAccounts');
const {publishClaimedPost} = await import('../src/libs/postPublisher');
const {getMediaOwnerKey, getMediaFilePath} = await import('../src/libs/mediaStorage');
const {exchangeFacebookAuthorizationCode} = await import('../src/libs/facebookOAuth');
const workspace = `provider-test-${randomUUID()}`;
const owner = getMediaOwnerKey(workspace);
const filename = `${randomUUID()}.mp4`;
const file = getMediaFilePath(owner,filename)!;
const originalFetch = globalThis.fetch;
let calls = 0;
let failInit = false;
const box = (type:string, payload:Buffer) => {const header=Buffer.alloc(8);header.writeUInt32BE(payload.length+8);header.write(type,4);return Buffer.concat([header,payload]);};
try {
  // OAuth never reaches a provider: validates permission gate and page filtering.
  const pages = await exchangeFacebookAuthorizationCode({clientId:'fake',clientSecret:'fake',redirectUri:'https://test.example/api/social/facebook/callback',version:'v26.0'},'fake',async input => {
    const url = String(input);
    if (url.includes('oauth/access_token')) return Response.json({access_token:'fake',expires_in:3600});
    if (url.includes('me/permissions')) return Response.json({data:['pages_show_list','pages_read_engagement','pages_manage_posts'].map(permission => ({permission,status:'granted'}))});
    assert.ok(url.includes('me/accounts'));
    return Response.json({data:[{id:'123',name:'Test Page',access_token:'fake-page',tasks:['CREATE_CONTENT']},{id:'456',name:'Not allowed',access_token:'fake',tasks:['ANALYZE']}]});
  });
  assert.equal(pages.length,1);
  await assert.rejects(exchangeFacebookAuthorizationCode({clientId:'fake',clientSecret:'fake',redirectUri:'https://test.example/api/social/facebook/callback',version:'v26.0'},'fake',async input => String(input).includes('oauth/access_token') ? Response.json({access_token:'fake'}) : Response.json({data:[]})));
  await saveSocialAccount(workspace,workspace,'facebook',pages[0]);
  await saveSocialAccount(workspace,workspace,'tiktok',{...pages[0],platformAccountId:'tiktok-test',refreshToken:'fake-refresh',permissions:['video.publish']});
  const facebook = (await listSocialAccountsForWorkspace(workspace,'facebook'))[0];
  const tiktok = (await listSocialAccountsForWorkspace(workspace,'tiktok'))[0];
  globalThis.fetch = async (input,init) => {
    const url = String(input);
    if (url.includes('graph.facebook.com')) { calls++; return Response.json({id:'123_987'}); }
    if (url.includes('creator_info')) return Response.json({error:{code:'ok'},data:{creator_nickname:'Test',privacy_level_options:['SELF_ONLY'],comment_disabled:false,duet_disabled:false,stitch_disabled:false,max_video_post_duration_sec:60}});
    if (url.includes('video/init/')) {calls++; assert.equal(JSON.parse(String(init?.body)).source_info.source,'PULL_FROM_URL'); if (failInit) throw new Error('simulated timeout'); return Response.json({error:{code:'ok'},data:{publish_id:'test-publish'}});}
    if (url.includes('status/fetch')) return Response.json({error:{code:'ok'},data:{status:'PUBLISH_COMPLETE',publicly_available_post_id:['tiktok-done']}});
    throw new Error(`Unexpected simulated route: ${new URL(url).hostname}`);
  };
  const first = new Date(Date.now()-1000).toISOString();
  const post = await data.createPostForWorkspace(workspace,workspace,{caption:'Local only',platforms:['facebook'],scheduledFor:first,timeZone:'UTC',mediaUrls:[],destinations:[{platform:'facebook',accountId:facebook.id,format:'feed',scheduledFor:first}]});
  let claimed = await data.claimDuePost(new Date(),randomUUID(),600000);
  assert.equal(claimed?._id,post._id);
  assert.equal(await publishClaimedPost(claimed!),'published');
  assert.equal(calls,1);
  assert.equal((await data.getPostForWorkspace(workspace,post._id))?.platformStatuses?.[0].externalId,'123_987');
  const payload = Buffer.alloc(20); payload.writeUInt32BE(1000,12); payload.writeUInt32BE(2000,16);
  await mkdir(path.dirname(file),{recursive:true});
  await writeFile(file,Buffer.concat([box('ftyp',Buffer.from('isom')),box('moov',box('mvhd',payload))]));
  for (const fail of [false,true]) {
    failInit=fail;
    const input = {caption:'TikTok simulation',platforms:['tiktok' as const],scheduledFor:first,timeZone:'UTC',mediaUrls:[`/api/media/${owner}/${filename}`],tiktokPrivacyLevel:'SELF_ONLY' as const,tiktokConsentAt:new Date().toISOString(),destinations:[{platform:'tiktok' as const,accountId:tiktok.id,format:'video' as const,scheduledFor:first}]};
    const post = await data.createPostForWorkspace(workspace,workspace,input);
    claimed = await data.claimDuePost(new Date(),randomUUID(),600000);
    assert.equal(claimed?._id,post._id);
    assert.equal(await publishClaimedPost(claimed!),fail ? 'uncertain' : 'waiting');
    const stored = await data.getPostForWorkspace(workspace,post._id);
    if (fail) { assert.equal(stored?.publishMayHaveSucceeded,true); assert.equal(await data.retryFailedPostForWorkspace(workspace,post._id,new Date()),null); }
    else {
      const beforePoll: number = calls;
      await Post.updateOne({_id:post._id,workspaceId:workspace},{$set:{nextAttemptAt:new Date(0)}});
      claimed = await data.claimDuePost(new Date(Date.now()+120000),randomUUID(),600000);
      assert.equal(claimed?._id,post._id);
      assert.equal(await publishClaimedPost(claimed!),'published');
      assert.equal(calls,beforePoll);
    }
  }
  console.log('PASS: Facebook OAuth permissions, persistence and dispatch; TikTok URL transfer, polling and uncertain-result retry lock. All provider responses simulated.');
} finally {
  globalThis.fetch = originalFetch;
  if (mongoose.connection.readyState === 1) {await Post.deleteMany({workspaceId:workspace});await Account.deleteMany({workspaceId:workspace});}
  await mongoose.disconnect();
  await unlink(file).catch(() => {});
  await rmdir(path.dirname(file)).catch(() => {});
}
