import test from 'node:test';
import assert from 'node:assert/strict';
import { assessPostRetention, assessBackupRetention } from '../src/libs/retentionReport.ts';

const now = new Date('2026-11-02T12:00:00Z');
const daysAgo = days => new Date(now.getTime() - days * 86400000);
const finished = { status: 'published', updatedAt: daysAgo(180), publishStates: [{ state: 'published' }] };

test('retention reaches 180 days only after the latest update, deletion and history', () => {
  assert.equal(assessPostRetention(finished, now).decision, 'review_candidate');
  assert.equal(assessPostRetention({ ...finished, updatedAt: new Date(daysAgo(180).getTime() + 1) }, now).decision, 'preserve');
  assert.equal(assessPostRetention({ ...finished, deletedAt: daysAgo(5) }, now).decision, 'preserve');
  assert.equal(assessPostRetention({ ...finished, history: [{ at: daysAgo(1).toISOString() }] }, now).decision, 'preserve');
});

test('uncertain and in-flight posts are protected even after soft deletion', () => {
  for (const extra of [
    { publishMayHaveSucceeded: true }, { publishStates: [{ state: 'failed', mayHaveSucceeded: true }] },
    { processingRunId: 'lease' }, { status: 'processing' }, { publishStates: [{ state: 'uploading' }] },
  ]) assert.equal(assessPostRetention({ ...finished, deletedAt: daysAgo(200), ...extra }, now).decision, 'preserve');
});

test('active, failed, incomplete and unreliable legacy records are preserved', () => {
  for (const extra of [
    { status: 'draft' }, { status: 'pending' }, { status: 'failed' }, { publishStates: [] },
    { publishStates: [{ state: 'failed' }] }, { updatedAt: undefined }, { updatedAt: 'invalid' },
    { updatedAt: daysAgo(-1) }, { history: [{ at: 'invalid' }] },
  ]) assert.equal(assessPostRetention({ ...finished, ...extra }, now).decision, 'preserve');
  assert.equal(assessPostRetention({ status: 'draft', deletedAt: daysAgo(200), updatedAt: daysAgo(200) }, now).decision, 'review_candidate');
});

test('backup proposal requires both filename and modification age; invalid dates stay protected', () => {
  const name = 'feedsync-20260901T120000Z-123.fsbk';
  assert.equal(assessBackupRetention(name, daysAgo(31), now).decision, 'review_candidate');
  assert.equal(assessBackupRetention(name, daysAgo(29), now).decision, 'preserve');
  for (const filename of ['unknown.fsbk', 'feedsync-20260230T120000Z-1.fsbk', 'feedsync-20261201T120000Z-1.fsbk']) {
    assert.equal(assessBackupRetention(filename, daysAgo(100), now).decision, 'preserve');
  }
});
