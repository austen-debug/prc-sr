const COOKIE_NAME = 'prc_sr_session';
const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const ROLE_CREDENTIAL_KEYS = Object.freeze({
  instructor: ['MTI_USERNAME', 'MTI_PASSWORD'],
  airman: ['AIRMAN_USERNAME', 'AIRMAN_PASSWORD'],
  squadron: ['SQUADRON_USERNAME', 'SQUADRON_PASSWORD']
});

function getCookie(request, name) {
  const cookieHeader = request.headers.get('Cookie') || '';
  for (const cookie of cookieHeader.split(';').map(item => item.trim())) {
    const [key, ...valueParts] = cookie.split('=');
    if (key === name) return valueParts.join('=');
  }
  return '';
}

function base64urlDecodeString(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return atob(base64);
}

function base64urlEncodeBytes(bytes) {
  let binary = '';
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function safeEqual(left, right) {
  if (!left || !right || left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

// Keep the shared-role model: no user table, extra Cloudflare variable, or password-derived
// value is placed inside the browser cookie. Changing one role's credentials changes only
// that role's signing key and immediately invalidates its previously issued sessions.
export function roleSigningSecret(role, env) {
  const keys = ROLE_CREDENTIAL_KEYS[role];
  const master = String(env?.AUTH_SECRET || '').trim();
  if (!keys || !master) return null;
  const username = String(env?.[keys[0]] || '');
  const password = String(env?.[keys[1]] || '');
  if (!username || !password) return null;
  return JSON.stringify(['gate-shared-role-session-v2', master, role, username, password]);
}

async function sign(value, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return base64urlEncodeBytes(signature);
}

export async function verifyRequestSession(request, env) {
  try {
    const token = getCookie(request, COOKIE_NAME);
    if (!token) return null;
    const [body, signature, extra] = token.split('.');
    if (!body || !signature || extra) return null;

    // Decode only to select the configured role signing key. Trust no payload field
    // until the HMAC is verified against the current credentials for that role.
    const payload = JSON.parse(base64urlDecodeString(body));
    const role = String(payload?.role || '').trim().toLowerCase();
    const keys = ROLE_CREDENTIAL_KEYS[role];
    const secret = roleSigningSecret(role, env);
    if (!keys || !secret || payload.username !== String(env[keys[0]])) return null;
    const expected = await sign(body, secret);
    if (!safeEqual(signature, expected)) return null;

    const now = Date.now();
    if (!Number.isSafeInteger(payload.iat) || !Number.isSafeInteger(payload.exp)) return null;
    if (payload.iat > now + 60000 || payload.iat <= 0) return null;
    if (payload.exp <= now || payload.exp <= payload.iat || payload.exp - payload.iat > SESSION_MAX_AGE_MS) return null;

    return Object.freeze({
      username: payload.username,
      role,
      iat: payload.iat,
      exp: payload.exp
    });
  } catch {
    return null;
  }
}
