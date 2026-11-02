import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePostInput } from '../src/libs/postValidation.ts';
import { formatIssue } from '../src/libs/postFormats.ts';
const owner = 'a'.repeat(64);
const image = `/api/media/${owner}/00000000-0000-0000-0000-000000000000.jpg`;
const destination = {platform:'instagram',accountId:'b'.repeat(24),format:'feed'};
const input = {caption:'Teste',platforms:['instagram'],timeZone:'UTC',scheduledFor:'2030-01-01T12:00:00.000Z',mediaUrls:[image],destinations:[destination]};
test('preserves explicit account, format and platform text', () => {
 const result = validatePostInput({...input,destinations:[{...destination,caption:'Outra legenda'}]},owner,false,0);
 assert.equal(typeof result,'object'); assert.equal(result.destinations[0].accountId,destination.accountId); assert.equal(result.destinations[0].caption,'Outra legenda');
});
test('drafts work without credentials, scheduling does not', () => {
 const data = {...input,destinations:[{...destination,accountId:''}]};
 assert.equal(typeof validatePostInput(data,owner,true,0),'object');
 assert.equal(typeof validatePostInput(data,owner,false,0),'string');
});
test('rejects duplicate, foreign-network and malformed destination input', () => {
 for (const destinations of [[destination,destination],[{...destination,platform:'youtube'}],[{...destination,accountId:'bad'}],[{...destination,format:'unknown'}]]) {
 assert.equal(typeof validatePostInput({...input,destinations},owner,false,0),'string');
 }
});
test('enforces Instagram format media cardinality and file types', () => {
 assert.equal(formatIssue('instagram','story',[image]),null);
 assert.ok(formatIssue('instagram','story',[image,image]));
 assert.ok(formatIssue('instagram','carousel',[image]));
 assert.equal(formatIssue('instagram','carousel',[image,image]),null);
 assert.ok(formatIssue('instagram','reel',[image]));
 assert.ok(formatIssue('tiktok','story',[image]));
});

test('independent media and time preserve common fallback for other networks', () => {
 const result = validatePostInput({...input,platforms:['instagram','youtube'],destinations:[{...destination,scheduledFor:'2029-01-01T12:00:00Z'},{platform:'youtube',accountId:'c'.repeat(24),format:'video',mediaUrls:[image.replace('.jpg','.mp4')]}]},owner,false,0);
 assert.equal(typeof result,'object');
 assert.equal(result.destinations[1].scheduledFor,input.scheduledFor);
 assert.equal(result.destinations[1].mediaUrls[0],image.replace('.jpg','.mp4'));
 assert.equal(result.scheduledFor,'2029-01-01T12:00:00.000Z');
 assert.equal(typeof validatePostInput({...input,destinations:[{...destination,mediaUrls:[image.replace(owner,'d'.repeat(64))]}]},owner,false,0),'string');
});
