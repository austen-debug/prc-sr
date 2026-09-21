import { verifyRequestSession } from './session-contract.mjs';

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}

export async function onRequestGet({ request, env }) {
  if (!String(env?.AUTH_SECRET || '').trim()) {
    return jsonResponse({
      isOk: false,
      code: 'configuration_required',
      error: 'Authentication is not configured.'
    }, 503);
  }

  const session = await verifyRequestSession(request, env);
  if (!session) {
    return jsonResponse({
      isOk: false,
      code: 'unauthorized',
      error: 'Unauthorized.'
    }, 401);
  }

  return jsonResponse({
    isOk: true,
    username: session.username,
    role: session.role
  });
}
