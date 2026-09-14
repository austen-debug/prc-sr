from pathlib import Path
import re

CSS = Path('public/css/military-glass-terminal.css')
css = CSS.read_text()

body_before = re.compile(
    r"body::before\s*\{[\s\S]*?\}\n\nbody\.theme-light::before\s*\{[\s\S]*?\}\n",
    re.M,
)
replacement = '''body::before {
  content: none;
  display: none;
}

body.gate-app-shell-ready.gate-watermark-page::after {
  content: "";
  position: fixed;
  left: 50vw;
  top: 52vh;
  z-index: var(--mg-z-base);
  width: min(64vw, 980px);
  height: min(64vw, 980px);
  pointer-events: none;
  background: url('/assets/gate_emblem_white.png') center / contain no-repeat;
  opacity: .06;
  filter: grayscale(1);
  transform: translate3d(-50%, -50%, 0);
}

body.theme-light.gate-app-shell-ready.gate-watermark-page::after {
  background-image: url('/assets/gate_emblem_blue.png');
  opacity: .035;
  filter: grayscale(.35) saturate(.55);
}

body.gate-app-shell-ready.gate-watermark-processing::after {
  width: min(56vw, 820px);
  height: min(56vw, 820px);
  opacity: .045;
}

body.theme-light.gate-app-shell-ready.gate-watermark-processing::after {
  opacity: .025;
}
'''
css, count = body_before.subn(replacement, css, count=1)
if count != 1:
    raise SystemExit('Could not replace global grid background contract')

generic = '''#role-toggle,
#fullscreen-btn,
#sound-toggle-btn,
#theme-toggle-btn,
#week-group-display,
#mobile-menu-trigger {'''
fixed = '''#role-toggle,
#fullscreen-btn,
#sound-toggle-btn,
#theme-toggle-btn,
#week-group-display {'''
if generic not in css:
    raise SystemExit('Mobile trigger generic selector contract not found')
css = css.replace(generic, fixed, 1)

old_hide = '''#mobile-menu-trigger,
.gate-shell-system-panel,
.gate-shell-system-controls,
#gate-mobile-menu-scrim {
  display: none;
}'''
new_hide = '''#mobile-menu-trigger,
#gate-mobile-nav-sheet,
#gate-mobile-menu-scrim,
.gate-shell-system-panel,
.gate-shell-system-controls {
  display: none;
  visibility: hidden;
  pointer-events: none;
}'''
if old_hide not in css:
    raise SystemExit('Default mobile artifact hide contract not found')
css = css.replace(old_hide, new_hide, 1)

start = css.index('@media (max-width: 767px) {')
end = css.index('@media (max-height: 560px)', start)
phone = css[start:end]

legacy_menu = re.compile(
    r'''  body\.gate-app-shell-ready #main-nav-menu,\n  body\.gate-app-shell-ready #nav-links,\n  body\.gate-app-shell-ready \.nav-group-left \{[\s\S]*?  body\.gate-app-shell-ready \.nav-group-left \.nav-btn \{[\s\S]*?  \}\n'''
)
canonical_menu = '''  body.gate-app-shell-ready #main-nav-menu,
  body.gate-app-shell-ready #nav-links,
  body.gate-app-shell-ready .nav-group-left {
    display: none;
    visibility: hidden;
    pointer-events: none;
  }

  body.gate-app-shell-ready #gate-mobile-nav-sheet {
    position: fixed;
    top: calc(var(--mg-shell-top) + .5rem);
    left: max(.75rem, env(safe-area-inset-left));
    right: max(.75rem, env(safe-area-inset-right));
    z-index: var(--mg-z-popover);
    display: none;
    grid-template-columns: minmax(0, 1fr);
    gap: .6rem;
    max-height: calc(100dvh - var(--mg-shell-top) - 1.5rem - env(safe-area-inset-bottom));
    padding: .7rem;
    overflow-x: hidden;
    overflow-y: auto;
    scrollbar-gutter: stable;
    border: 1px solid var(--mg-border-strong);
    border-radius: var(--mg-radius-lg);
    background: var(--mg-surface-strong);
    box-shadow: var(--mg-shadow-strong);
    backdrop-filter: blur(18px) saturate(125%);
    -webkit-backdrop-filter: blur(18px) saturate(125%);
    visibility: hidden;
    pointer-events: none;
  }

  body.gate-app-shell-ready.gate-mobile-drawer-open #gate-mobile-nav-sheet,
  body.gate-app-shell-ready #gate-mobile-nav-sheet.gate-mobile-sheet-open {
    display: grid;
    visibility: visible;
    pointer-events: auto;
  }

  body.gate-app-shell-ready #gate-mobile-nav-sheet .gate-mobile-sheet-title,
  body.gate-app-shell-ready #gate-mobile-nav-sheet .gate-shell-system-label {
    color: var(--mg-text-muted);
    font-size: .66rem;
    font-weight: 900;
    letter-spacing: .12em;
    text-transform: uppercase;
  }

  body.gate-app-shell-ready #gate-mobile-nav-sheet .gate-mobile-sheet-routes,
  body.gate-app-shell-ready #gate-mobile-nav-sheet .gate-shell-system-controls,
  body.gate-app-shell-ready #gate-mobile-nav-sheet .gate-mobile-sheet-system {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: .5rem;
    width: 100%;
    min-width: 0;
  }

  body.gate-app-shell-ready #gate-mobile-nav-sheet .gate-mobile-sheet-system {
    margin-top: .2rem;
    padding-top: .65rem;
    border-top: 1px solid var(--mg-border-soft);
  }

  body.gate-app-shell-ready #gate-mobile-nav-sheet .nav-btn,
  body.gate-app-shell-ready #gate-mobile-nav-sheet .gate-component-nav-button,
  body.gate-app-shell-ready #gate-mobile-nav-sheet button {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    width: 100%;
    min-width: 0;
    min-height: 48px;
    padding: 0 .9rem;
    text-align: left;
  }
'''
phone, count = legacy_menu.subn(canonical_menu, phone, count=1)
if count != 1:
    raise SystemExit('Could not replace phone legacy nav overlay')

old_mobile_grid = '''  body::before {
    inset: var(--mg-shell-top) 0 0;
    background-size: 28px 28px, 28px 28px, min(82vw, 520px) auto;
    opacity: .09;
  }

'''
mobile_watermark = '''  body.gate-app-shell-ready.gate-watermark-page::after {
    top: 58vh;
    width: min(86vw, 520px);
    height: min(86vw, 520px);
    opacity: .018;
  }

  body.theme-light.gate-app-shell-ready.gate-watermark-page::after {
    opacity: .014;
  }

'''
if old_mobile_grid not in phone:
    raise SystemExit('Mobile grid contract not found')
phone = phone.replace(old_mobile_grid, mobile_watermark, 1)

airport_contract = '''
  #page-airport.active {
    overflow-x: hidden;
    overflow-y: auto;
  }

  #page-airport .max-w-3xl,
  #page-airport #airport-form,
  #page-airport #airport-form > * {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
  }

  #page-airport #airport-form {
    display: block;
    overflow: visible;
    padding: 1rem;
  }

  #page-airport #airport-form > * {
    display: block;
    margin-bottom: .85rem;
  }

  #page-airport #airport-form input,
  #page-airport #airport-form button[type="submit"] {
    display: block;
    width: 100%;
    max-width: 100%;
    min-height: 48px;
    font-size: 16px;
  }

  #page-airport .surface:has(#airport-bus-log-body) {
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
  }

  #page-airport .surface:has(#airport-bus-log-body) table {
    width: max-content;
    min-width: 760px;
  }
'''
insert_before = '  .sat-arrivals-board {'
if insert_before not in phone:
    raise SystemExit('Phone Airport insertion point not found')
phone = phone.replace(insert_before, airport_contract + '\n' + insert_before, 1)

processing_back = '''
  #dorm-modal.confirm-overlay:not(.hidden) .modal-content > .flex.justify-between.items-center.mb-4 > button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: auto;
    min-width: 52px;
    min-height: 44px;
    padding: 0 .78rem;
    border: 1px solid var(--mg-border-glass);
    border-radius: var(--mg-radius-pill);
    background: var(--mg-surface-soft);
    color: transparent;
    font-size: 0;
  }

  #dorm-modal.confirm-overlay:not(.hidden) .modal-content > .flex.justify-between.items-center.mb-4 > button::before {
    content: "BACK";
    color: var(--mg-text);
    font-size: .76rem;
    font-weight: 900;
    letter-spacing: .08em;
  }
'''
modal_insert = '  #dorm-modal .gate-processing-workspace {'
if modal_insert not in phone:
    raise SystemExit('Phone Processing modal insertion point not found')
phone = phone.replace(modal_insert, processing_back + '\n' + modal_insert, 1)

css = css[:start] + phone + css[end:]
CSS.write_text(css)

for wf_name in [
    '.github/workflows/runtime-record-integrity-tests.yml',
    '.github/workflows/build-2-audit-remediation-gate-1.yml',
]:
    path = Path(wf_name)
    text = path.read_text()
    text = re.sub(
        r"\n\s+- 'public/css/(?:gate-utilities-access|gate-premium-metrics|gate-ui-ownership-correction|gate-fullscreen-board-contract)\.css'",
        '',
        text,
    )
    marker = "      - 'functions/_middleware.js'"
    if 'public/css/military-glass-terminal.css' not in text:
        text = text.replace(marker, marker + "\n      - 'public/css/military-glass-terminal.css'", 2)
    path.write_text(text)
