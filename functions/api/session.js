const COOKIE_NAME = 'prc_sr_session';

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}

function getCookie(request, name) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const cookies = cookieHeader.split(';').map(cookie => cookie.trim());

  for (const cookie of cookies) {
    const [key, ...valueParts] = cookie.split('=');

    if (key === name) {
      return valueParts.join('=');
    }
  }

  return '';
}

function base64urlDecodeString(value) {
  const base64 = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');

  return atob(base64);
}

function base64urlEncodeBytes(bytes) {
  let binary = '';
  const array = new Uint8Array(bytes);

  for (const byte of array) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function safeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;

  let result = 0;

  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
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

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(value)
  );

  return base64urlEncodeBytes(signature);
}

async function verifySession(request, env) {
  const token = getCookie(request, COOKIE_NAME);

  if (!token) return null;

  const [body, signature] = token.split('.');

  if (!body || !signature) return null;

  const expected = await sign(body, env.AUTH_SECRET);

  if (!safeEqual(signature, expected)) return null;

  const payload = JSON.parse(base64urlDecodeString(body));

  if (!payload.exp || payload.exp < Date.now()) return null;

  return payload;
}

export async function onRequestGet({ request, env }) {
  const session = await verifySession(request, env);

  if (!session) {
    return jsonResponse({
      isOk: false,
      error: 'Unauthorized.'
    }, 401);
  }

  return jsonResponse({
    isOk: true,
    username: session.username,
    role: session.role
  });
}
