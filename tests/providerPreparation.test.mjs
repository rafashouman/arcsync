import test from 'node:test';
import assert from 'node:assert/strict';
import { youtubeMetadata, validateYouTubeOptions } from '../src/libs/youtubeMetadata.ts';
import { initializeTikTokVideoFromUrl } from '../src/libs/tiktokPublishingApi.ts';
import { publishFacebookPagePost } from '../src/libs/facebookPublishingApi.ts';
import { validatePostInput } from '../src/libs/postValidation.ts';

const youtube = {title:'Título próprio',description:'Descrição',privacyStatus:'unlisted',madeForKids:true,containsSyntheticMedia:true};
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
test('Facebook rejects unavailable formats and supports text without media', () => {
  const input = {caption:'Texto',platforms:['facebook'],scheduledFor:'2030-01-01T00:00:00Z',timeZone:'UTC',mediaUrls:[],destinations:[{platform:'facebook',accountId:'b'.repeat(24),format:'feed'}]};
  assert.equal(typeof validatePostInput(input,'a'.repeat(64),false,0),'object');
  assert.equal(typeof validatePostInput({...input,destinations:[{...input.destinations[0],format:'story'}]},'a'.repeat(64),false,0),'string');
});
