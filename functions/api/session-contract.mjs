// Shared session contract used by login, all API routes, and the HTML access gate.
export const COOKIE_NAME = 'prc_sr_session';
const ROLES = new Set(['instructor', 'airman', 'squadron']);
const LIFETIME_MS = 12 * 60 * 60 * 1000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function hasSessionSecret(env) {
  return typeof env?.AUTH_SECRET === 'string' && env.AUTH_SECRET.length >= 32;
}

function encode(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decode(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid token encoding.');
  const raw = atob(value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '='));
  return Uint8Array.from(raw, character => character.charCodeAt(0));
}

async function signingKey(secret) {
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('Session secret is not configured.');
  return crypto.subtle.importKey('raw', encoder.encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign','verify']);
}

export async function issueSession(username, role, env) {
  if (!hasSessionSecret(env) || !ROLES.has(role) || typeof username !== 'string' || !username) {
    throw new Error('Session configuration is invalid.');
  }
  const now = Date.now();
  const body = encode(encoder.encode(JSON.stringify({username,role,iat:now,exp:now+LIFETIME_MS})));
  const signature = await crypto.subtle.sign('HMAC', await signingKey(env.AUTH_SECRET), encoder.encode(body));
  return `${body}.${encode(new Uint8Array(signature))}`;
}

export async function verifyRequestSession(request, env) {
  if (!hasSessionSecret(env)) return null;
  try {
    const raw = request.headers.get('Cookie') || '';
    const cookie = raw.split(';').map(item => item.trim()).find(item => item.startsWith(`${COOKIE_NAME}=`));
    if (!cookie) return null;
    const token = cookie.slice(COOKIE_NAME.length + 1);
    if (token.length > 4096) return null;
    const parts = token.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
    const key = await signingKey(env.AUTH_SECRET);
    const valid = await crypto.subtle.verify('HMAC', key, decode(parts[1]), encoder.encode(parts[0]));
    if (!valid) return null;
    const payload = JSON.parse(decoder.decode(decode(parts[0])));
    if (!payload || !ROLES.has(payload.role) || !Number.isFinite(payload.exp) || payload.exp <= Date.now()) return null;
    if (payload.iat !== undefined && (!Number.isFinite(payload.iat) || payload.iat > Date.now() + 60000 || payload.exp - payload.iat > LIFETIME_MS + 60000)) return null;
    return Object.freeze({role:payload.role,username:typeof payload.username === 'string' ? payload.username : ''});
  } catch { return null; }
}
