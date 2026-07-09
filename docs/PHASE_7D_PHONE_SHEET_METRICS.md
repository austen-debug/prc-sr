# Phase 7D — Phone Sheet Menu and Metric Correction

Status: Implemented
Scope: Adds a fail-safe phone navigation sheet, reduces phone metric clipping, and pushes the mobile board watermark into the background.

## Trigger

A phone screenshot after Phase 7C showed the following:

- menu still appeared closed / non-functional from the phone surface
- Arrived / Expected metrics were readable, but time metrics were still clipped
- metric labels were still over-truncated
- the board watermark was centered but too visible through the content

## Active implementation

### App Shell controller

Updated:

```txt
public/js/gate-app-shell-controller.js
```

The App Shell now creates a separate fail-safe phone sheet:

```txt
#gate-mobile-nav-sheet
#gate-mobile-sheet-routes
#gate-mobile-sheet-system-controls
```

This is independent of the older inline `#main-nav-menu` so the phone menu no longer depends on legacy nav/dropdown positioning rules. The old inline nav remains for compatibility, but the visible phone navigation is now the sheet.

### Phone CSS

Updated:

```txt
public/css/gate-mobile-corrective.css
```

The phone corrective layer now:

- hides the legacy inline nav menu on phone
- shows `#gate-mobile-nav-sheet` when the drawer is open
- places route buttons and system controls inside the sheet
- keeps the sheet fixed below the UNCLASS/header row
- reduces time metric font size so `01:42` / `12:03` fit better
- reduces label letter-spacing and font size to prevent excessive truncation
- lowers mobile watermark opacity to keep it behind the board

### Runtime cache bust

Middleware now loads:

```html
<link rel="stylesheet" href="/css/gate-app-shell.css?v=phase-7d-mobile-sheet-20260709">
<link rel="stylesheet" href="/css/gate-mobile-corrective.css?v=phase-7d-mobile-sheet-20260709">
<script src="/js/gate-app-shell-controller.js?v=phase-7d-mobile-sheet-20260709" defer></script>
```

## What this phase does not change

Phase 7D does not change:

- workflow controllers
- record behavior
- backend API
- Status Board data source
- Airport/local bus workflow
- Processing workflow
- Input initialization
- Archive closeout/reporting
- desktop layout

## Acceptance criteria

1. Phone Menu opens a visible sheet below the header.
2. Route buttons are visible inside the sheet.
3. System controls are visible inside the sheet.
4. Route button tap changes pages and closes the sheet.
5. Tapping outside closes the sheet.
6. Time metrics are no longer cut off at the right edge.
7. Metric labels are less aggressively clipped.
8. The board watermark is faint enough that it does not interfere with content.
