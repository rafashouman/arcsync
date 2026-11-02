import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
process.env.MONGODB_URI='mongodb://127.0.0.1:27119/feedsync_mvp_operations';
const {default:mongoose}=await import('mongoose');
const {Post}=await import('../src/models/Post');
const data=await import('../src/data/posts');
const ops=await import('../src/data/operations');
const {POST}=await import('../src/app/api/cron/publish/route');
const workspace=`ops-${randomUUID()}`;
const runs:string[]=[];
try {
 const due=new Date(Date.now()-1000).toISOString();
 const records=await Promise.all(Array.from({length:24},()=>data.createPostForWorkspace(workspace,workspace,{caption:'Load simulation',platforms:['facebook'],mediaUrls:[],timeZone:'UTC',scheduledFor:due,destinations:[{platform:'facebook',format:'feed',accountId:'a'.repeat(24)}]})));
 const claims=(await Promise.all(Array.from({length:32},()=>data.claimDuePost(new Date(),randomUUID(),600000)))).filter(x=>x!==null);
 assert.equal(claims.length,24);assert.equal(new Set(claims.map(p=>p._id)).size,24);
 const old=claims[0];
 // A worker disappears after saving an external operation marker.
 await data.updateClaimedPost(old._id,old.processingRunId,{publishStates:[{platform:'facebook',state:'processing',mayHaveSucceeded:true}]});
 await Post.updateOne({_id:old._id},{$set:{processingStartedAt:new Date(Date.now()-601000)}});
 await mongoose.disconnect();
 const recovered=await data.claimDuePost(new Date(),randomUUID(),600000);
 assert.equal(recovered?._id,old._id);
 assert.equal(recovered?.publishStates[0].mayHaveSucceeded,true);
 assert.equal(await data.updateClaimedPost(old._id,old.processingRunId,{caption:'stale write'}),false);
 const {publishClaimedPost}=await import('../src/libs/postPublisher');
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async()=>{throw new Error('Recovery must not make a new external post');};
 try {assert.equal(await publishClaimedPost(recovered!),'uncertain');} finally {globalThis.fetch=originalFetch;}
 assert.equal((await data.getPostForWorkspace(workspace,old._id))?.publishMayHaveSucceeded,true);
 const run=await ops.beginQueueRun();runs.push(run);await ops.finishQueueRun(run,'healthy');
 assert.equal((await ops.getOperationsHealth()).status,'healthy');
 await mongoose.connection.db!.collection('operational_runs').updateOne({_id:run} as never,{$set:{startedAt:new Date(Date.now()-301000)}});
 assert.equal((await ops.getOperationsHealth()).status,'stale');
 process.env.CRON_SECRET='x'.repeat(32);process.env.PUBLISHING_ENABLED='false';
 assert.equal((await POST(new Request('http://localhost/api/cron/publish',{method:'POST'}))).status,401);
 assert.equal((await POST(new Request('http://localhost/api/cron/publish',{method:'POST',headers:{Authorization:`Bearer ${process.env.CRON_SECRET}`}}))).status,503);
 assert.equal((await ops.getOperationsHealth()).status,'blocked');
 assert.equal(await Post.countDocuments({_id:{$in:records.map(p=>p._id)},status:'processing'}),23);
 console.log('PASS: 32 concurrent claims / 24 unique posts; recovered lease preserves uncertain state and fences stale worker; heartbeat and disabled-publishing gate.');
} finally {
 if(mongoose.connection.readyState===1) {
  await Post.deleteMany({workspaceId:workspace});
  // This database is dedicated to this fixture; operational metadata contains no customer data.
  await mongoose.connection.db!.collection('operational_runs').deleteMany({});
 }
 await mongoose.disconnect();
}
