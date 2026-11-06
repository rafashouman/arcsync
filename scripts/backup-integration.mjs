import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,writeFile,readFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';
import {MongoClient} from 'mongodb';
import {encryptArchive,decryptArchive} from '../ops/archive-crypto.mjs';
const directory=await mkdtemp(path.join(tmpdir(),'arcsync-restore-'));
const id=randomUUID().replaceAll('-','');
const database=`feedsync_backup_test_${id}`;
const container=`arcsync-restore-test-${id}`;
const archive=`/tmp/${database}.archive.gz`;
const client=new MongoClient('mongodb://127.0.0.1:27119');
let created=false;
const docker=(...args)=>execFileSync('docker',args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:60000});
try {
 await client.connect();
 await client.db(database).collection('posts').insertOne({_id:'fixture',caption:'Local test',publishMayHaveSucceeded:true});
 await client.db(database).collection('posts').createIndex({caption:1},{unique:true});
 await mkdir(path.join(directory,'snapshot'));await mkdir(path.join(directory,'media'));
 await writeFile(path.join(directory,'media','fixture.txt'),'independent-media-fixture');
 await writeFile(path.join(directory,'snapshot','environment.env'),'SOCIAL_TOKEN_ENCRYPTION_KEY=fake-test-value\nPUBLISHING_ENABLED=false\n');
 docker('exec','arcsync-mvp-test','mongodump',`--db=${database}`,`--archive=${archive}`,'--gzip');
 docker('cp',`arcsync-mvp-test:${archive}`,path.join(directory,'snapshot','mongo.archive.gz'));
 execFileSync('tar',['-czf',path.join(directory,'snapshot','uploads.tar.gz'),'-C',path.join(directory,'media'),'.']);
 await writeFile(path.join(directory,'snapshot','manifest.json'),JSON.stringify({format:1}));
 execFileSync('tar',['-cf',path.join(directory,'snapshot.tar'),'-C',path.join(directory,'snapshot'),'.']);
 const key=path.join(directory,'key');await writeFile(key,randomBytes(32).toString('base64'));
 await encryptArchive(path.join(directory,'snapshot.tar'),path.join(directory,'backup.fsbk'),key);
 await decryptArchive(path.join(directory,'backup.fsbk'),path.join(directory,'restored.tar'),key);
 await mkdir(path.join(directory,'restored'));execFileSync('tar',['-xf',path.join(directory,'restored.tar'),'-C',path.join(directory,'restored')]);
 docker('run','-d','--name',container,'--network','none','mongo:8.0');created=true;
 docker('cp',path.join(directory,'restored','mongo.archive.gz'),`${container}:/tmp/restore.archive.gz`);
 for(let n=0;n<30;n++) {try {docker('exec',container,'mongosh','--quiet','--eval','db.adminCommand({ping:1}).ok');break;} catch {await new Promise(resolve=>setTimeout(resolve,500));}}
 docker('exec',container,'mongorestore','--archive=/tmp/restore.archive.gz','--gzip');
 const restored=JSON.parse(docker('exec',container,'mongosh','--quiet',database,'--eval','print(JSON.stringify({post:db.posts.findOne({_id:"fixture"}),indexes:db.posts.getIndexes()}))').trim());
 assert.equal(restored.post.publishMayHaveSucceeded,true);assert.equal(restored.post.caption,'Local test');assert.ok(restored.indexes.some(i=>i.unique&&i.key.caption===1));
 assert.ok((await readFile(path.join(directory,'restored','environment.env'),'utf8')).includes('fake-test-value'));
 await mkdir(path.join(directory,'restored-media'));execFileSync('tar',['-xzf',path.join(directory,'restored','uploads.tar.gz'),'-C',path.join(directory,'restored-media')]);
 assert.equal(await readFile(path.join(directory,'restored-media','fixture.txt'),'utf8'),'independent-media-fixture');
 console.log('PASS: encrypted snapshot round trip; Mongo document and unique index restored into network-isolated Mongo; media and fake configuration preserved.');
} finally {
 if(created) docker('rm','-f',container);
 await client.db(database).dropDatabase().catch(()=>{});await client.close();
 docker('exec','arcsync-mvp-test','rm','-f',archive);
 // Only this mkdtemp-created directory contains disposable test data.
 await rm(directory,{recursive:true,force:true});
}
