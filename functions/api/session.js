import { verifyRequestSession } from './session-contract.mjs';

export async function onRequestGet({request,env}) {
  const session = await verifyRequestSession(request,env);
  return new Response(JSON.stringify(session
    ? {isOk:true,username:session.username,role:session.role,redirect:session.role==='squadron'?'/squadron/':'/'}
    : {isOk:false,error:'Unauthorized.'}), {
    status:session?200:401,
    headers:{'Content-Type':'application/json','Cache-Control':'no-store'}
  });
}
