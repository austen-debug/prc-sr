from pathlib import Path

path = Path('public/css/military-glass-terminal.css')
css = path.read_text()
marker = '/* 15. PRE-CONSOLIDATION RESPONSIVE CONTRACT RESTORATION */'
if marker in css:
    raise SystemExit('Pre-consolidation responsive contracts are already present')

restoration = r'''

/* --------------------------------------------------------------------------
   15. PRE-CONSOLIDATION RESPONSIVE CONTRACT RESTORATION
   These contracts preserve accepted GATE behavior that existed immediately
   before the September 2026 stylesheet consolidation. They remain inside the
   single canonical visual asset; no retired stylesheet is reactivated.
   -------------------------------------------------------------------------- */

@media (any-pointer: coarse) and (min-width: 768px) and (max-width: 1366px) and (min-height: 561px) {
  html {
    overscroll-behavior-x: none;
    overscroll-behavior-y: none;
  }

  body.gate-app-shell-ready[data-gate-active-page='processing'] {
    height: 100dvh;
    min-height: 100dvh;
    max-height: 100dvh;
    overflow-x: hidden;
    overflow-y: hidden;
    overscroll-behavior-x: none;
    overscroll-behavior-y: none;
  }

  .security-banner-fixed,
  .app-nav,
  .app-nav.command-header-bar,
  .command-header-bar {
    position: fixed;
    transform: translate3d(0, 0, 0);
    -webkit-transform: translate3d(0, 0, 0);
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
  }

  body.gate-app-shell-ready[data-gate-active-page='processing'] #page-processing.active {
    display: flex;
    flex-direction: column;
    width: 100%;
    min-width: 0;
    height: 100dvh;
    min-height: 100dvh;
    max-height: 100dvh;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior-x: none;
    overscroll-behavior-y: contain;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-y;
    scroll-padding-top: calc(var(--mg-shell-top) + .75rem);
    scroll-padding-bottom: max(1rem, env(safe-area-inset-bottom));
  }

  body.gate-app-shell-ready[data-gate-active-page='processing'] #page-processing.active > .px-4.py-3.flex-shrink-0 {
    flex: 0 0 auto;
    width: 100%;
    min-width: 0;
  }

  body.gate-app-shell-ready[data-gate-active-page='processing'] #page-processing.active #proc-dorm-grid {
    flex: 1 0 auto;
    width: 100%;
    min-width: 0;
  }

  #gate-mobile-nav-sheet {
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-y;
  }

  #page-processing .proc-card:hover {
    transform: none;
  }

  #dorm-modal.confirm-overlay:not(.hidden) {
    align-items: flex-start;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-top: max(.75rem, env(safe-area-inset-top));
    padding-bottom: max(.75rem, env(safe-area-inset-bottom));
  }

  #dorm-modal .gate-processing-workspace {
    max-height: calc(100dvh - 1rem);
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-gutter: stable;
  }

  #dorm-modal .gate-processing-workspace__header,
  #dorm-modal .gate-processing-workspace__footer {
    position: sticky;
    z-index: 2;
    background: var(--mg-surface-strong);
  }

  #dorm-modal .gate-processing-workspace__header {
    top: 0;
  }

  #dorm-modal .gate-processing-workspace__footer {
    bottom: 0;
  }

  #dorm-modal.confirm-overlay:not(.hidden) .modal-content > .flex.justify-between.items-center.mb-4 > button,
  #dorm-modal .gate-processing-workspace__header button,
  #dorm-modal .gate-processing-workspace__footer button {
    min-width: 44px;
    min-height: 44px;
  }
}

@media (max-height: 800px) and (min-width: 761px) {
  #dorm-modal .gate-processing-workspace {
    gap: .5rem .75rem;
    padding: .72rem;
  }

  #dorm-modal .gate-processing-workspace__header {
    min-height: 3.2rem;
    padding: .48rem .68rem;
  }

  #dorm-modal #modal-dorm-name {
    font-size: clamp(1.7rem, 3vw, 2.2rem);
  }

  #dorm-modal .gate-processing-workspace__assignment,
  #dorm-modal .gate-processing-workspace__phase,
  #dorm-modal .gate-processing-workspace__load {
    padding: .58rem;
  }

  #dorm-modal .phase-btn {
    min-height: 2.3rem;
    padding: .42rem .5rem;
    font-size: .7rem;
  }
}

@media (max-width: 900px), (pointer: coarse) and (max-width: 1024px) {
  #page-airport,
  #page-input,
  #page-processing,
  #page-archives {
    width: 100%;
    max-width: 100vw;
    overflow-x: hidden;
  }

  #page-input > .flex-shrink-0.px-4.py-3,
  #page-input > .flex-shrink-0.border-t {
    padding-left: 0;
    padding-right: 0;
  }

  #page-input > .flex-shrink-0.px-4.py-3 > .flex {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: .75rem;
  }

  #wg-batch-input,
  #init-wg-btn {
    min-height: 46px;
  }

  #init-wg-btn {
    width: 100%;
  }

  #receiving-windows-panel,
  #archive-receiving-windows-panel {
    grid-template-columns: minmax(0, 1fr);
    gap: .625rem;
  }

  #receiving-windows-panel input,
  #archive-receiving-windows-panel input {
    min-height: 44px;
    font-size: .92rem;
  }

  #batch-grid-wrapper {
    padding: .625rem 0;
    overflow-x: auto;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-x: contain;
  }

  #batch-grid-wrapper > div {
    min-width: 860px;
    padding-bottom: .625rem;
  }

  #batch-grid-wrapper .sticky {
    top: 0;
    z-index: 3;
  }

  #batch-rows-container input,
  #batch-rows-container select,
  #batch-rows-container button {
    min-height: 42px;
    font-size: .88rem;
  }

  #page-processing > .px-4.py-3,
  #page-processing > .px-4.py-3.flex-shrink-0 {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: .625rem;
    padding-left: 0;
    padding-right: 0;
  }

  #page-processing > .px-4.py-3 button,
  #page-processing #closeout-btn {
    width: 100%;
    min-height: 48px;
  }

  #page-archives .max-w-3xl {
    width: 100%;
    max-width: none;
  }

  .gate-archive-toolbar,
  .gate-archive-record-card {
    grid-template-columns: minmax(0, 1fr);
  }

  .gate-archive-search-wrap,
  #gate-archive-search,
  .gate-archive-clear-search {
    width: 100%;
  }

  .gate-archive-record-stats {
    justify-content: flex-start;
  }
}

@media (hover: hover) and (pointer: fine) and (min-width: 768px) and (max-width: 1279px) {
  #main-nav-menu.nav-group-left,
  #nav-links.nav-group-left,
  .app-nav .nav-group-left {
    flex-flow: row nowrap;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-gutter: stable;
  }

  #main-nav-menu.nav-group-left > .nav-btn,
  #nav-links.nav-group-left > .nav-btn,
  .app-nav .nav-group-left > .nav-btn {
    flex: 0 0 auto;
  }
}
'''

path.write_text(css.rstrip() + restoration + '\n')
