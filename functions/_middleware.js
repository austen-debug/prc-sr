const COOKIE_NAME = 'prc_sr_session';

const PHASE_1_THEME_CSS = `:root {
  /* Core theme */
  --bg: #0b1020;
  --bg-soft: #10172a;
  --surface: rgba(22, 30, 52, 0.78);
  --surface-alt: rgba(38, 48, 76, 0.82);
  --surface-solid: #1e1e1e;

  --text: #eef4ff;
  --text-muted: #9aa7bf;
  --text-soft: #c8d3e8;
  --border: rgba(148, 163, 184, 0.22);

  /* Operational colors */
  --green: #16a34a;
  --green-bright: #22c55e;
  --red: #dc2626;
  --red-bright: #ef4444;
  --yellow: #eab308;
  --yellow-bright: #facc15;
  --blue: #38bdf8;
  --blue-deep: #2563eb;
  --cyan-glow: rgba(56, 189, 248, 0.34);

  /* Dorm text states */
  --dorm-empty-text: #8a94aa;
  --dorm-open-text: #eef4ff;
  --dorm-full-text: #22c55e;
  --dorm-closed-text: #8a94aa;

  /* Liquid glass surfaces */
  --glass-bg: linear-gradient(
    145deg,
    rgba(255, 255, 255, 0.105),
    rgba(255, 255, 255, 0.035)
  );
  --glass-bg-strong: linear-gradient(
    145deg,
    rgba(255, 255, 255, 0.16),
    rgba(255, 255, 255, 0.055)
  );
  --glass-bg-soft: rgba(255, 255, 255, 0.055);
  --glass-border: rgba(255, 255, 255, 0.16);
  --glass-border-strong: rgba(125, 211, 252, 0.32);
  --glass-highlight: inset 0 1px 0 rgba(255, 255, 255, 0.18);
  --glass-blur: 14px;
  --glass-blur-strong: 22px;

  /* Shadows / elevation */
  --shadow-soft: 0 8px 22px rgba(0, 0, 0, 0.26);
  --shadow-medium: 0 14px 36px rgba(0, 0, 0, 0.34);
  --shadow-strong: 0 26px 70px rgba(0, 0, 0, 0.48);
  --shadow-glow-blue: 0 0 22px rgba(56, 189, 248, 0.16);
  --shadow-glow-green: 0 0 22px rgba(34, 197, 94, 0.16);
  --shadow-glow-red: 0 0 24px rgba(239, 68, 68, 0.18);

  /* Gradients */
  --bg-gradient:
    radial-gradient(circle at 18% 12%, rgba(56, 189, 248, 0.16), transparent 32%),
    radial-gradient(circle at 82% 18%, rgba(37, 99, 235, 0.16), transparent 34%),
    radial-gradient(circle at 50% 90%, rgba(22, 163, 74, 0.06), transparent 34%),
    linear-gradient(135deg, #07111f 0%, #0b1020 45%, #111827 100%);

  --btn-green-gradient: linear-gradient(135deg, #15803d 0%, #22c55e 100%);
  --btn-blue-gradient: linear-gradient(135deg, #2563eb 0%, #38bdf8 100%);
  --btn-red-gradient: linear-gradient(135deg, #991b1b 0%, #ef4444 100%);
  --btn-neutral-gradient: linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0.035));

  /* Radius / spacing / motion */
  --radius-sm: 0.5rem;
  --radius-md: 0.75rem;
  --radius-lg: 1rem;
  --radius-xl: 1.25rem;

  --transition-fast: 120ms ease;
  --transition-medium: 180ms ease;
  --transition-slow: 260ms ease;

  /* Focus */
  --focus-ring: 0 0 0 3px rgba(56, 189, 248, 0.28);
}

.theme-light {
  --bg: #eef3f8;
  --bg-soft: #f7f9fc;
  --surface: rgba(255, 255, 255, 0.78);
  --surface-alt: rgba(231, 236, 245, 0.86);
  --surface-solid: #ffffff;

  --text: #0f172a;
  --text-muted: #64748b;
  --text-soft: #334155;
  --border: rgba(100, 116, 139, 0.22);

  --green: #15803d;
  --green-bright: #16a34a;
  --red: #b91c1c;
  --red-bright: #dc2626;
  --yellow: #ca8a04;
  --yellow-bright: #eab308;
  --blue: #0284c7;
  --blue-deep: #2563eb;
  --cyan-glow: rgba(2, 132, 199, 0.22);

  --dorm-empty-text: #6b7280;
  --dorm-open-text: #111827;
  --dorm-full-text: #15803d;
  --dorm-closed-text: #6b7280;

  --glass-bg: linear-gradient(
    145deg,
    rgba(255, 255, 255, 0.86),
    rgba(255, 255, 255, 0.58)
  );
  --glass-bg-strong: linear-gradient(
    145deg,
    rgba(255, 255, 255, 0.94),
    rgba(255, 255, 255, 0.68)
  );
  --glass-bg-soft: rgba(255, 255, 255, 0.62);
  --glass-border: rgba(100, 116, 139, 0.20);
  --glass-border-strong: rgba(2, 132, 199, 0.28);
  --glass-highlight: inset 0 1px 0 rgba(255, 255, 255, 0.92);
  --glass-blur: 14px;
  --glass-blur-strong: 22px;

  --shadow-soft: 0 8px 22px rgba(15, 23, 42, 0.10);
  --shadow-medium: 0 14px 36px rgba(15, 23, 42, 0.14);
  --shadow-strong: 0 26px 70px rgba(15, 23, 42, 0.20);
  --shadow-glow-blue: 0 0 22px rgba(2, 132, 199, 0.14);
  --shadow-glow-green: 0 0 22px rgba(21, 128, 61, 0.14);
  --shadow-glow-red: 0 0 24px rgba(185, 28, 28, 0.14);

  --bg-gradient:
    radial-gradient(circle at 18% 12%, rgba(56, 189, 248, 0.18), transparent 32%),
    radial-gradient(circle at 82% 18%, rgba(37, 99, 235, 0.12), transparent 34%),
    radial-gradient(circle at 50% 90%, rgba(22, 163, 74, 0.07), transparent 34%),
    linear-gradient(135deg, #eaf1f8 0%, #f8fafc 48%, #eef2f7 100%);

  --btn-green-gradient: linear-gradient(135deg, #15803d 0%, #22c55e 100%);
  --btn-blue-gradient: linear-gradient(135deg, #2563eb 0%, #38bdf8 100%);
  --btn-red-gradient: linear-gradient(135deg, #b91c1c 0%, #ef4444 100%);
  --btn-neutral-gradient: linear-gradient(135deg, rgba(255,255,255,0.90), rgba(255,255,255,0.55));

  --focus-ring: 0 0 0 3px rgba(2, 132, 199, 0.22);
}

html,
body {
  background: var(--bg-gradient);
  min-height: 100vh;
}`;

const FOCUS_POLISH_CSS = `input, select, textarea, button {
  min-height: 36px;
}

input:focus,
select:focus,
textarea:focus,
button:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}`;

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

function applyPhaseOneUiTokens(html) {
  return html
    .replace(
      /:root\s*\{[\s\S]*?\}\s*\.theme-light\s*\{[\s\S]*?\}\s*html,\s*body\s*\{[\s\S]*?\}/,
      PHASE_1_THEME_CSS
    )
    .replace(
      /input,\s*select,\s*button\s*\{\s*min-height:\s*36px;\s*\}/,
      FOCUS_POLISH_CSS
    );
}

async function maybeApplyPhaseOneUi(response) {
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('text/html')) {
    return response;
  }

  const html = applyPhaseOneUiTokens(await response.text());
  const headers = new Headers(response.headers);
  headers.set('content-type', 'text/html; charset=UTF-8');
  headers.delete('content-length');

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const pathname = url.pathname;

  // Always allow login routes. Do not redirect these.
  if (
    pathname === '/login' ||
    pathname === '/login/' ||
    pathname === '/login.html'
  ) {
    return context.next();
  }

  // Always allow auth endpoints.
  if (
    pathname === '/api/login' ||
    pathname === '/api/logout' ||
    pathname === '/api/ping'
  ) {
    return context.next();
  }

  // Allow static assets.
  if (
    pathname === '/favicon.ico' ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.js') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.jpeg') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.webp') ||
    pathname.endsWith('.mp3')
  ) {
    return context.next();
  }

  const session = await verifySession(context.request, context.env);

  if (!session) {
    if (pathname.startsWith('/api/')) {
      return jsonResponse({
        isOk: false,
        error: 'Unauthorized.'
      }, 401);
    }

    return Response.redirect(`${url.origin}/login/`, 302);
  }

  return maybeApplyPhaseOneUi(await context.next());
}
