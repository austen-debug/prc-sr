# GATE Conflict Removal Plan

Status: Phase Zero baseline
Scope: Documentation only. No runtime behavior changes.

## Purpose

This document identifies the active overlap and conflict areas that must be resolved to make GATE stable, professional, and maintainable. It also defines the order in which conflicts should be removed.

The goal is not to delete files quickly. The goal is to establish one canonical owner per workflow and retire duplicate ownership safely.

## Conflict severity levels

- Critical: causes page routing failure, data loss risk, role-access risk, or major UI duplication.
- High: causes recurring visual regressions, duplicate rendering, mobile/desktop bleed, or workflow instability.
- Medium: causes maintenance confusion or future regression risk.
- Low: inactive or cosmetic legacy files that can be cleaned later.

## Critical conflicts

### 1. Navigation / routing / mobile shell

Files involved:

- `public/index.html`
- `public/js/prc-dash-final-audit.js`
- `public/js/gate-access-control-controller.js`
- `public/js/gate-mobile-nav-routing-fix.js`
- `public/js/gate-mobile-shell-redesign.js`
- `public/js/gate-mobile-app-shell-finalizer.js`
- `public/js/gate-desktop-nav-restore.js`

Symptoms observed:

- Mobile menu routing failures.
- Desktop nav affected by mobile changes.
- Inactive pages visible underneath active pages.
- Multiple files patch `showPage` and/or `buildNav`.

Required end state:

- One router.
- One navigation renderer.
- One responsive shell controller.
- One permissions service.
- No desktop restoration guard needed because mobile shell never mutates desktop.

Removal path:

1. Create canonical `AppShellRouter` and `ResponsiveShell`.
2. Move role page matrix into `Permissions`.
3. Replace base `showPage` with router source.
4. Replace base `buildNav` with nav component source.
5. Remove navigation patching from `prc-dash-final-audit.js`.
6. Remove `gate-mobile-nav-routing-fix.js`.
7. Remove `gate-mobile-app-shell-finalizer.js`.
8. Remove `gate-desktop-nav-restore.js`.
9. Keep `gate-mobile-shell-redesign.js` only if it is converted into the canonical responsive shell; otherwise retire it.

Acceptance criteria:

- Desktop nav unchanged by phone behavior.
- Mobile drawer routes correctly.
- Airman/Squadron/Instructor page access works.
- No inactive page is visible under another page.
- No controller patches `showPage` except the canonical router during transition.

### 2. Status Board metric duplication

Files involved:

- `public/index.html`
- `public/js/prc-dash-board-header.js`
- `public/js/gate-premium-metrics-controller.js`
- `public/css/gate-premium-metrics.css`

Symptoms observed:

- Duplicate metric cards appeared on Status Board.
- Old metric IDs are still written by base render logic.
- Compatibility sinks are now required.

Required end state:

- One source metric container.
- Four direct IDs: `stat-arrived`, `stat-expected`, `stat-last`, `stat-local`.
- No visible legacy metric blocks.
- No v3 board-header metric generation.

Removal path:

1. Keep current `gate-premium-metrics-controller.js` as temporary canonical visible owner.
2. Refactor `index.html` or future `StatusBoardPage` so it renders `gate-metrics-container` directly.
3. Update base render logic to write to `stat-*` IDs.
4. Remove compatibility sinks for `metric-arrived` and `metric-airport`.
5. Delete or retire `prc-dash-board-header.js` after no v3 metric output remains.
6. Keep `gate-premium-metrics.css` only as component CSS or migrate it to `components.css`.

Acceptance criteria:

- Only one metric row exists.
- No old ARRIVED/EXPECTED compound source block is visible.
- No hidden duplicate card grid is created.
- Metrics update every live data refresh.

### 3. Processing modal ownership

Files involved:

- `public/index.html`
- `public/js/prc-dash-processing-context-menu.js`
- `public/js/gate-processing-final-time-commit.js`
- `public/js/gate-airman-modal-close-safety.js`
- `public/js/gate-tablet-processing-modal-fix.js`
- `public/js/prc-dash-modal-mobile-validation.js`

Symptoms observed:

- Airman modal close caused logout/crash.
- Tablet Airman modal could not scroll to bottom/save.
- Final Time correction did not consistently update Status Board and Processing.
- Instructor right-click actions and modal save path are split across files.

Required end state:

- One `ProcessingPage`.
- One `ProcessingDormModal`.
- One instructor context menu.
- One final-time update path.
- One responsive modal contract.

Removal path:

1. Create `ProcessingPage` source module.
2. Move card rendering from base `index.html` into Processing module.
3. Move dorm modal open/update/close into Processing module.
4. Integrate Airman close safety into modal component, not a separate patch.
5. Integrate tablet/mobile scroll rules into modal CSS.
6. Integrate final-time commit into Processing workflow.
7. Retire `gate-processing-final-time-commit.js`, `gate-airman-modal-close-safety.js`, and tablet/modal patch files after migration.

Acceptance criteria:

- Airman can open/close modal without logout.
- Instructor can edit final time and see Status Board update.
- Tablet save buttons are reachable.
- Mobile modal scroll is clean.
- Right-click is instructor-only.

## High conflicts

### 4. Airport and local bus workflow

Files involved:

- `public/index.html`
- `public/js/gate-bus-workflow-controller.js`
- `public/js/gate-airport-phone-layout-fix.js`
- `public/js/prc-dash-modal-mobile-validation.js`

Risk:

- Duplicate form handlers may exist.
- Mobile Airport page depends on hardening asset.

Required end state:

- One `AirportPage` and one `AirportWorkflow`.
- One form submit path.
- One bus log renderer.
- One responsive form layout.

Removal path:

1. Source-own airport form.
2. Remove base airport/local listeners from `index.html`.
3. Move mobile form layout into page/component CSS.
4. Keep `gate-bus-workflow-controller.js` until source migration is complete.

### 5. Input page and week-group initialization

Files involved:

- `public/index.html`
- `public/js/gate-input-page-controller.js`
- old inactive receiving-window files if present

Risk:

- Batch grid and initialization are patched instead of source-owned.

Required end state:

- One week group initializer.
- One batch grid component.
- One receiving window component.

Removal path:

1. Move batch row state out of globals.
2. Source-own initialize workflow.
3. Remove patches around `initializeWeekGroup` and `dataSdk.create/update`.

### 6. Archive and reporting

Files involved:

- `public/index.html`
- `public/js/gate-ui-hooks.js`
- `public/js/prc-dash-archive-actions.js`
- `public/js/prc-dash-archive-print-cleanup.js`
- `public/js/gate-archive-print-controller.js`
- `public/js/prc-dash-current-summary-live-records.js`

Risk:

- Archive safety logic is valuable but mixed with UI hooks.
- Print ownership is split.

Required end state:

- One `ArchiveService`.
- One archive page.
- One print/report module.

Removal path:

1. Preserve current closeout verification logic.
2. Move archive schema creation into service.
3. Move print/PDF/current summary into report module.
4. Retire cleanup and compatibility files after source migration.

## Medium conflicts

### 7. CSS cascade and visual ownership

Files involved:

- `public/index.html` inline CSS
- `gate-index-legacy-shell.css`
- `gate-base-tokens.css`
- `gate-layout-pages.css`
- `gate-components.css`
- `gate-utilities-access.css`
- imported CSS layers
- `gate-premium-metrics.css`
- script-injected styles

Risk:

- Styling conflicts are difficult to predict.
- `!important` is frequently required to win.

Required end state:

- Token layer.
- Base layer.
- Layout layer.
- Component layer.
- Page layer.
- Responsive layer.
- Print layer.

Removal path:

1. Inventory all active selectors.
2. Move inline CSS out of `index.html`.
3. Remove inactive PRC-era CSS files after confirming they are not injected.
4. Consolidate mobile style patches.

### 8. Render loops and observers

Files involved:

- multiple active controllers with `MutationObserver`
- multiple active controllers with resize/click/input listeners
- timer intervals in base and active controllers

Risk:

- UI refreshes can cascade.
- Mouse movement / mutation-driven schedules can create unnecessary repaints.

Required end state:

- One render scheduler.
- Store-driven targeted renders.
- Timer-only updates for timers.
- No broad mutation observers except for migration fallback.

## Safe handling rules

1. Do not delete active files until the canonical replacement is committed and tested.
2. Do not remove compatibility sinks until old source references are removed.
3. Do not alter backend record normalization without explicit test plan.
4. Do not consolidate mobile shell and navigation in the same commit as a page workflow refactor.
5. Prefer small consolidation phases over large rewrites.

## Recommended removal order

1. Navigation / app shell / mobile shell.
2. Status Board metrics and board header.
3. Status Board dorm rendering.
4. Processing page and modal.
5. Airport/local bus workflow.
6. Input page and week group initialization.
7. Archive/reporting.
8. CSS design system consolidation.
9. Delete inactive legacy files.

## Phase Zero conclusion

The highest leverage next phase is Navigation / App Shell / Mobile Shell consolidation. It affects every page and is the current source of the most severe cross-platform regressions.
