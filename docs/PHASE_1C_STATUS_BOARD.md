# Phase 1C — Status Board Dorm Cards and Active Bus Panel Ownership

Status: Implemented baseline
Scope: Status Board dorm columns, Status Board dorm card rendering, Active Buses En Route panel, board timer text refresh boundary, and documentation.

## Objective

Phase 1C consolidates the Status Board body rendering so one active controller owns:

- Status Board dorm columns
- Status Board dorm card markup handoff
- Active Buses En Route panel rendering
- board-specific timer text refresh

This phase does not change:

- Airport bus creation
- airport/local bus record persistence
- confirm bus arrival workflow
- Processing record updates
- Input initialization
- Archive closeout
- backend records API
- Squadron Board role/visibility contract

## Why this phase was needed

Before Phase 1C, Status Board dorm and active bus ownership was split:

- `public/index.html` still called `renderDormColumns()` and wrote simple active bus badge markup.
- `public/js/prc-dash-final-audit.js` patched dorm-column rendering while also owning Squadron Board, navigation support, and close-dorm safety.
- `public/js/gate-ui-hooks.js` installed `GateActiveBusController`, wrapping render behavior for active buses.
- `public/js/gate-component-contracts.js` supplied shared card markup.

That worked, but it was not a clean ownership model.

## Active implementation

### New canonical owner

Added:

```txt
public/js/gate-status-board-controller.js
```

It is now loaded after `prc-dash-final-audit.js` and before page-specific validation/processing controllers.

The controller owns:

- `GateStatusBoardController`
- board dorm column rendering
- board dorm card rendering handoff through `GateComponents.dormCard`
- active bus panel rendering handoff through `GateComponents.activeBusCard`
- legacy `renderDormColumns` / `buildBoardDormCard` compatibility functions
- board-local timer text updates

### Compatibility handoffs

The controller patches the legacy global functions used by the monolithic `renderAll()` path:

```js
window.buildBoardDormCard = gateStatusBoardDormCard;
window.renderDormColumns = gateStatusBoardDormColumns;
```

This means base `renderAll()` can continue calling those names, but the Status Board controller owns the actual rendering.

### Active buses

The new Status Board controller owns `#active-buses` and exposes a compatibility handoff through `window.GateActiveBusController`.

`GateActiveBusController` now points to the new owner and is marked as a handoff object:

```js
window.GateActiveBusController = {
  isCanonicalOwner: false,
  handoffOwner: 'gate-status-board-controller',
  render,
  scheduleRender,
  getActiveBuses
}
```

### Dorm Board compatibility file narrowed

`public/js/prc-dash-final-audit.js` was narrowed. It no longer owns:

- Status Board dorm columns
- active bus rendering
- navigation patching
- mobile menu behavior

It now preserves:

- document identity support
- Squadron Board creation and rendering
- close-dorm final-time safety
- Processing modal component contract handoff
- compatibility `GateDormBoardController` API for existing callers

## Files changed

- `public/js/gate-status-board-controller.js`
- `public/js/prc-dash-final-audit.js`
- `functions/_middleware.js`
- `docs/PHASE_1C_STATUS_BOARD.md`
- `docs/ACTIVE_RUNTIME_STACK.md`

## Active runtime change

Middleware now loads:

```html
<script src="/js/prc-dash-final-audit.js" defer></script>
<script src="/js/gate-status-board-controller.js?v=phase-1c-status-board-20260709" defer></script>
```

The ordering is intentional:

1. `prc-dash-final-audit.js` preserves Squadron Board and close-dorm safety.
2. `gate-status-board-controller.js` becomes the final active owner for Status Board body rendering.

## Acceptance criteria

Must pass before Phase 2:

1. Status Board Empty/Open/Closed columns render correctly.
2. Dorm cards show female, Band, Space Force, phase, timer, load, and auditorium/location indicators as before.
3. Dorm cards do not duplicate.
4. Active Buses En Route uses the canonical active bus card format.
5. Active bus cards still confirm arrival when clicked.
6. Board timer text updates without rebuilding the whole board every second.
7. Squadron Board still appears and remains read-only/limited.
8. Close Dorm still records a stable final time.
9. App Shell navigation remains controlled by `GateAppShell`, not the dorm board file.

## Known remaining risks

- `public/js/gate-ui-hooks.js` still contains the older active bus installer. The new Status Board controller loads later and overwrites the public `GateActiveBusController` handoff, so the visible final owner is the Phase 1C controller. A later cleanup phase should remove the older active-bus installer from `gate-ui-hooks.js` entirely after live validation.
- `public/index.html` still contains the base `renderAll()` function, but the important board functions it calls are now patched to the Phase 1C owner.
- Processing page still uses its own rendering and modal workflow and remains a future consolidation target.

## Next recommended phase

Proceed to Phase 2 — Processing page and modal ownership.

Processing is now the largest remaining fragmented workflow surface because modal behavior, Airman close safety, final-time edit, tablet scroll, mobile scroll, and instructor context menu are still spread across multiple files.
