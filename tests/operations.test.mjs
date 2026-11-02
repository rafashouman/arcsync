import test from 'node:test';
import assert from 'node:assert/strict';
import { assessQueueHealth } from '../src/libs/operationsHealth.ts';
import { isOperationsAuthorized } from '../src/libs/operationsAuth.ts';
import { queueTick, monitorTick } from '../ops/queue-services.mjs';
const secret='s'.repeat(32);
const config={origin:'http://app:3000',secret,enabled:true,webhook:''};
test('operational health distinguishes no work from missing, stopped and stuck scheduler', () => {
  const now=1_000_000;
  assert.equal(assessQueueHealth(null,now).status,'missing');
  assert.equal(assessQueueHealth({startedAt:new Date(now-301000)},now).status,'stale');
  assert.equal(assessQueueHealth({startedAt:new Date(now-121000)},now).status,'stuck');
  assert.equal(assessQueueHealth({startedAt:new Date(now),finishedAt:new Date(now),outcome:'healthy'},now).status,'healthy');
  assert.equal(assessQueueHealth({startedAt:new Date(now),finishedAt:new Date(now),outcome:'blocked'},now).status,'blocked');
});
test('health credentials are mandatory and publishing stays disabled by default', async () => {
  assert.equal(isOperationsAuthorized(new Request('http://localhost',{headers:{Authorization:`Bearer ${secret}`}}),secret),true);
  assert.equal(isOperationsAuthorized(new Request('http://localhost'),secret),false);
  assert.deepEqual(await queueTick({...config,enabled:false},async()=>assert.fail('must not publish')),{status:'disabled'});
});
test('scheduler detects partial failures and does not include server error content', async () => {
  assert.deepEqual(await queueTick(config,async()=>Response.json({processed:2,secret:'hidden'},{status:207})),{status:'degraded',processed:2});
});
test('monitor only alerts on state change and recovery; failed delivery remains retryable', async () => {
  const events=[];
  const log=event=>events.push(JSON.parse(event));
  let status='stale';
  const fetcher=async()=>Response.json({status},{status:503});
  let previous=await monitorTick(config,undefined,fetcher,log);
  previous=await monitorTick(config,previous,fetcher,log);
  assert.equal(events.length,1);
  status='healthy';
  await monitorTick(config,previous,fetcher,log);
  assert.equal(events[1].event,'recovered');
  assert.equal(JSON.stringify(events).includes(secret),false);
  await assert.rejects(monitorTick({...config,webhook:'https://alerts.example'},'healthy',async(url)=>String(url).includes('/api/health') ? Response.json({status:'failed'},{status:503}) : new Response(null,{status:500}),()=>{}));
});
