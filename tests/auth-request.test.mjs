import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isSameOrigin,
  readAuthJson,
} from '../src/libs/authRequest.ts';
import { isMatchingOAuthState } from '../src/libs/oauthState.ts';

test('requires a matching origin, host, and forwarded protocol', () => {
  const sameOrigin = new Request('https://arcsync.example/api/auth', {
    headers: {
      origin: 'https://arcsync.example',
      host: 'arcsync.example',
    },
  });
  const wrongProtocol = new Request('https://arcsync.example/api/auth', {
    headers: {
      origin: 'http://arcsync.example',
      host: 'arcsync.example',
    },
  });
  const behindProxy = new Request('http://127.0.0.1:3001/api/auth', {
    headers: {
      origin: 'https://arcsync.example',
      host: '127.0.0.1:3001',
      'x-forwarded-host': 'arcsync.example',
      'x-forwarded-proto': 'https',
    },
  });

  assert.equal(isSameOrigin(sameOrigin), true);
  assert.equal(isSameOrigin(wrongProtocol), false);
  assert.equal(isSameOrigin(behindProxy), true);
});

test('reads valid JSON and rejects malformed or oversized streamed bodies', async () => {
  const valid = new Request('https://arcsync.example/api/auth', {
    method: 'POST',
    body: JSON.stringify({ email: 'rafa@example.com' }),
  });
  const invalid = new Request('https://arcsync.example/api/auth', {
    method: 'POST',
    body: '{',
  });
  const oversized = new Request('https://arcsync.example/api/auth', {
    method: 'POST',
    body: 'x'.repeat(4097),
  });

  assert.deepEqual(await readAuthJson(valid), {
    body: { email: 'rafa@example.com' },
  });
  assert.deepEqual(await readAuthJson(invalid), { error: 'invalid' });
  assert.deepEqual(await readAuthJson(oversized), { error: 'too-large' });
});

test('binds OAuth state to the initiating user and compares it safely', () => {
  const cookie = 'random-state.user-123';
  assert.equal(isMatchingOAuthState(cookie, 'random-state', 'user-123'), true);
  assert.equal(isMatchingOAuthState(cookie, 'wrong-state', 'user-123'), false);
  assert.equal(isMatchingOAuthState(cookie, 'random-state', 'other-user'), false);
  assert.equal(isMatchingOAuthState(undefined, 'random-state', 'user-123'), false);
  assert.equal(isMatchingOAuthState(cookie, null, 'user-123'), false);
  assert.equal(
    isMatchingOAuthState(
      'random-state.user-123:workspace-a',
      'random-state',
      'user-123:workspace-a',
    ),
    true,
  );
  assert.equal(
    isMatchingOAuthState(
      'random-state.user-123:workspace-a',
      'random-state',
      'user-123:workspace-b',
    ),
    false,
  );
});
