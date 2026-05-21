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
    encoder.encode(secret || 'missing-secret'),
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

export async function onRequestPost({ request, env }) {
  try {
    const session = await verifySession(request, env);

    if (!session || session.role !== 'instructor') {
      return jsonResponse({
        isOk: false,
        error: 'Instructor access required.'
      }, 403);
    }

    const { record_id, override } = await request.json();

    if (!record_id) {
      return jsonResponse({
        isOk: false,
        error: 'Missing archive record ID.'
      }, 400);
    }

    if (override !== env.ADMIN_OVERRIDE) {
      return jsonResponse({
        isOk: false,
        error: 'Invalid ADMIN_OVERRIDE password.'
      }, 403);
    }

    const existing = await env.DB.prepare(
      `SELECT id, type FROM records WHERE id = ?`
    )
      .bind(record_id)
      .first();

    if (!existing || existing.type !== 'archive') {
      return jsonResponse({
        isOk: false,
        error: 'Archive record not found.'
      }, 404);
    }

    await env.DB.prepare(
      `DELETE FROM records WHERE id = ? AND type = 'archive'`
    )
      .bind(record_id)
      .run();

    return jsonResponse({
      isOk: true
    });
  } catch (error) {
    return jsonResponse({
      isOk: false,
      error: error.message || 'Archive delete failed.'
    }, 500);
  }
}
