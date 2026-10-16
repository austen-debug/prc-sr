import {verifyRequestSession} from './session-contract.mjs';
import {revokeSelfSession} from './session-registry.mjs';
const COOKIE_NAME = 'prc_sr_session';

export async function onRequestPost({request,env}={}) {
  if(request&&env){const session=await verifyRequestSession(request,env);if(session?.sid){try{await revokeSelfSession(env,session);}catch{return new Response(JSON.stringify({isOk:false,code:'signout_unconfirmed'}),{status:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});}}}
  return new Response(JSON.stringify({
    isOk: true
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Set-Cookie': `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
    }
  });
}
