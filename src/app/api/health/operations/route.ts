import { isOperationsAuthorized } from '@/src/libs/operationsAuth';
import { getOperationsHealth } from '@/src/data/operations';

export async function GET(request:Request) {
  if (!isOperationsAuthorized(request)) return Response.json({error:'Não autorizado.'},{status:401});
  const health = await getOperationsHealth();
  return Response.json(health,{status:['healthy','running'].includes(health.status) ? 200 : 503,headers:{'Cache-Control':'no-store'}});
}
