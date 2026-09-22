import { roleSigningSecret } from './session-contract.mjs';

const COOKIE_NAME = 'prc_sr_session';
const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...extraHeaders
    }
  });
}

function base64urlEncodeString(value) {
  return btoa(value)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64urlEncodeBytes(bytes) {
  let binary = '';
  const array = new Uint8Array(bytes);
  for (const byte of array) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function sign(value, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return base64urlEncodeBytes(signature);
}

async function createSession(payload, secret) {
  const body = base64urlEncodeString(JSON.stringify(payload));
  const signature = await sign(body, secret);
  return `${body}.${signature}`;
}

function configuredCredentialMatch(username, password, configuredUsername, configuredPassword) {
  const expectedUsername = String(configuredUsername || '');
  const expectedPassword = String(configuredPassword || '');
  return expectedUsername.length > 0
    && expectedPassword.length > 0
    && username === expectedUsername
    && password === expectedPassword;
}

function matchingRoles(username, password, env) {
  return [
    ['instructor', env.MTI_USERNAME, env.MTI_PASSWORD],
    ['airman', env.AIRMAN_USERNAME, env.AIRMAN_PASSWORD],
    ['squadron', env.SQUADRON_USERNAME, env.SQUADRON_PASSWORD]
  ].filter(([, expectedUsername, expectedPassword]) =>
    configuredCredentialMatch(username, password, expectedUsername, expectedPassword)
  ).map(([role]) => role);
}

export async function onRequestPost({ request, env }) {
  const secret = String(env?.AUTH_SECRET || '').trim();
  if (!secret) {
    return jsonResponse({
      isOk: false,
      code: 'configuration_required',
      error: 'Authentication is not configured.'
    }, 503);
  }

  try {
    const body = await request.json();
    const username = String(body?.username || '').trim();
    const password = String(body?.password || '');
    if (!username || !password) {
      return jsonResponse({ isOk: false, code: 'validation', error: 'Username and password are required.' }, 400);
    }

    const matches = matchingRoles(username, password, env);
    if (matches.length > 1) {
      // Shared credentials must never silently elevate Squadron or Airman to Instructor.
      return jsonResponse({ isOk: false, code: 'configuration_conflict', error: 'Authentication configuration requires correction.' }, 503);
    }
    if (matches.length !== 1) {
      return jsonResponse({ isOk: false, code: 'invalid_credentials', error: 'Invalid username or password.' }, 401);
    }

    const role = matches[0];
    const signingSecret = roleSigningSecret(role, env);
    if (!signingSecret) return jsonResponse({ isOk: false, code: 'configuration_required', error: 'Authentication is not configured.' }, 503);
    const now = Date.now();
    const token = await createSession({
      username,
      role,
      iat: now,
      exp: now + (SESSION_MAX_AGE_SECONDS * 1000)
    }, signingSecret);

    return jsonResponse({ isOk: true, role }, 200, {
      'Set-Cookie': `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}`
    });
  } catch {
    return jsonResponse({ isOk: false, code: 'login_failed', error: 'Login failed.' }, 500);
  }
}
