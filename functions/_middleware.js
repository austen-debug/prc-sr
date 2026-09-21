// Single server-side entry gate. The existing GATE HTML transformations remain in
// gate-shell-legacy.mjs; authorization must run BEFORE any application HTML is served.
import { verifyRequestSession } from './api/session-contract.mjs';
import { onRequest as renderLegacyShell } from './gate-shell-legacy.mjs';

const PUBLIC = new Set(['/login', '/login/', '/login.html', '/api/login', '/api/ping']);
const ASSET = /\.(?:css|js|mjs|png|jpe?g|svg|ico|webp|mp3|woff2?)$/i;
const BOARD = new Set(['/squadron', '/squadron/', '/squadron/index.html']);
const ALLOWED_ROLES = new Set(['instructor', 'airman', 'squadron']);

const json = (status, error) => new Response(JSON.stringify({ isOk: false, code: status === 401 ? 'unauthorized' : 'forbidden', error }), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
});

export async function onRequest(context) {
  const { request, env } = context;
  const path = new URL(request.url).pathname;
  const method = request.method;
  if (PUBLIC.has(path) || path === '/favicon.ico' || ASSET.test(path)) return context.next();
  if (!env.AUTH_SECRET || typeof env.AUTH_SECRET !== 'string' || env.AUTH_SECRET.length < 32) {
    return json(503, 'Session signing is not configured.');
  }
  const session = await verifyRequestSession(request, env);
  if (!session || !ALLOWED_ROLES.has(session.role)) {
    return path.startsWith('/api/') ? json(401, 'Unauthorized.') : Response.redirect(new URL('/login/', request.url), 302);
  }
  context.data ||= {};
  context.data.session = session;

  // A Squadron session is *only* a Squadron Board session. No generic records,
  // lifecycle, archives, SAT arrivals, staff APIs, or general application HTML.
  if (session.role === 'squadron') {
    if (path === '/api/logout' && method === 'POST') return context.next();
    if (path === '/api/session' && method === 'GET') return context.next();
    if (path === '/api/squadron-board' && method === 'GET') return context.next();
    if (BOARD.has(path) && (method === 'GET' || method === 'HEAD')) return context.next();
    if (path.startsWith('/api/')) return json(403, 'Squadron access is limited to the read-only Squadron Board.');
    if (method === 'GET' || method === 'HEAD') return Response.redirect(new URL('/squadron/', request.url), 302);
    return json(403, 'Squadron access is read-only.');
  }

  if (BOARD.has(path)) {
    if (session.role !== 'instructor') return json(403, 'Squadron Board access is not permitted.');
    return (method === 'GET' || method === 'HEAD') ? context.next() : json(405, 'This page is read-only.');
  }
  if (path === '/api/squadron-board' && method !== 'GET') return json(405, 'Squadron Board data is read-only.');
  return renderLegacyShell(context);
}
