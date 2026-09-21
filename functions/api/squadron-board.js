import { verifyRequestSession } from './session-contract.mjs';
import { projectSquadronBoard } from './squadron-board-contract.mjs';

function respond(body,status=200) {
  return new Response(JSON.stringify(body),{status,headers:{
    'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store',
    'X-Content-Type-Options':'nosniff','Vary':'Cookie'
  }});
}
const deny = (status,error) => respond({isOk:false,code:status===401?'unauthorized':status===403?'forbidden':'unavailable',error},status);

export async function onRequestGet({request,env}) {
  const session = await verifyRequestSession(request,env);
  if (!session) return deny(401,'Unauthorized.');
  if (session.role !== 'squadron' && session.role !== 'instructor') return deny(403,'Squadron Board access is not permitted.');
  if (!env.DB) return deny(503,'Operational data is unavailable.');
  try {
    const configs = await env.DB.prepare("SELECT data FROM records WHERE type='config' AND json_extract(data,'$.key') IN ('week_group','last_airport')").all();
    const values = new Map();
    for (const row of configs.results || []) {
      const item = JSON.parse(row.data);
      if (!['week_group','last_airport'].includes(item.key) || values.has(item.key)) return deny(503,'Operational configuration requires verification.');
      values.set(item.key,String(item.value ?? '').trim());
    }
    const weekGroup = (values.get('week_group') || '').toUpperCase();
    if (weekGroup.length > 64) return deny(503,'Operational configuration requires verification.');
    if (env.GATE_PERSISTENCE_ENABLED === 'true') {
      const cycles = await env.DB.prepare("SELECT week_group,state FROM gate_week_groups WHERE state<>'closed' LIMIT 2").all();
      const active = cycles.results || [];
      if ((weekGroup && (active.length !== 1 || active[0].state !== 'active' || active[0].week_group !== weekGroup)) ||
          (!weekGroup && active.length)) return deny(503,'Active Week Group data is being reconciled.');
    }
    if (!weekGroup) return respond({isOk:true,...projectSquadronBoard()});
    const result = await env.DB.prepare("SELECT type,week_group,data,updated_at FROM records WHERE type IN ('bus','dorm') AND week_group=? ORDER BY created_at ASC").bind(weekGroup).all();
    const buses = [], dorms = [];
    for (const row of result.results || []) {
      const parsed = JSON.parse(row.data);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || parsed.type !== row.type) {
        return deny(503,'An operational record requires verification.');
      }
      const record = {...parsed,week_group:row.week_group,updated_at:row.updated_at};
      if (row.type === 'bus') buses.push(record);
      else dorms.push(record);
    }
    return respond({isOk:true,...projectSquadronBoard({weekGroup,dorms,buses,finalAirport:values.get('last_airport')||''})});
  } catch {
    // Never return raw SQL errors or operational JSON to a Squadron client.
    return deny(503,'Operational data is temporarily unavailable.');
  }
}
