import 'server-only';
import { randomUUID } from 'node:crypto';
import { connectDB } from '@/src/libs/mongodb';
import { assessQueueHealth, type QueueRunSnapshot } from '@/src/libs/operationsHealth';

async function collection() {
  const connection = await connectDB();
  if (!connection?.connection.db) throw new Error('Banco indisponível.');
  return connection.connection.db.collection<QueueRunSnapshot & {_id:string; processed?:number; expiresAt:Date}>('operational_runs');
}

export async function beginQueueRun() {
  const runs = await collection();
  await runs.createIndex({expiresAt:1},{expireAfterSeconds:0});
  await runs.createIndex({startedAt:-1});
  const id = randomUUID();
  await runs.insertOne({_id:id,startedAt:new Date(),expiresAt:new Date(Date.now()+7*86400_000)});
  return id;
}

export async function finishQueueRun(id:string, outcome:NonNullable<QueueRunSnapshot['outcome']>, processed=0) {
  await (await collection()).updateOne({_id:id},{$set:{finishedAt:new Date(),outcome,processed}});
}

export async function getOperationsHealth() {
  try {
    const runs = await collection();
    const run = await runs.findOne({}, {sort:{startedAt:-1}});
    return {...assessQueueHealth(run),lastStartedAt:run?.startedAt.toISOString() ?? null,lastFinishedAt:run?.finishedAt?.toISOString() ?? null};
  } catch {
    return {status:'unavailable' as const,message:'Não foi possível consultar o banco e o agendador.',lastStartedAt:null,lastFinishedAt:null};
  }
}
