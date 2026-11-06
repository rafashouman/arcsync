import assert from 'node:assert/strict';
import { MongoClient, ObjectId } from 'mongodb';
import { randomUUID } from 'node:crypto';
import { mkdtemp, writeFile, utimes, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildRetentionReport } from './retention-report.mjs';

const client = new MongoClient('mongodb://127.0.0.1:27119/feedsync_mvp_retention');
const workspace = `retention-${randomUUID()}`;
const otherWorkspace = `other-${randomUUID()}`;
const directory = await mkdtemp(join(tmpdir(), 'arcsync-retention-'));
const now = new Date('2026-11-02T12:00:00Z');
const old = new Date('2026-01-01T12:00:00Z');
const ids = Array.from({ length: 4 }, () => new ObjectId());
const sharedMedia = `/api/media/${'a'.repeat(64)}/12345678-1234-1234-1234-123456789012.jpg`;
try {
  await client.connect();
  const db = client.db();
  const base = { updatedAt: old, status: 'published', publishStates: [{ state: 'published' }], caption: 'PRIVATE_DO_NOT_REPORT', mediaUrls: ['PRIVATE_MEDIA_URL'], workspaceId: workspace };
  await db.collection('posts').insertMany([
    { ...base, _id: ids[0], mediaUrls: [sharedMedia] },
    { ...base, _id: ids[1], publishMayHaveSucceeded: true },
    { ...base, _id: ids[2], status: 'draft' },
    { ...base, _id: ids[3], workspaceId: otherWorkspace, mediaUrls: [], destinations: [{ mediaUrls: [sharedMedia] }] },
  ]);
  const before = await db.collection('posts').find({ _id: { $in: ids } }).sort({ _id: 1 }).toArray();
  for (const [name, at] of [['arcsync-20260101T120000Z-1.fsbk', old], ['arcsync-20260201T120000Z-2.fsbk', new Date('2026-02-01T12:00:00Z')]] as const) {
    const file = join(directory, name);
    await writeFile(file, 'fixture only');
    await utimes(file, at, at);
  }
  const report = await buildRetentionReport(db, workspace, now, directory, true);
  assert.equal(report.media.deletionAuthorized, false);
  assert.equal(report.media.files.length, 1);
  assert.equal(report.media.files[0].candidatePosts, 1);
  assert.equal(report.media.files[0].protectedPosts, 1);
  assert.equal(JSON.stringify(report).includes(sharedMedia), false);
  assert.equal(report.posts.scanned, 3);
  assert.deepEqual(report.posts.reviewCandidates.map(post => post.id), [ids[0].toString()]);
  assert.equal(report.posts.preserved, 2);
  assert.equal(report.backups.files.find(file => file.name.endsWith('-2.fsbk'))?.reason, 'newest_local_copy');
  assert.equal(report.backups.files.find(file => file.name.endsWith('-1.fsbk'))?.decision, 'review_candidate');
  assert.equal(JSON.stringify(report).includes('PRIVATE'), false);
  assert.equal(JSON.stringify(report).includes(ids[3].toString()), false);
  assert.deepEqual(await db.collection('posts').find({ _id: { $in: ids } }).sort({ _id: 1 }).toArray(), before);
  await assert.rejects(buildRetentionReport(db, '', now));
  console.log('PASS: scoped read-only report; uncertain/active posts and latest backup preserved; no private content or other workspace data exposed.');
} finally {
  await client.db().collection('posts').deleteMany({ _id: { $in: ids }, workspaceId: { $in: [workspace, otherWorkspace] } }).catch(() => {});
  await client.close();
  // Only the unique temporary fixture directory created by this script.
  await rm(directory, { recursive: true, force: true });
}
