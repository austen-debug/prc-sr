const COOKIE_NAME = 'prc_sr_session';

const UI_STYLESHEETS = [
  '<link rel="stylesheet" href="/css/liquid-command.css">',
  '<link rel="stylesheet" href="/css/prc-dash-nav.css">',
  '<link rel="stylesheet" href="/css/prc-dash-states-empty.css">',
  '<link rel="stylesheet" href="/css/prc-dash-watermark.css">',
  '<link rel="stylesheet" href="/css/prc-dash-input-layout.css">',
  '<link rel="stylesheet" href="/css/prc-dash-view-cleanup.css">',
  '<link rel="stylesheet" href="/css/prc-dash-danger-actions.css">',
  '<link rel="stylesheet" href="/css/prc-dash-nav-compact.css">',
  '<link rel="stylesheet" href="/css/prc-dash-nav-polish.css">',
  '<link rel="stylesheet" href="/css/prc-dash-modal-layer.css">',
  '<link rel="stylesheet" href="/css/prc-dash-dorm-cards.css">',
  '<link rel="stylesheet" href="/css/prc-dash-modal-systems.css">'
];

const UI_INLINE_ASSETS = [
  `<style id="gate-mobile-nav-access-fix">
@media (max-width: 991px) {
  .app-nav.command-header-bar,
  .app-nav {
    display: grid !important;
    grid-template-columns: minmax(78px, 112px) minmax(0, 1fr) !important;
    grid-template-areas:
      "brand menu"
      "tools tools" !important;
    align-items: center !important;
    gap: 6px !important;
    min-height: 124px !important;
    height: auto !important;
    padding: 8px 10px 10px !important;
    overflow: visible !important;
  }

  .app-nav::before {
    grid-area: brand !important;
    width: min(28vw, 108px) !important;
    min-width: 78px !important;
    height: 40px !important;
    min-height: 40px !important;
    justify-self: start !important;
    align-self: center !important;
  }

  #mobile-menu-trigger.mobile-only-control {
    grid-area: menu !important;
    display: inline-flex !important;
    justify-self: end !important;
    width: auto !important;
    min-width: 104px !important;
    max-width: 134px !important;
    height: 40px !important;
    min-height: 40px !important;
    padding: 0 0.78rem !important;
  }

  .app-nav > div:last-child,
  .app-nav .nav-group-right {
    grid-area: tools !important;
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 42px !important;
    gap: 6px !important;
    width: 100% !important;
    min-width: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    border-left: 0 !important;
    overflow: visible !important;
    align-items: center !important;
  }

  #role-toggle {
    grid-column: 1 / -1 !important;
    width: 100% !important;
    max-width: none !important;
  }

  #fullscreen-btn,
  #sound-toggle-btn,
  .app-nav button[aria-label='Toggle theme'] {
    display: inline-flex !important;
    height: 38px !important;
    min-height: 38px !important;
    min-width: 0 !important;
    width: 100% !important;
    max-width: none !important;
    box-sizing: border-box !important;
    justify-content: center !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
  }

  #fullscreen-btn,
  #sound-toggle-btn {
    padding: 0 0.54rem !important;
    font-size: 0.64rem !important;
    letter-spacing: 0.05em !important;
  }

  .app-nav button[aria-label='Toggle theme'] {
    width: 42px !important;
    min-width: 42px !important;
    padding: 0 !important;
    justify-self: end !important;
  }

  #week-group-display {
    display: none !important;
  }

  #main-nav-menu,
  #nav-links,
  .nav-group-left {
    top: calc(100% + 5px) !important;
  }

  body:not(.fullscreen-board) .page,
  body:not(.fullscreen-board) #page-squadron.gate-squadron-page {
    padding-top: 166px !important;
  }
}

@media (max-width: 420px) {
  .app-nav.command-header-bar,
  .app-nav {
    grid-template-columns: 90px minmax(0, 1fr) !important;
    padding-left: 8px !important;
    padding-right: 8px !important;
  }

  .app-nav::before {
    width: 90px !important;
    min-width: 90px !important;
  }

  #mobile-menu-trigger.mobile-only-control {
    min-width: 100px !important;
    max-width: 124px !important;
    padding-left: 0.68rem !important;
    padding-right: 0.68rem !important;
  }
}
</style>`,
  `<style id="gate-squadron-board-airman-scope">
#page-squadron .gate-dorm-airman {
  visibility: hidden !important;
}

#page-squadron .gate-auditorium-location {
  display: none !important;
}
</style>`
];

const UI_HEAD_SCRIPTS = [
  '<script src="/js/prc-dash-runtime-fixes.js" defer></script>',
  '<script src="/js/prc-dash-sat-arrivals.js" defer></script>',
  '<script src="/js/prc-dash-space-force.js" defer></script>',
  '<script src="/js/prc-dash-dorm-reopen.js" defer></script>',
  '<script src="/js/prc-dash-final-audit.js" defer></script>',
  '<script src="/js/prc-dash-dorm-flag-validation.js" defer></script>',
  '<script src="/js/prc-dash-auditorium-location.js" defer></script>',
  '<script src="/js/prc-dash-processing-context-menu.js" defer></script>',
  '<script src="/js/prc-dash-local-bus-edit.js" defer></script>',
  '<script src="/js/prc-dash-print-report.js" defer></script>',
  '<script src="/js/prc-dash-receiving-windows.js" defer></script>',
  '<script src="/js/prc-dash-archive-actions.js" defer></script>',
  '<script src="/js/prc-dash-receiving-window-fields.js" defer></script>',
  '<script src="/js/prc-dash-archive-print-cleanup.js" defer></script>',
  '<script src="/js/prc-dash-access-control-validation.js" defer></script>',
  '<script src="/js/prc-dash-modal-mobile-validation.js" defer></script>',
  '<script src="/js/prc-dash-processing-loaded-summary.js" defer></script>',
  '<script src="/js/prc-dash-current-summary-live-records.js" defer></script>',
  '<script src="/js/prc-dash-overtime-audit.js" defer></script>'
];

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
  const array = new Uint8Array(bytes);
  for (const byte of array) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function safeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
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
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
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

function extractUrl(assetTag, attributeName) {
  const match = assetTag.match(new RegExp(`${attributeName}="([^"]+)"`));
  return match ? match[1] : '';
}

function extractId(assetTag) {
  const match = assetTag.match(/id="([^"]+)"/);
  return match ? match[1] : '';
}

function applyUiAssets(html) {
  const linksToAdd = UI_STYLESHEETS.filter(link => {
    const href = extractUrl(link, 'href');
    return href && !html.includes(href);
  });

  const inlineAssetsToAdd = UI_INLINE_ASSETS.filter(asset => {
    const id = extractId(asset);
    return id ? !html.includes(`id="${id}"`) : !html.includes(asset);
  });

  const scriptsToAdd = UI_HEAD_SCRIPTS.filter(script => {
    const src = extractUrl(script, 'src');
    return src && !html.includes(src);
  });

  const assetsToAdd = [...linksToAdd, ...inlineAssetsToAdd, ...scriptsToAdd];
  if (assetsToAdd.length === 0) return html;

  return html.replace(/<\/head>/i, `  ${assetsToAdd.join('\n  ')}\n </head>`);
}

async function maybeApplyUiAssets(response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  const html = applyUiAssets(await response.text());
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

  if (pathname === '/login' || pathname === '/login/' || pathname === '/login.html') return context.next();
  if (pathname === '/api/login' || pathname === '/api/logout' || pathname === '/api/ping') return context.next();

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
    if (pathname.startsWith('/api/')) return jsonResponse({ isOk: false, error: 'Unauthorized.' }, 401);
    return Response.redirect(`${url.origin}/login/`, 302);
  }

  return maybeApplyUiAssets(await context.next());
}
