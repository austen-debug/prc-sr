from pathlib import Path
import re

CSS = Path('public/css/military-glass-terminal.css')
INDEX = Path('public/index.html')
LOGIN = Path('public/login/index.html')
MIDDLEWARE = Path('functions/_middleware.js')
BUDGET = Path('docs/build-2/ACTIVE_RUNTIME_BUDGET.json')
STACK = Path('docs/ACTIVE_RUNTIME_STACK.md')

css = CSS.read_text()

old_header = '''/*
 * GATE — Military Glass Terminal
 * Canonical production visual contract.
 * One asset. No @import graph. No !important escalation.
 * Visual ownership only; application state, persistence, and event behavior remain external.
 */'''
new_header = '''/*
 * GATE — Military Glass Terminal
 * Canonical production visual contract. v2.0
 * One asset. No @import graph. No !important escalation.
 * Visual ownership only; application state, persistence, and event behavior remain external.
 *
 * ACCENT CONTRACT
 *   --mg-accent  (green)  live data, nominal status, telemetry readouts. Never interactive.
 *   --mg-signal  (cyan)   focus, selection, active nav, primary action. Never data.
 * Every legacy alias below still resolves to the value existing controllers expect.
 *
 * ELEVATION LADDER
 *   L1 planes   surfaces, cards, boards        blur 14
 *   L2 chrome   banner, nav, sticky heads      blur 20
 *   L3 overlay  context menus, popovers        blur 30
 *   L4 modal    dialogs, login, drawers        blur 40
 */'''
if old_header not in css:
    raise SystemExit('Canonical stylesheet header contract not found')
css = css.replace(old_header, new_header, 1)

foundation_start = css.index('/* --------------------------------------------------------------------------\n   1. FOUNDATION TOKENS')
base_start = css.index('/* --------------------------------------------------------------------------\n   2. BASE, RESET, ACCESSIBILITY, AND ANTI-FOUC GEOMETRY', foundation_start)

foundation = r'''/* --------------------------------------------------------------------------
   1. FOUNDATION TOKENS
   -------------------------------------------------------------------------- */
:root {
  color-scheme: dark;

  --mg-bg: #070b12;
  --mg-bg-elevated: #0e1622;
  --mg-carbon: #0b1119;

  --mg-surface: rgba(20, 31, 46, 0.62);
  --mg-surface-strong: rgba(12, 20, 31, 0.92);
  --mg-surface-soft: rgba(30, 44, 62, 0.40);
  --mg-surface-muted: rgba(124, 154, 190, 0.10);
  --mg-l2: rgba(14, 22, 34, 0.86);
  --mg-l3: rgba(16, 25, 38, 0.90);
  --mg-l4: var(--mg-surface-strong);
  --mg-blur-1: 14px;
  --mg-blur-2: 20px;
  --mg-blur-3: 30px;
  --mg-blur-4: 40px;

  --mg-text: #dfe8f2;
  --mg-text-soft: #9fb2c6;
  --mg-text-muted: #6e8299;

  --mg-accent: #3fd98a;
  --mg-accent-rgb: 63, 217, 138;
  --mg-accent-deep: #1f8f58;
  --mg-phosphor: var(--mg-accent);
  --mg-signal: #4fc3e8;
  --mg-signal-rgb: 79, 195, 232;
  --mg-signal-deep: #1d7fa3;

  --mg-blue: #58b9dd;
  --mg-red: #ff5a5f;
  --mg-yellow: #f5b53f;
  --mg-olive: #75835c;
  --mg-standby: #7e93a8;
  --mg-priority: #9c8cff;

  --mg-border-glass: rgba(163, 196, 230, 0.14);
  --mg-border-soft: rgba(163, 196, 230, 0.085);
  --mg-border-strong: rgba(163, 196, 230, 0.26);
  --mg-line: rgba(120, 160, 200, 0.10);
  --mg-field: rgba(3, 7, 13, 0.55);
  --mg-overlay: rgba(3, 6, 11, 0.74);
  --mg-focus: rgba(var(--mg-signal-rgb), 0.30);
  --mg-shadow-soft: 0 12px 34px rgba(0, 0, 0, 0.34);
  --mg-shadow-strong: 0 28px 72px rgba(0, 0, 0, 0.52);
  --mg-inset-edge: inset 0 1px 0 rgba(255, 255, 255, 0.075);
  --mg-inset-edge-strong: inset 0 1px 0 rgba(255, 255, 255, 0.12);

  --mg-glass-blur: var(--mg-blur-1);
  --mg-glass-saturate: 138%;

  --mg-max-content: 1850px;
  --mg-page-gap: 1.5rem;
  --mg-control-h: 42px;
  --mg-control-h-lg: 46px;
  --mg-radius-xs: 6px;
  --mg-radius-sm: 8px;
  --mg-radius-md: 12px;
  --mg-radius-lg: 16px;
  --mg-radius-xl: 22px;
  --mg-radius-pill: 999px;

  --mg-font-sans: "DM Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --mg-font-mono: "IBM Plex Mono", "JetBrains Mono", ui-monospace, "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  --mg-track-label: .095em;
  --mg-weight-label: 700;
  --mg-weight-value: 700;

  --mg-z-base: 0;
  --mg-z-static: 10;
  --mg-z-shell: 100;
  --mg-z-popover: 500;
  --mg-z-modal: 50000;
  --mg-z-critical: 999999;

  --mg-banner-h: 24px;
  --mg-nav-h: 58px;
  --mg-shell-top: calc(var(--mg-banner-h) + var(--mg-nav-h));
  --mg-spring: transform 160ms cubic-bezier(0.25, 1, 0.5, 1);
  --mg-fade: opacity 140ms ease, background-color 140ms ease, border-color 140ms ease, box-shadow 140ms ease, color 140ms ease;

  --mg-scan-op: 0.028;

  --bg: var(--mg-bg);
  --surface: var(--mg-surface);
  --surface-alt: var(--mg-surface-soft);
  --surface-solid: var(--mg-bg-elevated);
  --text: var(--mg-text);
  --text-soft: var(--mg-text-soft);
  --text-muted: var(--mg-text-muted);
  --border: var(--mg-border-glass);
  --green: var(--mg-accent-deep);
  --green-bright: var(--mg-accent);
  --red: var(--mg-red);
  --red-bright: var(--mg-red);
  --yellow: var(--mg-yellow);
  --yellow-bright: var(--mg-yellow);
  --blue: var(--mg-blue);
  --blue-deep: var(--mg-signal-deep);
  --bg-canvas: var(--mg-bg);
  --bg-card: var(--mg-surface);
  --bg-panel: var(--mg-surface-soft);
  --bg-elevated: var(--mg-bg-elevated);
  --color-text: var(--mg-text);
  --color-text-soft: var(--mg-text-soft);
  --color-text-muted: var(--mg-text-muted);
  --border-muted: var(--mg-border-soft);
  --border-default: var(--mg-border-glass);
  --border-strong: var(--mg-border-strong);
  --gate-glass-bg: var(--mg-surface);
  --gate-glass-bg-soft: var(--mg-surface-soft);
  --gate-glass-bg-strong: var(--mg-surface-strong);
  --gate-glass-border: var(--mg-border-glass);
  --gate-glass-border-strong: var(--mg-border-strong);
  --gate-glass-blur: var(--mg-blur-1);
  --gate-glass-blur-strong: var(--mg-blur-4);
  --gate-glass-edge: var(--mg-inset-edge);
  --gate-shadow-soft: var(--mg-shadow-soft);
  --gate-shadow-strong: var(--mg-shadow-strong);
  --glass-bg: var(--mg-surface);
  --glass-border: var(--mg-border-glass);
  --glass-blur: var(--mg-blur-1);
  --shadow-soft-unified: var(--mg-shadow-soft);
  --radius-sm: var(--mg-radius-sm);
  --radius-md: var(--mg-radius-md);
  --radius-lg: var(--mg-radius-lg);
  --radius-xl: var(--mg-radius-xl);
  --radius-pill: var(--mg-radius-pill);
  --z-modal-backdrop: var(--mg-z-modal);
  --z-modal-window: var(--mg-z-modal);
  --gate-flag-female-red: #ff5c63;
  --gate-flag-band-green: #59c877;
  --gate-flag-space-force-bluebird: #5bc9f0;
  --gate-dorm-card-pad-y: 0.92rem;
  --gate-dorm-card-pad-x: 1rem;
  --input-matrix-grid: minmax(86px, .92fr) minmax(82px, .86fr) minmax(128px, 1.18fr) minmax(150px, 1.36fr) minmax(110px, .88fr) 58px 74px minmax(104px, .86fr) 36px;
  --input-matrix-gap: clamp(6px, .72vw, 10px);
  --input-matrix-min-width: 1040px;
}

body.theme-light,
.theme-light {
  color-scheme: light;
  --mg-bg: #eef2f7;
  --mg-bg-elevated: #ffffff;
  --mg-carbon: #101a26;
  --mg-surface: rgba(255, 255, 255, 0.82);
  --mg-surface-strong: rgba(252, 253, 255, 0.97);
  --mg-surface-soft: rgba(226, 233, 242, 0.78);
  --mg-surface-muted: rgba(31, 56, 88, 0.06);
  --mg-l2: rgba(249, 251, 253, 0.92);
  --mg-l3: rgba(253, 254, 255, 0.95);
  --mg-text: #101a26;
  --mg-text-soft: #3c4e63;
  --mg-text-muted: #64778d;
  --mg-accent: #157a4d;
  --mg-accent-rgb: 21, 122, 77;
  --mg-accent-deep: #0f5f3c;
  --mg-signal: #0e7fa6;
  --mg-signal-rgb: 14, 127, 166;
  --mg-signal-deep: #0a5f7d;
  --mg-blue: #2f6f8a;
  --mg-red: #c1272d;
  --mg-yellow: #9a6b0c;
  --mg-olive: #68784e;
  --mg-standby: #64778d;
  --mg-priority: #5b4bc4;
  --mg-border-glass: rgba(37, 62, 94, 0.20);
  --mg-border-soft: rgba(37, 62, 94, 0.11);
  --mg-border-strong: rgba(37, 62, 94, 0.34);
  --mg-line: rgba(37, 62, 94, 0.10);
  --mg-field: rgba(255, 255, 255, 0.92);
  --mg-overlay: rgba(225, 232, 240, 0.86);
  --mg-focus: rgba(var(--mg-signal-rgb), 0.22);
  --mg-shadow-soft: 0 10px 28px rgba(24, 40, 62, 0.10);
  --mg-shadow-strong: 0 24px 54px rgba(24, 40, 62, 0.16);
  --mg-inset-edge: inset 0 1px 0 rgba(255, 255, 255, 0.9);
  --mg-inset-edge-strong: inset 0 1px 0 #fff;
  --mg-scan-op: 0;
  --gate-flag-female-red: #a94440;
  --gate-flag-band-green: #3f6b4c;
  --gate-flag-space-force-bluebird: #3d6d85;
}

body[data-mg-density="compact"] {
  --mg-control-h: 36px;
  --mg-control-h-lg: 40px;
  --mg-page-gap: 1rem;
  --gate-dorm-card-pad-y: .7rem;
  --gate-dorm-card-pad-x: .8rem;
}

body[data-mg-density="condensed"] {
  --mg-control-h: 32px;
  --mg-control-h-lg: 36px;
  --mg-page-gap: .75rem;
  --gate-dorm-card-pad-y: .58rem;
  --gate-dorm-card-pad-x: .68rem;
}

@media (pointer: coarse) {
  body[data-mg-density="compact"],
  body[data-mg-density="condensed"] {
    --mg-control-h: 44px;
    --mg-control-h-lg: 46px;
  }
}

'''
css = css[:foundation_start] + foundation + css[base_start:]

marker = '/* 16. MILITARY GLASS TERMINAL V2 VISUAL SEMANTICS */'
if marker in css:
    raise SystemExit('v2 visual semantics already present')

v2 = r'''

/* 16. MILITARY GLASS TERMINAL V2 VISUAL SEMANTICS */

body {
  font-family: var(--mg-font-sans);
  background:
    radial-gradient(circle at 12% -12%, rgba(var(--mg-signal-rgb), .075), transparent 34rem),
    radial-gradient(circle at 88% 112%, rgba(var(--mg-accent-rgb), .045), transparent 30rem),
    var(--mg-bg);
}

body.theme-light {
  background: var(--mg-bg);
}

.metric-value,
.gate-squadron-metric-value,
.gate-dorm-timer,
.timer-display,
.gate-dorm-load,
.font-tabular {
  font-family: var(--mg-font-mono);
}

.metric-label,
.gate-squadron-metric-label,
.gate-active-buses-label,
.gate-dorm-status,
.gate-dorm-info,
.gate-dorm-flag-chip,
.gate-archive-search-label {
  font-weight: var(--mg-weight-label);
  letter-spacing: var(--mg-track-label);
}

.surface,
.metric-card,
.metric-block,
.dorm-card,
.gate-dorm-card,
.proc-card,
.gate-squadron-metric,
.gate-active-buses-block,
.sat-arrivals-board,
.gate-archive-toolbar,
.gate-archive-year,
.gate-archive-month,
.gate-archive-record-card,
#receiving-windows-panel {
  background: var(--mg-surface);
  box-shadow: var(--mg-inset-edge), var(--mg-shadow-soft);
  backdrop-filter: blur(var(--mg-blur-1)) saturate(var(--mg-glass-saturate));
  -webkit-backdrop-filter: blur(var(--mg-blur-1)) saturate(var(--mg-glass-saturate));
}

.app-nav,
.app-nav.command-header-bar,
.command-header-bar,
thead th,
.modal-content > .flex.justify-between.items-center.mb-4,
#dorm-modal .gate-processing-workspace__header,
#dorm-modal .gate-processing-workspace__footer {
  background: var(--mg-l2);
  box-shadow: var(--mg-inset-edge-strong), 0 10px 30px rgba(0, 0, 0, .18);
  backdrop-filter: blur(var(--mg-blur-2)) saturate(142%);
  -webkit-backdrop-filter: blur(var(--mg-blur-2)) saturate(142%);
}

.gate-processing-context-menu,
#gate-processing-context-menu,
#gate-airport-bus-context-menu {
  background: var(--mg-l3);
  box-shadow: var(--mg-inset-edge-strong), var(--mg-shadow-strong);
  backdrop-filter: blur(var(--mg-blur-3)) saturate(145%);
  -webkit-backdrop-filter: blur(var(--mg-blur-3)) saturate(145%);
}

.modal-content,
.confirm-overlay > .modal-content,
#confirm-dialog > .surface,
#confirm-dialog > div,
.login-card,
.login-card-surface,
body.gate-app-shell-ready #gate-mobile-nav-sheet {
  background: var(--mg-l4);
  box-shadow: var(--mg-inset-edge-strong), var(--mg-shadow-strong);
  backdrop-filter: blur(var(--mg-blur-4)) saturate(148%);
  -webkit-backdrop-filter: blur(var(--mg-blur-4)) saturate(148%);
}

.app-nav::before,
.command-header-bar::before {
  color: var(--mg-text);
}

input:focus-visible,
select:focus-visible,
textarea:focus-visible,
button:focus-visible,
[role="button"]:focus-visible,
summary:focus-visible {
  outline-color: var(--mg-signal);
  border-color: color-mix(in srgb, var(--mg-signal) 58%, var(--mg-border-strong));
  box-shadow: 0 0 0 4px var(--mg-focus);
}

.nav-btn.active,
.nav-btn.current-page,
.gate-component-nav-button.active,
.gate-component-nav-button[aria-current="page"] {
  border-color: color-mix(in srgb, var(--mg-signal) 66%, var(--mg-border-glass));
  background: color-mix(in srgb, var(--mg-signal) 13%, var(--mg-surface));
  color: var(--mg-signal);
}

body.theme-light .nav-btn.active,
body.theme-light .nav-btn.current-page,
body.theme-light .gate-component-nav-button.active,
body.theme-light .gate-component-nav-button[aria-current="page"] {
  border-color: color-mix(in srgb, var(--mg-signal) 52%, var(--mg-border-glass));
  background: color-mix(in srgb, var(--mg-signal) 10%, #fff);
  color: var(--mg-signal-deep);
}

.gate-primary-action,
.login-button {
  border: 1px solid color-mix(in srgb, var(--mg-signal) 68%, var(--mg-border-glass));
  background: linear-gradient(180deg, color-mix(in srgb, var(--mg-signal) 78%, #fff 4%), var(--mg-signal-deep));
  color: #f7fbff;
  box-shadow: var(--mg-inset-edge-strong), 0 8px 22px rgba(var(--mg-signal-rgb), .16);
}

.gate-primary-action:hover,
.login-button:hover {
  border-color: color-mix(in srgb, var(--mg-signal) 84%, #fff 10%);
  background: linear-gradient(180deg, color-mix(in srgb, var(--mg-signal) 88%, #fff 5%), color-mix(in srgb, var(--mg-signal-deep) 92%, #000));
}

.gate-danger-action {
  border: 1px solid color-mix(in srgb, var(--mg-red) 64%, var(--mg-border-glass));
  background: color-mix(in srgb, var(--mg-red) 72%, var(--mg-bg-elevated));
  color: #fff;
}

body.theme-light .gate-primary-action,
body.theme-light .login-button {
  background: var(--mg-signal-deep);
  color: #fff;
  box-shadow: var(--mg-inset-edge-strong), var(--mg-shadow-soft);
}

body.theme-light .gate-danger-action {
  background: var(--mg-red);
  color: #fff;
  box-shadow: none;
}

#batch-rows-container .batch-band,
#batch-rows-container .batch-space-force,
#edit-band,
#edit-space-force {
  accent-color: var(--mg-signal);
}

#dorm-modal .phase-btn.selected {
  border-color: color-mix(in srgb, var(--mg-signal) 58%, var(--mg-border-glass));
  background: color-mix(in srgb, var(--mg-signal) 14%, var(--mg-surface));
  color: var(--mg-signal);
}

body.theme-light #dorm-modal .phase-btn.selected {
  background: color-mix(in srgb, var(--mg-signal) 10%, #fff);
  color: var(--mg-signal-deep);
}

#reopen-dorm-btn {
  border-color: color-mix(in srgb, var(--mg-signal) 52%, var(--mg-border-glass));
  background: color-mix(in srgb, var(--mg-signal) 12%, var(--mg-surface));
  color: var(--mg-signal);
}

#page-processing #proc-dorm-grid .proc-card:hover,
#page-processing #proc-dorm-grid .proc-card:focus-visible {
  border-color: color-mix(in srgb, var(--mg-signal) 52%, var(--mg-border-strong));
  box-shadow: var(--mg-inset-edge), 0 14px 34px rgba(var(--mg-signal-rgb), .10);
}

#page-board .gate-dorm-card.border-female,
#page-board .dorm-card.border-female,
#page-board .gate-dorm-card[data-female-dorm="true"],
#page-board .dorm-card[data-female-dorm="true"],
#page-squadron .gate-dorm-card.border-female,
#page-squadron .dorm-card.border-female,
#page-squadron .gate-dorm-card[data-female-dorm="true"],
#page-squadron .dorm-card[data-female-dorm="true"] {
  border-width: 2px;
  border-style: solid;
  border-color: var(--gate-flag-female-red);
  box-shadow: var(--mg-inset-edge), 0 0 0 1px color-mix(in srgb, var(--gate-flag-female-red) 52%, transparent), 0 0 18px color-mix(in srgb, var(--gate-flag-female-red) 16%, transparent), var(--mg-shadow-soft);
}

#page-processing #proc-dorm-grid .proc-card.border-female {
  border-width: 3px;
  border-color: var(--gate-flag-female-red);
  box-shadow: var(--mg-inset-edge), 0 0 0 1px color-mix(in srgb, var(--gate-flag-female-red) 62%, transparent), 0 0 20px color-mix(in srgb, var(--gate-flag-female-red) 22%, transparent), var(--mg-shadow-soft);
}

body.theme-light #page-board .gate-dorm-card.border-female,
body.theme-light #page-board .dorm-card.border-female,
body.theme-light #page-squadron .gate-dorm-card.border-female,
body.theme-light #page-squadron .dorm-card.border-female,
body.theme-light #page-processing #proc-dorm-grid .proc-card.border-female {
  border-color: var(--gate-flag-female-red);
  box-shadow: var(--mg-inset-edge), 0 0 0 1px color-mix(in srgb, var(--gate-flag-female-red) 24%, transparent), var(--mg-shadow-soft);
}

.gate-dorm-top-banner.banner-space-force {
  border-bottom-color: color-mix(in srgb, var(--gate-flag-space-force-bluebird) 54%, var(--mg-border-soft));
  background: color-mix(in srgb, var(--gate-flag-space-force-bluebird) 18%, var(--mg-surface-strong));
  color: color-mix(in srgb, var(--gate-flag-space-force-bluebird) 40%, #fff);
}

.gate-dorm-top-banner.banner-band {
  border-bottom-color: color-mix(in srgb, var(--gate-flag-band-green) 54%, var(--mg-border-soft));
  background: color-mix(in srgb, var(--gate-flag-band-green) 18%, var(--mg-surface-strong));
  color: color-mix(in srgb, var(--gate-flag-band-green) 38%, #fff);
}

.gate-dorm-flag-chip.flag-space-force,
#page-processing .proc-card.border-space-force > .text-xl.font-black.font-tabular::before {
  border-color: color-mix(in srgb, var(--gate-flag-space-force-bluebird) 48%, var(--mg-border-soft));
  background: color-mix(in srgb, var(--gate-flag-space-force-bluebird) 12%, transparent);
  color: var(--gate-flag-space-force-bluebird);
}

.gate-dorm-flag-chip.flag-band,
#page-processing .proc-card.border-band > .text-xl.font-black.font-tabular::before {
  border-color: color-mix(in srgb, var(--gate-flag-band-green) 48%, var(--mg-border-soft));
  background: color-mix(in srgb, var(--gate-flag-band-green) 12%, transparent);
  color: var(--gate-flag-band-green);
}

#page-processing .proc-card.border-space-force .gate-dorm-flags,
#page-processing .proc-card.border-band .gate-dorm-flags {
  display: none;
}

body.theme-light #page-board .metric-value,
body.theme-light .gate-squadron-metric-value,
body.theme-light #page-board #active-buses .prc-bus-card-title,
body.theme-light .gate-dorm-state-open .gate-dorm-status,
body.theme-light .gate-dorm-status[data-state="open"],
body.theme-light .sat-status-good {
  color: var(--mg-accent);
  text-shadow: none;
}

.gate-archive-year[open] > summary .gate-archive-disclosure,
.gate-archive-month[open] > summary .gate-archive-disclosure {
  border-color: color-mix(in srgb, var(--mg-signal) 54%, var(--mg-border-glass));
  color: var(--mg-signal);
}

.mg-crt {
  position: relative;
  isolation: isolate;
}

.mg-crt::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
  border-radius: inherit;
  background: repeating-linear-gradient(180deg, rgba(255, 255, 255, var(--mg-scan-op)) 0, rgba(255, 255, 255, var(--mg-scan-op)) 1px, transparent 1px, transparent 4px);
  mix-blend-mode: soft-light;
}

* {
  scrollbar-color: var(--mg-border-strong) transparent;
}
'''

css = css.rstrip() + v2 + '\n'
CSS.write_text(css)

index = INDEX.read_text()
index, removed = re.subn(r'\s*<style>\s*:root\s*\{[\s\S]*?</style>\s*', '\n', index, count=1, flags=re.I)
if removed != 1:
    raise SystemExit('Legacy inline stylesheet was not removed from public/index.html')

index = re.sub(
    r'(<div[^>]*class="[^"]*security-banner-fixed[^"]*")\s+style="background-color: #16a34a; color: white; font-weight: 900; letter-spacing: 0\.1em;"',
    r'\1',
    index,
    count=1,
)

# Remove the inline Processing grid authority so responsive CSS remains canonical.
index = index.replace(' style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); align-content: start;"', '')

interactive_backgrounds = {
    '#16a34a': 'gate-primary-action',
    '#2563eb': 'gate-primary-action',
    'var(--green)': 'gate-primary-action',
    'var(--blue)': 'gate-primary-action',
    '#dc2626': 'gate-danger-action',
}

button_pattern = re.compile(r'<button\b[^>]*style="background:(#16a34a|#2563eb|#dc2626|var\(--green\)|var\(--blue\));?"[^>]*>', re.I)

def normalize_button(match):
    tag = match.group(0)
    value = match.group(1)
    semantic = interactive_backgrounds[value]
    tag = re.sub(r'\s*style="background:[^"]+;?"', '', tag, count=1, flags=re.I)
    class_match = re.search(r'class="([^"]*)"', tag)
    if class_match:
        classes = class_match.group(1)
        if semantic not in classes.split():
            tag = tag[:class_match.start(1)] + semantic + ' ' + classes + tag[class_match.end(1):]
    else:
        tag = tag[:-1] + f' class="{semantic}">'
    return tag

index = button_pattern.sub(normalize_button, index)
INDEX.write_text(index)

version_old = 'military-glass-terminal-20260914'
version_new = 'military-glass-terminal-v2-20260914'
for path in (LOGIN, MIDDLEWARE, BUDGET, STACK):
    text = path.read_text()
    if version_old not in text and path != LOGIN:
        raise SystemExit(f'Expected stylesheet version not found in {path}')
    if path == LOGIN:
        text = text.replace('/css/military-glass-terminal.css"', f'/css/military-glass-terminal.css?v={version_new}"', 1)
    else:
        text = text.replace(version_old, version_new)
    path.write_text(text)

print('Military Glass v2 UI patch applied')
