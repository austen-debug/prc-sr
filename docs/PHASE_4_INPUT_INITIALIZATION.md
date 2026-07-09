# Phase 4 — Input / Week Group Initialization Ownership

Status: Implemented baseline
Scope: Input page batch grid, Week Group initialization, receiving windows, Space Force dorm metadata, Band / Space Force mutual exclusion, dorm creation preflight validation, and Input page compatibility handoffs.

## Objective

Phase 4 consolidates the Input page so one active controller owns the Week Group initialization workflow from row entry through dorm record creation.

Before this phase, `gate-input-page-controller.js` added important enhancements but still depended on legacy base functions such as `initBatchGrid()` and `initializeWeekGroup()`. Phase 4 converts it into the active source of truth for the Input workflow.

## What this phase does not change

Phase 4 does not change:

- backend records API
- dorm record schema
- Status Board rendering
- Processing workflow
- Airport/local bus workflow
- Archive closeout behavior
- mobile shell/dropdown polish
- mobile watermark polish

## Active implementation

### Canonical owner

Updated:

```txt
public/js/gate-input-page-controller.js
```

This controller now owns:

- batch grid rendering
- batch row state
- clear row behavior
- horizontal tab flow
- Total Expected calculation
- Week Group initialization
- receiving Day One / Day Two windows
- Space Force dorm checkbox column
- Band / Space Force mutual exclusion
- dorm payload validation before create
- receiving-window and Space Force metadata injection into dorm/archive payloads
- Input page refresh after initialization

The controller exposes:

```js
window.GateInputPageController = {
  isCanonicalOwner: true,
  renderBatchGrid,
  clearBatchRow,
  initializeWeekGroup,
  returnToBoard,
  refresh,
  collectReceivingWindows,
  validateReceivingWindows,
  preflightInitialization,
  getRows
}
```

## Legacy global handoffs

The controller patches these legacy globals so old inline buttons and base app calls route to the canonical owner:

```js
window.initBatchGrid = renderBatchGrid;
window.clearBatchRow = clearBatchRowCanonical;
window.handleBatchInput = gateInputHandleBatchInput;
window.updateTotalLoadCalc = updateTotalLoad;
window.initializeWeekGroup = initializeWeekGroupCanonical;
window.returnToBoard = returnToBoardCanonical;
window.showBatchMsg = showInputMessage;
window.collectReceivingWindowsForReport = collectReceivingWindowsForReport;
```

The controller also removes the inline `onclick` from `#init-wg-btn` and handles initialization through a capture-phase click listener. This prevents the legacy initializer from firing alongside the canonical one.

## Week Group initialization behavior

`initializeWeekGroupCanonical()` now owns the create path.

Behavior:

1. Syncs all visible batch row fields into controller state.
2. Saves receiving-window values to local storage.
3. Runs preflight validation.
4. Upserts the active `week_group` config record.
5. Creates one dorm record for each row with a positive Load.
6. Writes receiving-window metadata into each dorm payload.
7. Writes Space Force metadata into each Space Force dorm payload.
8. Enforces Band / Space Force mutual exclusion.
9. Refreshes Status Board / Processing / data hooks after creation.
10. Shows the success overlay only after all dorm rows are created.

## Preflight validation

The Phase 4 preflight blocks unsafe initialization before any dorms are created.

Validation rules:

- Week Group ID is required.
- Receiving windows must be complete pairs if used.
- Day Two cannot start before Day One ends.
- At least one row must have a positive Load.
- A row cannot be both Band and Space Force.
- Dorm loads must be between 1 and 60.
- Duplicate dorm names inside the same initialization are blocked.
- Initializing a Week Group that already has live dorm records is blocked to prevent duplicate live dorms.
- The record limit is checked before initialization.

## Dorm payload additions

Dorm records created through Input now include:

```txt
space_force
is_space_force
receiving_day_one_start
receiving_day_one_end
receiving_day_two_start
receiving_day_two_end
```

Space Force rows are created with:

```txt
space_force: 'true'
is_space_force: 'true'
band: 'false'
```

## Archive/report compatibility

The existing receiving-window archive/report compatibility is preserved.

The controller still patches `dataSdk.create()` and `dataSdk.update()` so archive payloads retain receiving-window metadata and Space Force dorm metadata for reporting/print workflows.

## Runtime change

Middleware now loads:

```html
<script src="/js/gate-input-page-controller.js?v=phase-4-input-20260709" defer></script>
```

## Acceptance criteria

Must pass before moving to Archive/reporting consolidation:

1. Input page renders 25 batch rows.
2. Total Expected updates as Load values change.
3. Space Force column appears between Band and Load.
4. Selecting Space Force clears Band for that row.
5. Selecting Band clears Space Force for that row.
6. Clear row resets all fields including Space Force.
7. Receiving windows appear above the batch grid.
8. Invalid receiving-window pairs block initialization.
9. Initializing a new Week Group creates exactly one dorm per row with positive Load.
10. Space Force dorms persist with `space_force` and `is_space_force` flags.
11. Re-initializing a live Week Group with existing dorms is blocked.
12. Success overlay appears only after all dorm rows are created.
13. Return to Status Board routes through the app shell.

## Known remaining risks

- `public/index.html` still contains legacy Input functions, but Phase 4 patches globals and intercepts the Initialize button before the inline legacy path fires.
- The record-creation loop is still sequential to preserve operational safety and simplify failure recovery.
- Archive/reporting uses the Input controller’s metadata helpers but remains its own later consolidation phase.

## Next recommended phase

Proceed to Archive / Reporting / Closeout consolidation.

That phase should create one owner for:

- closeout archive payload construction
- archive edit modal
- current summary records
- print/export behavior
- archive receiving-window and bus/dorm data integrity
