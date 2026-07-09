# Phase 7C — Phone UI Corrective Patch

Status: Implemented
Scope: Corrects phone menu visibility, removes legacy mobile polish interference, fixes phone metric sizing, and suppresses legacy mini-watermark artifacts inside the Status Board metric/active-bus area.

## Trigger

Phone screenshots showed three active issues after Phase 7 / 7B:

1. The mobile menu was opening an overlay/blur state, but the drawer content was still being forced into an old right-side rail layout.
2. The old small watermark remained visible in the Active Buses card/page area.
3. Metric values on phone were truncated or too small, especially time-based metrics.

## Root cause

`gate-mobile-ui-polish.css` was still imported through `gate-utilities-access.css`. That old imported mobile layer still owned portions of:

- mobile nav shell height
- two-row mobile header layout
- mobile drawer/dropdown positioning
- mobile nav button sizing
- page padding
- board/mobile card scaling

Those rules were conflicting with the canonical `GateAppShell` mobile drawer and watermark ownership.

## Active changes

### Removed legacy mobile import

Updated:

```txt
public/css/gate-utilities-access.css
```

Removed:

```css
@import url('/css/gate-mobile-ui-polish.css');
```

The file remains in the repository for traceability, but it is no longer imported by the active utility stylesheet.

### Added phone corrective layer

Added:

```txt
public/css/gate-mobile-corrective.css
```

This layer is phone/coarse-pointer scoped and loads after the App Shell CSS.

It owns corrective rules for:

- single-row phone nav shell
- visible full-width drawer panel
- drawer scrim without legacy blur
- full-width route buttons
- system controls inside the drawer
- no page blur when menu is open
- phone page padding under the fixed shell
- phone metric grid sizing
- phone metric number sizing
- hiding legacy mini watermarks in active-bus/metric areas
- single-column board/squadron dorm layout

### Runtime change

Middleware now loads:

```html
<link rel="stylesheet" href="/css/gate-utilities-access.css?v=phase-7c-mobile-corrective-20260709">
<link rel="stylesheet" href="/css/gate-mobile-corrective.css?v=phase-7c-mobile-corrective-20260709">
```

`gate-mobile-corrective.css` loads after `gate-app-shell.css` so it has final phone-correction authority.

## What this phase does not change

Phase 7C does not change:

- workflow controllers
- backend record behavior
- role access
- Status Board data source
- bus workflow
- Processing modal behavior
- Input initialization
- Archive closeout/reporting
- desktop shell behavior

## Acceptance criteria

1. Phone menu opens as a full-width drawer below the header, not a right-side rail.
2. Phone menu route buttons are visible and readable.
3. Tapping outside/menu route closes the drawer.
4. Page content is not blurred by legacy mobile CSS when menu is open.
5. Metric values are large and legible on phone.
6. Last Arrival and Local Time no longer truncate to unusable ellipses.
7. Active Buses card no longer shows the old small watermark/logo artifact.
8. Mobile page content remains single-column and does not horizontally scroll.
