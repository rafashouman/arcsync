import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertVideoDurationWithinLimit,
  parseVideoDurationSeconds,
} from '../src/libs/videoMetadata.ts';

function box(type, payload) {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(payload.length + header.length, 0);
  header.write(type, 4, 'ascii');
  return Buffer.concat([header, payload]);
}

function makeMp4(version, timescale, duration) {
  const payload = Buffer.alloc(version === 1 ? 32 : 20);
  payload[0] = version;
  if (version === 1) {
    payload.writeUInt32BE(timescale, 20);
    payload.writeBigUInt64BE(BigInt(duration), 24);
  } else {
    payload.writeUInt32BE(timescale, 12);
    payload.writeUInt32BE(duration, 16);
  }
  return Buffer.concat([
    box('ftyp', Buffer.from('isom')),
    box('moov', box('mvhd', payload)),
  ]);
}

function vint(value) {
  assert.ok(value < 127);
  return Buffer.from([value | 0x80]);
}

function ebmlElement(id, payload) {
  return Buffer.concat([Buffer.from(id, 'hex'), vint(payload.length), payload]);
}

function makeWebm(durationSeconds, timecodeScale = 1_000_000) {
  const scale = Buffer.alloc(4);
  scale.writeUInt32BE(timecodeScale);
  const duration = Buffer.alloc(8);
  duration.writeDoubleBE(durationSeconds);
  const info = Buffer.concat([
    ebmlElement('2ad7b1', scale),
    ebmlElement('4489', duration),
  ]);
  return ebmlElement('18538067', ebmlElement('1549a966', info));
}

test('reads MP4 and MOV duration from version zero and one movie headers', () => {
  assert.equal(parseVideoDurationSeconds(makeMp4(0, 1000, 12345), 'video/mp4'), 12.345);
  assert.equal(
    parseVideoDurationSeconds(makeMp4(1, 1000, 60_000), 'video/quicktime'),
    60,
  );
});

test('reads WebM duration using its timecode scale', () => {
  assert.equal(parseVideoDurationSeconds(makeWebm(30_000), 'video/webm'), 30);
  assert.equal(
    parseVideoDurationSeconds(makeWebm(2_500, 2_000_000), 'video/webm'),
    5,
  );
});

test('rejects empty, malformed, and duration-less video files', () => {
  assert.throws(
    () => parseVideoDurationSeconds(Buffer.alloc(0), 'video/mp4'),
    /vazio/,
  );
  assert.throws(
    () => parseVideoDurationSeconds(Buffer.from('not a video'), 'video/mp4'),
    /inválido|incompleto/,
  );
  assert.throws(
    () => parseVideoDurationSeconds(ebmlElement('18538067', Buffer.alloc(0)), 'video/webm'),
    /duração/,
  );
});

test('enforces the creator duration limit at the exact boundary', () => {
  assert.doesNotThrow(() => assertVideoDurationWithinLimit(60, 60));
  assert.throws(
    () => assertVideoDurationWithinLimit(60.1, 60),
    /limite da conta TikTok é 60 segundos/,
  );
  assert.throws(
    () => assertVideoDurationWithinLimit(Number.NaN, 60),
    /validar a duração máxima/,
  );
});
