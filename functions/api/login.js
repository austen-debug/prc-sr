const COOKIE_NAME = 'prc_sr_session';

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

  for (const byte of array) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
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

async function createSession(payload, secret) {
  const body = base64urlEncodeString(JSON.stringify(payload));
  const signature = await sign(body, secret);

  return `${body}.${signature}`;
}

export async function onRequestPost({ request, env }) {
  try {
    const { username, password } = await request.json();

    let role = null;

    if (username === env.MTI_USERNAME && password === env.MTI_PASSWORD) {
      role = 'instructor';
    }

    if (username === env.AIRMAN_USERNAME && password === env.AIRMAN_PASSWORD) {
      role = 'airman';
    }

    if (!role) {
      return jsonResponse({
        isOk: false,
        error: 'Invalid username or password.'
      }, 401);
    }

    const now = Date.now();

    const token = await createSession({
      username,
      role,
      iat: now,
      exp: now + (12 * 60 * 60 * 1000)
    }, env.AUTH_SECRET);

    return jsonResponse({
      isOk: true,
      role
    }, 200, {
      'Set-Cookie': `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=43200`
    });
  } catch (error) {
    return jsonResponse({
      isOk: false,
      error: error.message || 'Login failed.'
    }, 500);
  }
}
