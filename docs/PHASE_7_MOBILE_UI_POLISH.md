# Phase 7 — Mobile / UI Polish and Final Design System Stabilization

Status: Implemented baseline
Scope: Phone/mobile app shell drawer repair, mobile menu accessibility, mobile drawer backdrop, synthetic touch/click hardening, mobile watermark correction, and mobile overflow stabilization.

## Objective

Phase 7 begins the UI/mobile stabilization pass after workflow ownership consolidation.

The first confirmed mobile defects were:

- mobile dropdown menu was corrupt / inaccessible
- mobile background watermark was too small and offset to the right
- mobile UI required polish without changing desktop/tablet workflows

This phase fixes those issues in the canonical App Shell layer instead of reintroducing the old removed mobile patch controllers.

## Active files changed

```txt
public/js/gate-app-shell-controller.js
public/css/gate-app-shell.css
functions/_middleware.js
docs/PHASE_7_MOBILE_UI_POLISH.md
docs/ACTIVE_RUNTIME_STACK.md
```

## Runtime change

Middleware now loads the App Shell assets with Phase 7 cache-busting:

```html
<link rel="stylesheet" href="/css/gate-app-shell.css?v=phase-7-mobile-shell-20260709">
<script src="/js/gate-app-shell-controller.js?v=phase-7-mobile-shell-20260709" defer></script>
```

## Mobile drawer behavior

`GateAppShell` now includes a hardened mobile drawer path:

- creates and owns `#gate-mobile-menu-scrim`
- toggles `gate-mobile-drawer-open` on the body
- toggles `mobile-dropdown-active` on `#main-nav-menu`
- updates `aria-expanded` on `#mobile-menu-trigger`
- updates `aria-hidden` on the mobile menu and scrim
- supports pointer/touch interaction through `pointerup`
- suppresses duplicate synthetic clicks after touch/pointer activation
- closes the drawer on outside tap, scrim tap, Escape, or route selection

## Mobile drawer CSS

The drawer CSS now:

- positions the drawer below the UNCLASS banner and mobile nav row
- constrains drawer width to safe-area padding
- provides an explicit fixed backdrop/scrim
- uses a high z-index boundary below the drawer and above page content
- improves dark/light drawer backgrounds
- keeps system controls inside the drawer
- prevents horizontal overflow
- keeps drawer buttons full-width, readable, and touch-sized

## Mobile watermark correction

The mobile watermark is now owned by `gate-app-shell.css` for board-style pages.

Mobile pages covered:

- Status Board
- Processing
- Squadron Board

The watermark now:

- uses fixed center positioning
- uses `left: 50%` and `transform: translate3d(-50%, -50%, 0)`
- scales with viewport width instead of legacy desktop values
- uses separate dark/light image assets
- keeps content above the watermark with `z-index: 1`
- disables body-level legacy pseudo watermarks on mobile

## What this phase does not change

Phase 7 does not change:

- backend record schema
- role permissions
- Status Board data rendering
- Processing workflow
- Airport/local bus workflow
- Input initialization
- Archive closeout or reporting
- desktop nav layout
- tablet Processing modal reachability

## Acceptance criteria

Must pass on phone before deeper UI polish continues:

1. Mobile top bar shows UNCLASS banner, Week Group chip, and Menu button.
2. Tapping Menu opens the drawer once.
3. Tapping Menu again closes the drawer.
4. Tapping outside the drawer closes it.
5. Tapping a page route changes pages and closes the drawer.
6. Synthetic touch/click duplication does not immediately reopen or close the drawer unexpectedly.
7. System controls remain inside the drawer on phone.
8. Desktop nav remains unchanged.
9. Mobile Status Board watermark is centered and appropriately scaled.
10. Mobile Processing watermark is centered and appropriately scaled.
11. Mobile page content remains above the watermark.
12. No horizontal body scroll appears on phone.

## Known remaining work

This is the first Phase 7 pass. Remaining mobile/UI polish should continue with:

- Airport page mobile form/card polish
- Processing modal visual polish after functionality validation
- Archives page mobile card polish
- Input batch grid mobile handling
- final desktop visual regression check
- eventual fold-down/removal of page-specific mobile patch files once App Shell fully owns their behavior
