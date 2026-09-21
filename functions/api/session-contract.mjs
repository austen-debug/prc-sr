const COOKIE_NAME = 'prc_sr_session';
const SESSION_ROLES = new Set(['instructor', 'airman', 'squadron']);

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

async function sign(value, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return base64urlEncodeBytes(signature);
}

export async function verifyRequestSession(request, env) {
  try {
    const secret = String(env?.AUTH_SECRET || '').trim();
    if (!secret) return null;

    const token = getCookie(request, COOKIE_NAME);
    if (!token) return null;
    const [body, signature] = token.split('.');
    if (!body || !signature) return null;

    const expected = await sign(body, secret);
    if (!safeEqual(signature, expected)) return null;

    const payload = JSON.parse(base64urlDecodeString(body));
    const role = String(payload.role || '').trim().toLowerCase();
    if (!SESSION_ROLES.has(role)) return null;
    if (!payload.exp || payload.exp < Date.now()) return null;
    if (!payload.iat || payload.iat > Date.now() + 60000) return null;

    return Object.freeze({
      username: String(payload.username || ''),
      role,
      iat: Number(payload.iat),
      exp: Number(payload.exp)
    });
  } catch {
    return null;
  }
}
