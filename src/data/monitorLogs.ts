import 'server-only';
import { randomUUID } from 'node:crypto';
import { connectDB } from '@/src/libs/mongodb';
import { logLevel, logRetentionMs, type LogEvent, type LogLevel } from '@/src/libs/monitorLogs';
import type { SocialPlatform } from '@/src/types/post';

interface MonitorLog {
  _id: string;
  workspaceId: string;
  postId: string;
  platform?: SocialPlatform;
  event: LogEvent;
  level: LogLevel;
  at: Date;
  expiresAt: Date;
}

const indexes = new WeakMap<object, Promise<unknown>>();

async function collection() {
  const mongo = await connectDB();
  const db = mongo?.connection.db;
  if (!db) throw new Error('MongoDB indisponível');
  const logs = db.collection<MonitorLog>('publication_logs');
  let ready = indexes.get(db);
  if (!ready) {
    ready = logs.createIndexes([
      { key: { expiresAt: 1 }, expireAfterSeconds: 0 },
      { key: { workspaceId: 1, at: -1 } },
      { key: { workspaceId: 1, level: 1, at: -1 } },
    ]).catch(error => { indexes.delete(db); throw error; });
    indexes.set(db, ready);
  }
  await ready;
  return logs;
}

export async function recordPublicationEvent(workspaceId: string, postId: string, event: LogEvent, platform?: SocialPlatform, runId?: string) {
  try {
    const logs = await collection();
    const at = new Date();
    const id = runId ? `${runId}:${event}` : randomUUID();
    await logs.updateOne({ _id: id }, { $setOnInsert: {
      workspaceId, postId, event, ...(platform ? { platform } : {}), level: logLevel(event), at,
      expiresAt: new Date(at.getTime() + logRetentionMs),
    } }, { upsert: true });
  } catch {
    // A logging failure after a committed action must never trigger another publication.
    console.error('Não foi possível persistir um evento de publicação.', event);
  }
}

export async function listPublicationLogs(workspaceId: string, level?: LogLevel) {
  try {
    const logs = await collection();
    const entries = await logs.find({ workspaceId, at: { $gt: new Date(Date.now() - logRetentionMs) }, ...(level ? {level} : {}) })
      .sort({ at: -1 }).limit(100).toArray();
    return { entries, available: true };
  } catch {
    return { entries: [], available: false };
  }
}
