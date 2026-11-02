import { MongoClient, type Db } from 'mongodb';
import { readdir, lstat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { mediaReferences, mediaReferenceId } from '../src/libs/mediaReferences';
import { assessPostRetention, assessBackupRetention, HISTORY_RETENTION_DAYS, BACKUP_RETENTION_DAYS, type RetentionPost } from '../src/libs/retentionReport';

export async function buildRetentionReport(db: Db, workspaceId: string, now = new Date(), backupDir?: string, inspectMedia = false) {
  if (!workspaceId.trim() || workspaceId.length > 200) throw new Error('Informe um workspace válido.');
  if (!Number.isFinite(now.getTime())) throw new Error('Data inválida.');
  const report = {
    mode: 'report-only', generatedAt: now.toISOString(), workspaceId,
    policy: { status: 'proposal_pending_NexuSync_review', historyDays: HISTORY_RETENTION_DAYS, backupDays: BACKUP_RETENTION_DAYS },
    posts: { scanned: 0, preserved: 0, reasons: {} as Record<string, number>, reviewCandidates: [] as { id: string; referenceAt: string | null }[] },
    backups: { scope: 'operator_directory_not_workspace_scoped', inspected: Boolean(backupDir), files: [] as { name: string; decision: string; reason: string }[] },
    media: { inspected: inspectMedia, scope: 'global_reference_scan', deletionAuthorized: false,
      unresolvedReferences: 0, files: [] as { referenceId: string; candidatePosts: number; protectedPosts: number }[] },
  };
  // Raw read-only projection avoids Mongoose schema/index initialization and
  // excludes captions, media URLs, credentials and upload sessions from output.
  const cursor = db.collection<RetentionPost>('posts').find({ workspaceId }, { projection: {
    _id: 1, status: 1, deletedAt: 1, updatedAt: 1, 'history.at': 1,
    processingRunId: 1, publishMayHaveSucceeded: 1, 'publishStates.state': 1, 'publishStates.mayHaveSucceeded': 1,
  } });
  for await (const post of cursor) {
    const assessment = assessPostRetention(post, now);
    report.posts.scanned++;
    report.posts.reasons[assessment.reason] = (report.posts.reasons[assessment.reason] ?? 0) + 1;
    if (assessment.decision === 'review_candidate') report.posts.reviewCandidates.push({ id: post._id.toString(), referenceAt: assessment.referenceAt });
    else report.posts.preserved++;
  }
  if (inspectMedia) {
    const candidates = new Set(report.posts.reviewCandidates.map(post => post.id));
    const references = new Map<string, { candidatePosts: number; protectedPosts: number }>();
    // First collect only media belonging to this workspace's review candidates.
    const mediaPosts = db.collection<{ workspaceId?: string; mediaUrls?: unknown; destinations?: unknown }>('posts');
    for await (const post of mediaPosts.find({ workspaceId }, { projection: { mediaUrls: 1, 'destinations.mediaUrls': 1 } })) {
      if (!candidates.has(post._id.toString())) continue;
      const parsed = mediaReferences(post);
      for (const reference of parsed.references) references.set(reference, { candidatePosts: 0, protectedPosts: 0 });
    }
    // Includes other workspaces, legacy records and deleted posts. Their IDs,
    // workspaces and URLs never appear in the operator report.
    for await (const post of mediaPosts.find({}, { projection: { mediaUrls: 1, 'destinations.mediaUrls': 1 } })) {
      const parsed = mediaReferences(post);
      report.media.unresolvedReferences += parsed.unresolved;
      for (const reference of parsed.references) {
        const counts = references.get(reference);
        if (counts) counts[candidates.has(post._id.toString()) ? 'candidatePosts' : 'protectedPosts']++;
      }
    }
    report.media.files = [...references].map(([reference, counts]) => ({ referenceId: mediaReferenceId(reference), ...counts }));
  }
  if (backupDir) {
    const root = resolve(backupDir);
    if (!(await lstat(root)).isDirectory()) throw new Error('Use um diretório real de backups, sem link simbólico.');
    const entries = await readdir(root, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      if (!entry.name.endsWith('.fsbk')) continue;
      const stat = await lstat(join(root, entry.name));
      if (!stat.isFile() || stat.isSymbolicLink()) {
        report.backups.files.push({ name: entry.name, decision: 'preserve', reason: 'not_regular_file' });
        continue;
      }
      files.push({ name: entry.name, modifiedAt: stat.mtime });
    }
    files.sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());
    for (const [index, file] of files.entries()) {
      report.backups.files.push({ name: file.name, ...index === 0
        ? { decision: 'preserve', reason: 'newest_local_copy' }
        : assessBackupRetention(file.name, file.modifiedAt, now) });
    }
  }
  return report;
}

async function main() {
  const { values } = parseArgs({ options: { workspace: { type: 'string' }, 'backup-dir': { type: 'string' }, 'media-references': { type: 'boolean' } }, strict: true, allowPositionals: false });
  if (!values.workspace?.trim()) throw new Error('Use --workspace com o identificador exato da equipe.');
  if (!process.env.MONGODB_URI) throw new Error('Configure MONGODB_URI por variável de ambiente; nunca na linha de comando.');
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    console.log(JSON.stringify(await buildRetentionReport(client.db(), values.workspace, new Date(), values['backup-dir'], values['media-references']), null, 2));
  } finally { await client.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    console.error('Relatório não gerado. Confira MONGODB_URI, --workspace e o diretório opcional --backup-dir. Nenhuma exclusão foi executada.');
    process.exitCode = 1;
  });
}
