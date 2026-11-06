import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fetchTikTokPublishStatus,
  initializeTikTokVideoUpload,
  TikTokApiError,
  uploadTikTokVideoChunk,
  validateTikTokUploadUrl,
} from '../src/libs/tiktokPublishingApi.ts';

const accessToken = 'test-access-token';
const uploadUrl =
  'https://open-upload.tiktokapis.com/video/?upload_id=opaque-session';

function jsonResponse(data, status = 200) {
  return Response.json(
    { data, error: { code: 'ok', message: '' } },
    { status },
  );
}

function createMockFetch(responses) {
  const calls = [];
  const fetcher = async (input, init = {}) => {
    calls.push({
      url: String(input),
      init,
      headers: new Headers(init.headers),
    });
    const response = responses.shift();
    if (!response) throw new Error('Unexpected mocked TikTok API request.');
    if (response instanceof Error) throw response;
    return response;
  };
  return { calls, fetcher };
}

test('simulates TikTok file upload, resumable continuation, and status polling', async () => {
  const publishId = 'publish-session-123';
  const mock = createMockFetch([
    jsonResponse({ publish_id: publishId, upload_url: uploadUrl }),
    new Response(null, { status: 200 }),
    new Response(null, { status: 200 }),
    jsonResponse({ status: 'PROCESSING_UPLOAD', uploaded_bytes: 8 }),
    jsonResponse({
      status: 'PUBLISH_COMPLETE',
      publicly_available_post_id: ['post-987'],
    }),
  ]);
  const session = await initializeTikTokVideoUpload(
    accessToken,
    {
      title: 'Post de teste',
      privacyLevel: 'SELF_ONLY',
      allowComments: false,
      allowDuet: true,
      allowStitch: false,
      brandOrganic: true,
      brandContent: false,
    },
    { videoSize: 8, chunkSize: 4, totalChunkCount: 2 },
    mock.fetcher,
  );
  assert.deepEqual(session, { publishId, uploadUrl });

  const initRequest = mock.calls[0];
  assert.match(initRequest.url, /\/video\/init\/$/);
  assert.equal(initRequest.headers.get('authorization'), `Bearer ${accessToken}`);
  assert.deepEqual(JSON.parse(initRequest.init.body), {
    post_info: {
      title: 'Post de teste',
      privacy_level: 'SELF_ONLY',
      disable_comment: true,
      disable_duet: false,
      disable_stitch: true,
      brand_organic_toggle: true,
      brand_content_toggle: false,
    },
    source_info: {
      source: 'FILE_UPLOAD',
      video_size: 8,
      chunk_size: 4,
      total_chunk_count: 2,
    },
  });

  const file = Buffer.from('12345678');
  const persistedSession = { ...session, uploadedBytes: 0 };
  await uploadTikTokVideoChunk(
    persistedSession.uploadUrl,
    file.subarray(0, 4),
    { start: 0, end: 3 },
    file.length,
    'video/mp4',
    mock.fetcher,
  );
  persistedSession.uploadedBytes = 4;

  // Simulate the worker resuming with the persisted upload URL and byte offset.
  await uploadTikTokVideoChunk(
    persistedSession.uploadUrl,
    file.subarray(persistedSession.uploadedBytes),
    { start: persistedSession.uploadedBytes, end: file.length - 1 },
    file.length,
    'video/mp4',
    mock.fetcher,
  );
  assert.equal(mock.calls[1].headers.get('content-range'), 'bytes 0-3/8');
  assert.equal(mock.calls[2].headers.get('content-range'), 'bytes 4-7/8');
  assert.equal(mock.calls[1].headers.has('authorization'), false);
  assert.equal(mock.calls[2].headers.has('authorization'), false);
  assert.equal(mock.calls[1].init.redirect, 'error');
  assert.equal(mock.calls[2].init.redirect, 'error');

  const processing = await fetchTikTokPublishStatus(
    accessToken,
    persistedSession.publishId,
    mock.fetcher,
  );
  assert.deepEqual(processing, {
    status: 'PROCESSING_UPLOAD',
    publicPostIds: [],
    uploadedBytes: 8,
  });
  const complete = await fetchTikTokPublishStatus(
    accessToken,
    persistedSession.publishId,
    mock.fetcher,
  );
  assert.deepEqual(complete, {
    status: 'PUBLISH_COMPLETE',
    publicPostIds: ['post-987'],
  });
  assert.equal(mock.calls[3].headers.get('authorization'), `Bearer ${accessToken}`);
  assert.deepEqual(JSON.parse(mock.calls[3].init.body), {
    publish_id: publishId,
  });
  assert.equal(mock.calls.length, 5);
  assert.equal(mock.calls[0].url.match(/video\/init/g)?.length, 1);
});

test('rejects invalid upload URLs and malformed upload ranges before network calls', async () => {
  for (const invalidUrl of [
    'http://open-upload.tiktokapis.com/video/?upload_id=x',
    'https://evil.example/video/?upload_id=x',
    'https://user:pass@open-upload.tiktokapis.com/video/?upload_id=x',
    'https://open-upload.tiktokapis.com/other/?upload_id=x',
    'https://upload.us.tiktokapis.com.evil.example/video/?upload_id=x',
    'https://upload.us.tiktokapis.com:8443/video/?upload_id=x',
    'https://upload.us.tiktokapis.com/video/?upload_id=x#fragment',
  ]) {
    assert.throws(() => validateTikTokUploadUrl(invalidUrl), TikTokApiError);
  }
  const mock = createMockFetch([]);
  await assert.rejects(
    uploadTikTokVideoChunk(
      'https://evil.example/video/?upload_id=x',
      Buffer.from('1234'),
      { start: 0, end: 3 },
      4,
      'video/mp4',
      mock.fetcher,
    ),
    /destino da sessão de envio do TikTok é inválido/,
  );
  await assert.rejects(
    uploadTikTokVideoChunk(
      uploadUrl,
      Buffer.from('short'),
      { start: 0, end: 3 },
      4,
      'video/mp4',
      mock.fetcher,
    ),
    /intervalo inválido/,
  );
  assert.equal(mock.calls.length, 0);
});

test('accepts documented TikTok upload destinations during initialization and upload', async () => {
  for (const documentedUrl of [
    'https://upload.us.tiktokapis.com/video/?upload_id=123&upload_token=example',
    'https://open-upload.tiktokapis.com/upload/?upload_id=123&upload_token=example',
  ]) {
    const mock = createMockFetch([
      jsonResponse({ publish_id: 'publish-session-123', upload_url: documentedUrl }),
      new Response(null, { status: 201 }),
    ]);
    const session = await initializeTikTokVideoUpload(
      accessToken,
      {
        title: 'Post',
        privacyLevel: 'SELF_ONLY',
        allowComments: false,
        allowDuet: false,
        allowStitch: false,
        brandOrganic: false,
        brandContent: false,
      },
      { videoSize: 4, chunkSize: 4, totalChunkCount: 1 },
      mock.fetcher,
    );
    await uploadTikTokVideoChunk(
      session.uploadUrl,
      Buffer.from('1234'),
      { start: 0, end: 3 },
      4,
      'video/mp4',
      mock.fetcher,
    );
    assert.equal(mock.calls[1].url, documentedUrl);
    assert.equal(mock.calls[1].init.redirect, 'error');
    assert.equal(mock.calls[1].headers.has('authorization'), false);
  }
});

test('surfaces retryable API failures and refuses malformed init responses', async () => {
  const throttled = createMockFetch([
    Response.json(
      { data: {}, error: { code: 'rate_limit_exceeded', message: 'slow down' } },
      { status: 429 },
    ),
  ]);
  await assert.rejects(
    initializeTikTokVideoUpload(
      accessToken,
      {
        title: 'Post',
        privacyLevel: 'SELF_ONLY',
        allowComments: false,
        allowDuet: false,
        allowStitch: false,
        brandOrganic: false,
        brandContent: false,
      },
      { videoSize: 1, chunkSize: 1, totalChunkCount: 1 },
      throttled.fetcher,
    ),
    (error) => {
      assert.ok(error instanceof TikTokApiError);
      assert.equal(error.retryable, true);
      assert.equal(error.message, 'slow down');
      return true;
    },
  );

  const malformed = createMockFetch([jsonResponse({ publish_id: '', upload_url: uploadUrl })]);
  await assert.rejects(
    initializeTikTokVideoUpload(
      accessToken,
      {
        title: 'Post',
        privacyLevel: 'SELF_ONLY',
        allowComments: false,
        allowDuet: false,
        allowStitch: false,
        brandOrganic: false,
        brandContent: false,
      },
      { videoSize: 1, chunkSize: 1, totalChunkCount: 1 },
      malformed.fetcher,
    ),
    /dados inválidos para a sessão/,
  );
});

test('normalizes failed status and the TikTok response field spelling', async () => {
  const failed = createMockFetch([
    jsonResponse({
      status: 'FAILED',
      fail_reason: 'video_format_not_supported',
      publicaly_available_post_id: ['legacy-field-post-id'],
      uploaded_bytes: 4096,
    }),
  ]);
  assert.deepEqual(
    await fetchTikTokPublishStatus(
      accessToken,
      'publish-session-123',
      failed.fetcher,
    ),
    {
      status: 'FAILED',
      failReason: 'video_format_not_supported',
      publicPostIds: ['legacy-field-post-id'],
      uploadedBytes: 4096,
    },
  );
});
