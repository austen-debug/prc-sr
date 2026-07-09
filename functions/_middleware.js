const COOKIE_NAME = 'prc_sr_session';

const UI_STYLESHEETS = [
  '<link rel="stylesheet" href="/css/gate-index-legacy-shell.css">',
  '<link rel="stylesheet" href="/css/gate-base-tokens.css">',
  '<link rel="stylesheet" href="/css/gate-layout-pages.css">',
  '<link rel="stylesheet" href="/css/gate-components.css">',
  '<link rel="stylesheet" href="/css/gate-utilities-access.css">',
  '<link rel="stylesheet" href="/css/gate-premium-metrics.css?v=premium-metrics-20260709c">'
];

const UI_INLINE_ASSETS = [];

const UI_HEAD_SCRIPTS = [
  '<script src="/js/gate-component-contracts.js" defer></script>',
  '<script src="/js/gate-ui-hooks.js" defer></script>',
  '<script src="/js/gate-branding-controller.js" defer></script>',
  '<script src="/js/prc-dash-runtime-fixes.js" defer></script>',
  '<script src="/js/prc-dash-sat-arrivals.js" defer></script>',
  '<script src="/js/prc-dash-space-force.js" defer></script>',
  '<script src="/js/prc-dash-dorm-reopen.js" defer></script>',
  '<script src="/js/prc-dash-final-audit.js" defer></script>',
  '<script src="/js/prc-dash-dorm-flag-validation.js" defer></script>',
  '<script src="/js/prc-dash-auditorium-location.js" defer></script>',
  '<script src="/js/prc-dash-processing-context-menu.js" defer></script>',
  '<script src="/js/gate-processing-final-time-commit.js?v=final-time-commit-20260707" defer></script>',
  '<script src="/js/gate-airman-modal-close-safety.js?v=airman-modal-close-20260707" defer></script>',
  '<script src="/js/gate-bus-workflow-controller.js" defer></script>',
  '<script src="/js/prc-dash-print-report.js" defer></script>',
  '<script src="/js/gate-input-page-controller.js" defer></script>',
  '<script src="/js/prc-dash-archive-actions.js" defer></script>',
  '<script src="/js/prc-dash-archive-print-cleanup.js" defer></script>',
  '<script src="/js/prc-dash-access-control-validation.js" defer></script>',
  '<script src="/js/prc-dash-modal-mobile-validation.js" defer></script>',
  '<script src="/js/gate-tablet-processing-modal-fix.js?v=tablet-processing-modal-20260707" defer></script>',
  '<script src="/js/gate-mobile-nav-routing-fix.js?v=mobile-nav-routing-20260707" defer></script>',
  '<script src="/js/gate-mobile-shell-redesign.js?v=mobile-shell-redesign-20260707b" defer></script>',
  '<script src="/js/gate-mobile-app-shell-finalizer.js?v=mobile-app-shell-finalizer-20260707" defer></script>',
  '<script src="/js/gate-desktop-nav-restore.js?v=desktop-nav-restore-20260707" defer></script>',
  '<script src="/js/gate-airport-phone-layout-fix.js?v=airport-phone-hard-fix-20260707" defer></script>',
  '<script src="/js/gate-render-stability-fix.js?v=render-stability-20260707" defer></script>',
  '<script src="/js/prc-dash-processing-loaded-summary.js" defer></script>',
  '<script src="/js/prc-dash-current-summary-live-records.js" defer></script>',
  '<script src="/js/gate-archive-print-controller.js" defer></script>',
  '<script src="/js/gate-premium-metrics-controller.js?v=premium-metrics-20260709c" defer></script>',
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

function applyAppShellIdentity(html) {
  let output = html.replace(
    /<title>\s*Pfingston Reception Status Board\s*<\/title>/i,
    '<title>GATE — Gateway Arrival Tracking Environment | Pfingston Reception Center</title>'
  );

  output = output.replace(
    /<title>\s*GATE\s*—\s*Gateway Arrival Tracking Environment\s*<\/title>/i,
    '<title>GATE — Gateway Arrival Tracking Environment | Pfingston Reception Center</title>'
  );

  return output;
}

function normalizeServedBranding(html) {
  return html
    .replace(/\bPRC\s*DASH\b/g, 'GATE')
    .replace(/\bPRC\s*GATE\b/g, 'GATE')
    .replace(/\bPRC[-\s]*SR\b/g, 'GATE')
    .replace(/\bPfingston Reception Status Board\b/g, 'GATE — Gateway Arrival Tracking Environment');
}

function stripLegacyInlineShellCss(html) {
  return html.replace(
    /\s*<style>\s*:root\s*\{[\s\S]*?<\/style>\s*/i,
    '\n'
  );
}

function prepareAppShellHtml(html) {
  return normalizeServedBranding(stripLegacyInlineShellCss(applyAppShellIdentity(html)));
}

function applyUiAssets(html) {
  const updatedHtml = prepareAppShellHtml(html);

  const linksToAdd = UI_STYLESHEETS.filter(link => {
    const href = extractUrl(link, 'href');
    return href && !updatedHtml.includes(href);
  });

  const inlineAssetsToAdd = UI_INLINE_ASSETS.filter(asset => {
    const id = extractId(asset);
    return id ? !updatedHtml.includes(`id="${id}"`) : !updatedHtml.includes(asset);
  });

  const scriptsToAdd = UI_HEAD_SCRIPTS.filter(script => {
    const src = extractUrl(script, 'src');
    return src && !updatedHtml.includes(src);
  });

  const assetsToAdd = [...linksToAdd, ...inlineAssetsToAdd, ...scriptsToAdd];
  if (assetsToAdd.length === 0) return updatedHtml;

  return updatedHtml.replace(/<\/head>/i, `  ${assetsToAdd.join('\n  ')}\n </head>`);
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
