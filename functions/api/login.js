import { COOKIE_NAME, hasSessionSecret, issueSession } from './session-contract.mjs';

function respond(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status, headers: { 'Content-Type':'application/json', 'Cache-Control':'no-store', ...headers }
  });
}

const CREDENTIALS = Object.freeze([
  ['instructor','MTI_USERNAME','MTI_PASSWORD'],
  ['airman','AIRMAN_USERNAME','AIRMAN_PASSWORD'],
  ['squadron','SQUADRON_USERNAME','SQUADRON_PASSWORD']
]);

export async function onRequestPost({request,env}) {
  if (!hasSessionSecret(env)) return respond({isOk:false,error:'Authentication is not configured.'},503);
  let input;
  try { input = await request.json(); } catch { return respond({isOk:false,error:'Invalid credentials.'},401); }
  const username = input?.username;
  const password = input?.password;
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password || username.length > 256 || password.length > 1024) {
    return respond({isOk:false,error:'Invalid username or password.'},401);
  }
  // Fail closed for missing/empty bindings; reject ambiguous shared credentials.
  const matches = CREDENTIALS.filter(([,userKey,passwordKey]) =>
    typeof env[userKey] === 'string' && env[userKey].length > 0 &&
    typeof env[passwordKey] === 'string' && env[passwordKey].length > 0 &&
    username === env[userKey] && password === env[passwordKey]
  );
  if (matches.length !== 1) return respond({isOk:false,error:'Invalid username or password.'},401);
  const role = matches[0][0];
  try {
    const token = await issueSession(username,role,env);
    return respond({isOk:true,role,redirect:role==='squadron'?'/squadron/':'/'},200,{
      'Set-Cookie':`${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=43200`
    });
  } catch { return respond({isOk:false,error:'Authentication is unavailable.'},503); }
}
