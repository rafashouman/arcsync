import { createHash } from 'node:crypto';

// Only canonical local paths can be matched safely. Unknown references require
// manual review; this report never authorizes filesystem deletion.
export function localMediaReference(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^\/api\/media\/([a-f\d]{64})\/([a-f\d-]{36}\.(?:jpg|png|webp|gif|mp4|mov|webm))$/i.exec(value);
  return match ? value : null;
}

export function mediaReferences(post: { mediaUrls?: unknown; destinations?: unknown }) {
  const references = new Set<string>();
  let unresolved = 0;
  const collect = (values: unknown) => {
    if (values === undefined || values === null) return;
    if (!Array.isArray(values)) { unresolved++; return; }
    for (const value of values) {
      const reference = localMediaReference(value);
      if (reference) references.add(reference);
      else unresolved++;
    }
  };
  collect(post.mediaUrls);
  if (post.destinations != null) {
    if (!Array.isArray(post.destinations)) unresolved++;
    else for (const destination of post.destinations) {
      if (!destination || typeof destination !== 'object') unresolved++;
      else collect(destination.mediaUrls);
    }
  }
  return { references, unresolved };
}

export function mediaReferenceId(reference: string) {
  return createHash('sha256').update(reference).digest('hex');
}
