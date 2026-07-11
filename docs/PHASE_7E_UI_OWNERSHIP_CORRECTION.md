# Phase 7E — UI Ownership Correction

Status: Implemented
Scope: Corrects UI ownership conflicts discovered during the pre-progression UI check. This is not a visual redesign pass.

## Trigger

The UI check before further Phase 7 work found two confirmed defects:

1. Phone navigation sheet artifacts were visible on desktop because `#gate-mobile-nav-sheet` was created globally but only styled inside phone media queries.
2. Watermark ownership remained conflicted between legacy body watermark CSS, page-level watermark CSS, and the broad `prc-dash-modal-mobile-validation.js` runtime CSS injection.

## Objective

Establish clean ownership boundaries before additional polish.

## Active changes

### 1. Narrowed modal/touch validation helper

Updated:

```txt
public/js/prc-dash-modal-mobile-validation.js
```

It now owns only:

- `gate-modal-open` body state
- `gate-touch-access-mode` body state
- Processing card long-press context-menu dispatch for instructor touch devices
- modal/touch state refresh on modal/page/resize events

It no longer owns:

- board CSS
- watermark CSS
- fullscreen board CSS
- Airport page mobile layout CSS
- dorm modal visual CSS
- active-bus card CSS
- broad runtime style injection
- navigation/menu behavior

The exposed diagnostic object is:

```js
window.GateModalTouchValidation = {
  isNarrowed: true,
  ownsWatermark: false,
  ownsAirportLayout: false,
  ownsNavigation: false,
  refresh: schedulePass
}
```

### 2. Added final UI ownership correction CSS

Added:

```txt
public/css/gate-ui-ownership-correction.css
```

This file is final authority for:

- hiding phone-only sheet/scrim artifacts outside mobile drawer state
- desktop guard against accidental phone sheet display
- suppressing legacy `body::before` app watermark
- ensuring page-level watermarks are centered, fixed, behind content, and visible on board-style pages

### 3. Runtime cache bust

Middleware now loads:

```html
<link rel="stylesheet" href="/css/gate-ui-ownership-correction.css?v=phase-7e-ui-ownership-20260709">
<script src="/js/prc-dash-modal-mobile-validation.js?v=phase-7e-ui-ownership-20260709" defer></script>
```

## Ownership after Phase 7E

### Navigation / page state

Owner:

```txt
GateAppShell
```

No other active UI patch should own route state, `.page.active`, or mobile menu display.

### Phone sheet visibility

Owner:

```txt
gate-ui-ownership-correction.css + GateAppShell state classes
```

The sheet is hidden by default and only visible when `gate-mobile-drawer-open` or `gate-mobile-sheet-open` is active in a phone/coarse-pointer context.

### Watermark

Owners by viewport:

```txt
Desktop/tablet: gate-ui-ownership-correction.css final page-level rules, supported by render-stability style guard.
Phone: gate-app-shell.css / gate-mobile-corrective.css page-level rules, bounded by gate-ui-ownership-correction.css.
```

Legacy `body::before` watermark is suppressed on app pages.

## What this phase does not change

Phase 7E does not change:

- backend records
- workflow controllers
- Status Board data rendering
- Processing logic
- Airport/local bus logic
- Input initialization
- Archive closeout/reporting
- role permissions

## Acceptance criteria

1. No phone navigation sheet or mobile controls appear at the bottom/right on desktop.
2. `#gate-mobile-nav-sheet` is hidden by default globally.
3. `#gate-mobile-nav-sheet` only displays on mobile when the drawer state is open.
4. `prc-dash-modal-mobile-validation.js` no longer injects broad CSS.
5. `prc-dash-modal-mobile-validation.js` no longer hides board watermarks.
6. Legacy body watermark is suppressed on app pages.
7. Board/Processing/Squadron page watermarks are page-level, centered, and behind content.
8. Workflow behavior remains unchanged.

## Next required validation

Before more polish work, validate on:

- desktop normal browser
- desktop fullscreen/status board use
- phone Safari
- tablet/iPad if available

Known areas to inspect:

- desktop bottom-right artifacts
- board watermark at top of page and after scrolling
- phone menu sheet
- Processing modal touch/long-press behavior
- Airport phone layout
