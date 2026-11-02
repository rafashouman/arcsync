import test from 'node:test';
import assert from 'node:assert/strict';
import { mediaReferences, localMediaReference, mediaReferenceId } from '../src/libs/mediaReferences.ts';
const reference = `/api/media/${'a'.repeat(64)}/12345678-1234-1234-1234-123456789012.jpg`;
test('media review deduplicates common and destination references without revealing paths', () => {
  const parsed = mediaReferences({mediaUrls:[reference], destinations:[{mediaUrls:[reference]}]});
  assert.equal(parsed.references.size,1);
  assert.equal(parsed.unresolved,0);
  assert.match(mediaReferenceId(reference), /^[a-f0-9]{64}$/);
});
test('media review flags unrecognized and malformed references for manual review', () => {
  for(const value of [reference+'?signature=secret','https://example.com'+reference,'/api/media/../file.jpg',null]) assert.equal(localMediaReference(value),null);
  assert.equal(mediaReferences({mediaUrls:['external'],destinations:[null,{mediaUrls:'malformed'}]}).unresolved,3);
});
