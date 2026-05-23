const COOKIE_NAME = 'prc_sr_session';

const LIQUID_COMMAND_UI_CSS = `
/* PRC-SR Liquid Command UI: Phases 1-5 */
:root {
  --bg: #0b1020;
  --bg-soft: #10172a;
  --surface: rgba(22, 30, 52, 0.78);
  --surface-alt: rgba(38, 48, 76, 0.82);
  --surface-solid: #1e1e1e;
  --text: #eef4ff;
  --text-muted: #9aa7bf;
  --text-soft: #c8d3e8;
  --border: rgba(148, 163, 184, 0.22);
  --green: #16a34a;
  --green-bright: #22c55e;
  --red: #dc2626;
  --red-bright: #ef4444;
  --yellow: #eab308;
  --yellow-bright: #facc15;
  --blue: #38bdf8;
  --blue-deep: #2563eb;
  --cyan-glow: rgba(56, 189, 248, 0.34);
  --dorm-empty-text: #8a94aa;
  --dorm-open-text: #eef4ff;
  --dorm-full-text: #22c55e;
  --dorm-closed-text: #8a94aa;
  --glass-bg: linear-gradient(145deg, rgba(255, 255, 255, 0.105), rgba(255, 255, 255, 0.035));
  --glass-bg-strong: linear-gradient(145deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.055));
  --glass-bg-soft: rgba(255, 255, 255, 0.055);
  --glass-border: rgba(255, 255, 255, 0.16);
  --glass-border-strong: rgba(125, 211, 252, 0.32);
  --glass-highlight: inset 0 1px 0 rgba(255, 255, 255, 0.18);
  --glass-blur: 14px;
  --glass-blur-strong: 22px;
  --shadow-soft: 0 8px 22px rgba(0, 0, 0, 0.26);
  --shadow-medium: 0 14px 36px rgba(0, 0, 0, 0.34);
  --shadow-strong: 0 26px 70px rgba(0, 0, 0, 0.48);
  --shadow-glow-blue: 0 0 22px rgba(56, 189, 248, 0.16);
  --shadow-glow-green: 0 0 22px rgba(34, 197, 94, 0.16);
  --shadow-glow-red: 0 0 24px rgba(239, 68, 68, 0.18);
  --bg-gradient:
    radial-gradient(circle at 18% 12%, rgba(56, 189, 248, 0.16), transparent 32%),
    radial-gradient(circle at 82% 18%, rgba(37, 99, 235, 0.16), transparent 34%),
    radial-gradient(circle at 50% 90%, rgba(22, 163, 74, 0.06), transparent 34%),
    linear-gradient(135deg, #07111f 0%, #0b1020 45%, #111827 100%);
  --btn-green-gradient: linear-gradient(135deg, #15803d 0%, #22c55e 100%);
  --btn-blue-gradient: linear-gradient(135deg, #2563eb 0%, #38bdf8 100%);
  --btn-red-gradient: linear-gradient(135deg, #991b1b 0%, #ef4444 100%);
  --btn-neutral-gradient: linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0.035));
  --radius-sm: 0.5rem;
  --radius-md: 0.75rem;
  --radius-lg: 1rem;
  --radius-xl: 1.25rem;
  --transition-fast: 120ms ease;
  --transition-medium: 180ms ease;
  --transition-slow: 260ms ease;
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
  --glass-bg: linear-gradient(145deg, rgba(255, 255, 255, 0.86), rgba(255, 255, 255, 0.58));
  --glass-bg-strong: linear-gradient(145deg, rgba(255, 255, 255, 0.94), rgba(255, 255, 255, 0.68));
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
  background: var(--bg-gradient) !important;
  min-height: 100vh;
}

/* Phase 2 Core Surfaces */
.surface,
.metric-block,
.dorm-card,
.proc-card,
.modal-content {
  background: var(--glass-bg) !important;
  border-color: var(--glass-border) !important;
  box-shadow: var(--glass-highlight), var(--shadow-soft);
  -webkit-backdrop-filter: blur(var(--glass-blur));
  backdrop-filter: blur(var(--glass-blur));
}

.surface { border-radius: var(--radius-lg); }

.metric-block {
  border: 1px solid var(--glass-border) !important;
  border-radius: var(--radius-lg) !important;
  box-shadow: var(--glass-highlight), var(--shadow-soft), var(--shadow-glow-blue);
}

.dorm-card {
  border-radius: var(--radius-md) !important;
  box-shadow: var(--glass-highlight), var(--shadow-soft);
  transition: transform var(--transition-fast), box-shadow var(--transition-medium), border-color var(--transition-medium), background var(--transition-medium) !important;
}

.dorm-card:hover {
  transform: translateY(-1px) scale(1.008) !important;
  box-shadow: var(--glass-highlight), var(--shadow-medium), var(--shadow-glow-blue);
  border-color: var(--glass-border-strong) !important;
}

.proc-card {
  background: var(--glass-bg-strong) !important;
  border: 1px solid var(--glass-border) !important;
  border-radius: var(--radius-xl) !important;
  box-shadow: var(--glass-highlight), var(--shadow-soft);
  transition: transform var(--transition-fast), box-shadow var(--transition-medium), border-color var(--transition-medium), background var(--transition-medium) !important;
}

.proc-card:hover {
  transform: translateY(-2px) scale(1.012) !important;
  box-shadow: var(--glass-highlight), var(--shadow-medium), var(--shadow-glow-blue);
  border-color: var(--glass-border-strong) !important;
}

/* Phase 3 Buttons and Inputs */
.nav-btn,
.bus-badge,
.phase-btn,
.load-btn,
form button,
.modal-content button:not([class*="text-3xl"]),
#airport-form button,
#init-wg-btn,
#closeout-btn {
  border-radius: var(--radius-md) !important;
  border: 1px solid var(--glass-border) !important;
  box-shadow: var(--glass-highlight), var(--shadow-soft);
  transition: transform var(--transition-fast), box-shadow var(--transition-medium), border-color var(--transition-medium), background var(--transition-medium), opacity var(--transition-fast) !important;
}

.nav-btn {
  background: var(--btn-neutral-gradient) !important;
  color: var(--text-soft) !important;
  border-color: var(--glass-border) !important;
  min-height: 34px !important;
  font-weight: 800;
  letter-spacing: 0.03em;
  -webkit-backdrop-filter: blur(var(--glass-blur));
  backdrop-filter: blur(var(--glass-blur));
}

.nav-btn:hover,
.nav-btn.active {
  color: var(--text) !important;
  border-color: var(--glass-border-strong) !important;
  box-shadow: var(--glass-highlight), var(--shadow-soft), var(--shadow-glow-blue);
  transform: translateY(-1px);
}

.nav-btn.active { background: var(--glass-bg-strong) !important; }

.bus-badge {
  background: var(--btn-green-gradient) !important;
  color: #ffffff !important;
  border-color: rgba(255,255,255,0.22) !important;
  text-shadow: 0 1px 8px rgba(0,0,0,0.28);
  box-shadow: var(--glass-highlight), var(--shadow-soft), var(--shadow-glow-green);
}

.bus-badge:hover {
  transform: translateY(-1px);
  box-shadow: var(--glass-highlight), var(--shadow-medium), var(--shadow-glow-green);
}

.phase-btn,
.load-btn {
  background: var(--btn-neutral-gradient) !important;
  color: var(--text) !important;
  border-color: var(--glass-border) !important;
  -webkit-backdrop-filter: blur(var(--glass-blur));
  backdrop-filter: blur(var(--glass-blur));
}

.phase-btn:hover:not(.selected),
.load-btn:hover {
  background: var(--glass-bg-strong) !important;
  border-color: var(--glass-border-strong) !important;
  transform: translateY(-1px);
  box-shadow: var(--glass-highlight), var(--shadow-medium), var(--shadow-glow-blue);
}

.phase-btn.selected {
  background: var(--btn-green-gradient) !important;
  color: #ffffff !important;
  border-color: rgba(255,255,255,0.24) !important;
  box-shadow: var(--glass-highlight), var(--shadow-soft), var(--shadow-glow-green);
}

form button,
#airport-form button,
#init-wg-btn,
#closeout-btn,
.modal-content button:not([class*="text-3xl"]) {
  font-weight: 900 !important;
  letter-spacing: 0.035em;
  text-transform: uppercase;
}

button[style*="background:#16a34a"],
button[style*="background: #16a34a"],
button[style*="background:var(--green)"],
button[style*="background: var(--green)"],
#init-wg-btn {
  background: var(--btn-green-gradient) !important;
  color: #ffffff !important;
  border-color: rgba(255,255,255,0.22) !important;
  box-shadow: var(--glass-highlight), var(--shadow-soft), var(--shadow-glow-green);
}

button[style*="background:#2563eb"],
button[style*="background: #2563eb"],
button[style*="background:var(--blue)"],
button[style*="background: var(--blue)"] {
  background: var(--btn-blue-gradient) !important;
  color: #ffffff !important;
  border-color: rgba(255,255,255,0.22) !important;
  box-shadow: var(--glass-highlight), var(--shadow-soft), var(--shadow-glow-blue);
}

button[style*="background:#dc2626"],
button[style*="background: #dc2626"],
button[style*="background:var(--red)"],
button[style*="background: var(--red)"] {
  background: var(--btn-red-gradient) !important;
  color: #ffffff !important;
  border-color: rgba(255,255,255,0.22) !important;
  box-shadow: var(--glass-highlight), var(--shadow-soft), var(--shadow-glow-red);
}

form button:hover,
#init-wg-btn:hover,
#closeout-btn:hover,
.modal-content button:not([class*="text-3xl"]):hover {
  transform: translateY(-1px);
  box-shadow: var(--glass-highlight), var(--shadow-medium), var(--shadow-glow-blue);
}

button:active,
.nav-btn:active,
.bus-badge:active,
.phase-btn:active,
.load-btn:active { transform: translateY(0) scale(0.985) !important; }
button:disabled { cursor: not-allowed; opacity: 0.55; filter: saturate(0.75); transform: none !important; }

input,
select,
textarea,
button { min-height: 36px; }

input:focus,
select:focus,
textarea:focus,
button:focus-visible { outline: none; box-shadow: var(--focus-ring); }

input:not([type="checkbox"]),
select,
textarea {
  background: var(--glass-bg-soft) !important;
  color: var(--text) !important;
  border: 1px solid var(--glass-border) !important;
  border-radius: var(--radius-md) !important;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 6px 18px rgba(0,0,0,0.10);
  transition: border-color var(--transition-medium), box-shadow var(--transition-medium), background var(--transition-medium) !important;
  -webkit-backdrop-filter: blur(var(--glass-blur));
  backdrop-filter: blur(var(--glass-blur));
}

input:not([type="checkbox"]):hover,
select:hover,
textarea:hover { border-color: var(--glass-border-strong) !important; }

input:not([type="checkbox"]):focus,
select:focus,
textarea:focus {
  background: var(--glass-bg) !important;
  border-color: var(--glass-border-strong) !important;
  box-shadow: var(--focus-ring), inset 0 1px 0 rgba(255,255,255,0.12) !important;
}

input::placeholder,
textarea::placeholder { color: var(--text-muted); opacity: 0.72; }
select option { background-color: var(--surface-solid) !important; color: var(--text) !important; }
input[type="checkbox"] { accent-color: var(--blue); }

/* Phase 4 Modals */
.confirm-overlay {
  background:
    radial-gradient(circle at 50% 30%, rgba(56, 189, 248, 0.14), transparent 38%),
    rgba(3, 7, 18, 0.72) !important;
  -webkit-backdrop-filter: blur(16px) saturate(1.15);
  backdrop-filter: blur(16px) saturate(1.15);
  animation: modalBackdropIn 180ms ease both;
}

.modal-content {
  position: relative;
  overflow: hidden;
  background: var(--glass-bg-strong) !important;
  border: 1px solid var(--glass-border-strong) !important;
  border-radius: var(--radius-xl) !important;
  box-shadow: var(--glass-highlight), var(--shadow-strong), var(--shadow-glow-blue) !important;
  -webkit-backdrop-filter: blur(var(--glass-blur-strong)) saturate(1.18);
  backdrop-filter: blur(var(--glass-blur-strong)) saturate(1.18);
  animation: modalGlassIn 220ms cubic-bezier(.2,.8,.2,1) both !important;
}

.modal-content::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
  background:
    linear-gradient(135deg, rgba(255,255,255,0.22), transparent 30%),
    radial-gradient(circle at 18% 0%, rgba(56, 189, 248, 0.18), transparent 36%);
  opacity: 0.72;
}

.modal-content > * {
  position: relative;
  z-index: 1;
}

.modal-content h2,
.modal-content h3 {
  letter-spacing: -0.025em;
  text-shadow: 0 1px 18px rgba(56, 189, 248, 0.12);
}

@keyframes modalBackdropIn { from { opacity: 0; } to { opacity: 1; } }

@keyframes modalGlassIn {
  from { opacity: 0; transform: translateY(12px) scale(0.975); filter: blur(2px); }
  to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
}

/* Phase 5 Status Board Readability */
#page-board .board-header {
  gap: 0.9rem !important;
  padding: 0.9rem !important;
}

#page-board .metric-block {
  min-height: 96px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  border-color: rgba(125, 211, 252, 0.26) !important;
}

#metric-arrived,
#metric-airport {
  font-size: clamp(1.6rem, 2.35vw, 2.7rem) !important;
  line-height: 1.02 !important;
  letter-spacing: -0.045em;
  color: var(--text) !important;
  text-shadow: 0 1px 18px rgba(56, 189, 248, 0.22);
}

#active-buses {
  min-height: 44px;
  align-content: center;
}

#page-board .dorm-dashboard {
  gap: 0.9rem !important;
  padding: 0 0.9rem 0.9rem !important;
}

#page-board .dorm-col-header {
  font-size: clamp(0.72rem, 0.9vw, 0.95rem) !important;
  color: var(--text-soft) !important;
  padding: 0.35rem 0.55rem;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  background: rgba(255,255,255,0.045);
  box-shadow: var(--glass-highlight);
}

#page-board .dorm-card {
  min-height: clamp(122px, 15vh, 190px);
  justify-content: center;
  padding: clamp(0.75rem, 1.05vw, 1.25rem) !important;
  border-width: 1px !important;
}

#page-board .dorm-card .font-black.text-4xl,
#page-board .dorm-card .font-black.text-5xl {
  font-size: clamp(2.25rem, 4.1vw, 5.15rem) !important;
  line-height: 0.92 !important;
  letter-spacing: -0.075em;
  text-shadow: 0 1px 20px rgba(0,0,0,0.34);
}

.theme-light #page-board .dorm-card .font-black.text-4xl,
.theme-light #page-board .dorm-card .font-black.text-5xl {
  text-shadow: 0 1px 14px rgba(255,255,255,0.65);
}

#page-board .dorm-card .text-xl.font-black,
#page-board .dorm-card .text-2xl.font-black {
  font-size: clamp(1.35rem, 2vw, 2.2rem) !important;
  color: var(--text-soft);
}

.timer-display {
  font-size: clamp(2rem, 3.35vw, 4rem) !important;
  line-height: 1 !important;
  letter-spacing: -0.055em;
  text-shadow: 0 1px 22px rgba(56, 189, 248, 0.22);
}

.timer-yellow {
  color: var(--yellow-bright) !important;
  text-shadow: 0 0 18px rgba(250, 204, 21, 0.38) !important;
}

.timer-red {
  color: var(--red-bright) !important;
  text-shadow: 0 0 20px rgba(239, 68, 68, 0.46) !important;
}

.timer-flash {
  text-shadow: 0 0 24px rgba(239, 68, 68, 0.72) !important;
}

#col-empty .dorm-card {
  background: linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.025)) !important;
  opacity: 0.86;
}

#col-open .dorm-card {
  border-color: rgba(34, 197, 94, 0.24) !important;
  box-shadow: var(--glass-highlight), var(--shadow-soft), 0 0 20px rgba(34, 197, 94, 0.10);
}

#col-closed .dorm-card,
.dorm-closed {
  opacity: 0.72 !important;
  background: linear-gradient(145deg, rgba(148,163,184,0.10), rgba(15,23,42,0.10)) !important;
  filter: saturate(0.86);
}

.theme-light #col-closed .dorm-card,
.theme-light .dorm-closed {
  background: linear-gradient(145deg, rgba(226,232,240,0.86), rgba(255,255,255,0.60)) !important;
  opacity: 0.78 !important;
}

.border-female {
  border-color: var(--red-bright) !important;
  box-shadow: var(--glass-highlight), var(--shadow-soft), 0 0 0 1px rgba(239, 68, 68, 0.24), var(--shadow-glow-red) !important;
}

.border-band {
  border-color: var(--blue) !important;
  box-shadow: var(--glass-highlight), var(--shadow-soft), 0 0 0 1px rgba(56, 189, 248, 0.26), var(--shadow-glow-blue) !important;
}

#page-processing .proc-card {
  min-height: 150px;
}

#page-processing .proc-card .text-3xl.font-black {
  font-size: clamp(1.9rem, 2.4vw, 3rem) !important;
  letter-spacing: -0.06em;
}

.theme-light .metric-block,
.theme-light .dorm-card,
.theme-light .proc-card,
.theme-light .surface {
  color: var(--text) !important;
  border-color: rgba(100, 116, 139, 0.24) !important;
}

.theme-light .text-muted,
.theme-light #page-board .dorm-col-header {
  color: #475569 !important;
}

.theme-light #metric-arrived,
.theme-light #metric-airport {
  color: #0f172a !important;
  text-shadow: 0 1px 16px rgba(255,255,255,0.70);
}

@media (min-width: 1600px) {
  #page-board .dorm-dashboard { gap: 1rem !important; }
  #page-board .dorm-card { min-height: clamp(150px, 16vh, 220px); }
}

@media (prefers-reduced-motion: reduce) {
  .confirm-overlay,
  .modal-content {
    animation: none !important;
  }
}
`;

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

function applyLiquidCommandUi(html) {
  if (html.includes('PRC-SR Liquid Command UI: Phases 1-5')) {
    return html;
  }

  return html.replace(/<\/head>/i, `<style id="prc-sr-liquid-command-ui">${LIQUID_COMMAND_UI_CSS}</style>\n</head>`);
}

async function maybeApplyLiquidCommandUi(response) {
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('text/html')) {
    return response;
  }

  const html = applyLiquidCommandUi(await response.text());
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

  if (
    pathname === '/login' ||
    pathname === '/login/' ||
    pathname === '/login.html'
  ) {
    return context.next();
  }

  if (
    pathname === '/api/login' ||
    pathname === '/api/logout' ||
    pathname === '/api/ping'
  ) {
    return context.next();
  }

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
      return jsonResponse({ isOk: false, error: 'Unauthorized.' }, 401);
    }

    return Response.redirect(`${url.origin}/login/`, 302);
  }

  return maybeApplyLiquidCommandUi(await context.next());
}
