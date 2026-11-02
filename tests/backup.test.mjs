import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,writeFile,readFile,rm,access } from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {encryptArchive,decryptArchive} from '../ops/archive-crypto.mjs';
test('backup authenticates content and key and never overwrites an existing destination',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'feedsync-backup-test-'));
 try {
  const source=path.join(dir,'source'),key=path.join(dir,'key'),wrong=path.join(dir,'wrong'),backup=path.join(dir,'backup'),restored=path.join(dir,'restored');
  const data=randomBytes(256*1024);
  await writeFile(source,data);await writeFile(key,randomBytes(32).toString('base64'));await writeFile(wrong,randomBytes(32).toString('base64'));
  await encryptArchive(source,backup,key);await decryptArchive(backup,restored,key);
  assert.deepEqual(await readFile(restored),data);
  await assert.rejects(decryptArchive(backup,restored,key));
  assert.deepEqual(await readFile(restored),data);
  const bad=path.join(dir,'bad');await assert.rejects(decryptArchive(backup,bad,wrong));await assert.rejects(access(bad));
  const bytes=await readFile(backup);bytes[50]^=1;await writeFile(backup,bytes);
  await assert.rejects(decryptArchive(backup,bad,key));await assert.rejects(access(bad));
 } finally {await rm(dir,{recursive:true,force:true});}
});
