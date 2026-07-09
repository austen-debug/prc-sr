# Phase 1A — Navigation / App Shell / Mobile Shell Consolidation

Status: Implemented baseline
Scope: App shell, routing, role-aware navigation, mobile drawer, and page isolation.

## Objective

Phase 1A consolidates the highest-risk cross-cutting UI layer: navigation, routing, role-aware page access, mobile drawer behavior, and page isolation.

This phase does not change:

- record persistence
- Airport bus workflow
- local arrival workflow
- Input initialization workflow
- Processing record updates
- Archive closeout behavior
- Status Board dorm rendering
- Premium metric data logic

## Why this phase was first

Phase Zero identified navigation / app shell / mobile shell as the highest-risk conflict area. It affected every page and had already caused visible regressions:

- mobile menu routing errors
- desktop navigation affected by mobile fixes
- inactive pages visible beneath active pages
- multiple files patching `showPage` and `buildNav`

## Files added

### `public/js/gate-app-shell-controller.js`

Canonical owner for:

- `showPage`
- `buildNav`
- role-aware nav rendering
- page isolation
- mobile drawer state
- system control movement between desktop header and mobile drawer
- Week Group chip display

Exports:

```js
window.GateAppShell = {
  isCanonicalOwner: true,
  go,
  renderNav,
  allowedPages,
  pageIsAllowed,
  currentPage,
  setDrawer,
  sync
}
```

### `public/css/gate-app-shell.css`

Canonical presentation layer for:

- desktop command shell nav behavior
- phone/compact mobile shell
- mobile drawer display
- page active/inactive isolation
- system control drawer section
- Week Group chip sizing

### `public/js/gate-permission-guard.js`

Permission/action guard only. It does not own routing or nav rendering.

Responsible for:

- instructor-only function protection
- instructor-only form protection
- Airman allowed local arrival form
- Squadron limited page interaction
- non-instructor right-click protection
- body role state
- redirecting invalid active page back through `GateAppShell` when needed

## Files removed from active runtime

The following files remain in the repo for traceability but are no longer loaded by middleware:

- `public/js/prc-dash-access-control-validation.js`
- `public/js/gate-mobile-nav-routing-fix.js`
- `public/js/gate-mobile-shell-redesign.js`
- `public/js/gate-mobile-app-shell-finalizer.js`
- `public/js/gate-desktop-nav-restore.js`

## Active runtime change

The middleware now loads:

```html
<link rel="stylesheet" href="/css/gate-app-shell.css?v=phase-1a-app-shell-20260709">
<script src="/js/gate-permission-guard.js?v=phase-1a-permission-guard-20260709" defer></script>
<script src="/js/gate-app-shell-controller.js?v=phase-1a-app-shell-20260709" defer></script>
```

## Role page matrix

```js
{
  instructor: ['board', 'airport', 'input', 'processing', 'archives', 'squadron'],
  airman: ['board', 'processing'],
  squadron: ['squadron']
}
```

## Design behavior

### Desktop

- Horizontal command-center navigation remains the desktop contract.
- Mobile drawer controls are not shown as desktop controls.
- System controls remain in the right-side header group.

### Phone / constrained mobile

- Header is reduced to operational shell.
- Week Group becomes the primary state chip.
- Menu button opens the navigation drawer.
- Page navigation and system controls live in the drawer.
- The body must not horizontally scroll because of shell controls.

### Page isolation

All `.page` elements now receive a single route state from the app shell:

- active page: visible and interactive
- inactive pages: hidden and non-interactive

## Acceptance criteria

Must pass before Phase 1B:

1. Instructor desktop nav displays:
   - Status Board
   - Airport
   - Input
   - Processing
   - Archives
   - Squadron Board

2. Airman nav displays:
   - Status Board
   - Processing

3. Squadron nav displays:
   - Squadron Board

4. Mobile menu:
   - opens once
   - closes once
   - routes to selected page
   - closes after route
   - does not send every tap to Airport

5. Desktop:
   - no mobile Menu trigger visible
   - Sound / Full Screen / Theme / Logout remain in desktop header
   - nav spacing remains horizontal and professional

6. Page isolation:
   - Airport page cannot appear under Squadron Board
   - inactive pages cannot be clicked underneath the active page

7. Permission guard:
   - Airman cannot submit Airport/Input/Archive forms
   - Airman can still use allowed local arrival workflow
   - Squadron cannot interact outside Squadron Board

## Known remaining risks

- `prc-dash-final-audit.js` still contains older navigation patch code, but `GateAppShell` is loaded after it and overwrites `showPage` / `buildNav` as the final active owner.
- `public/index.html` still contains base `showPage` and `buildNav`; these are now compatibility roots and should be removed in a later source-level refactor.
- Mobile modal and Airport phone layout are still handled by separate files and should be consolidated in later phases.

## Next recommended phase

Proceed to Phase 1B — Status Board metrics and board header ownership.

Phase 1B should remove the remaining legacy metric compatibility sinks by updating the source render path to target `stat-arrived`, `stat-expected`, `stat-last`, and `stat-local` directly.
