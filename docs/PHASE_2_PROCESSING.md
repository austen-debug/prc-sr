# Phase 2 — Processing Page and Modal Ownership

Status: Implemented baseline
Scope: Processing page cards, Processing dorm modal, instructor edit modal workflow, instructor context menu, Airman-safe modal close, load/phase updates, open/close dorm actions, and final-time edit commit.

## Objective

Phase 2 consolidates the Processing workflow so one active controller owns the visible Processing workflow and modal behavior.

The goal is to stop spreading Processing behavior across the monolithic base app and several patch files.

## What this phase does not change

Phase 2 does not change:

- backend records API
- record schema
- Airport bus creation
- active bus confirmation workflow
- Input week-group initialization
- Archive closeout
- Status Board rendering
- Squadron Board rendering
- mobile shell/dropdown polish
- mobile watermark polish

Tablet/mobile presentation hardening files remain active for now because mobile UI polish is deferred to a later UI phase.

## Active implementation

### New canonical owner

Added:

```txt
public/js/gate-processing-controller.js
```

This controller now owns:

- `renderProcessingPage`
- `buildProcCard`
- `openDormModal`
- `closeDormModal`
- `setPhase`
- `modLoad`
- `setLoadFull`
- `saveLoad`
- `saveAssignedAirman`
- `openDorm`
- `closeDorm`
- `openDormEditModal`
- `closeDormEditModal`
- `deleteDormitoryFromEditModal`
- instructor context menu
- final-time edit save
- Processing timer text refresh

The controller exposes:

```js
window.GateProcessingController = {
  isCanonicalOwner: true,
  render,
  scheduleRender,
  openDormModal,
  closeDormModal,
  openDorm,
  closeDorm,
  openDormEditModal,
  closeDormEditModal,
  saveLoad,
  saveAssignedAirman,
  updateDorm,
  refresh
}
```

### Files removed from active runtime

The following files remain in the repository for traceability but are no longer loaded by middleware:

- `public/js/prc-dash-processing-context-menu.js`
- `public/js/gate-processing-final-time-commit.js`
- `public/js/gate-airman-modal-close-safety.js`

Their behavior is now incorporated into `gate-processing-controller.js`.

## Processing card behavior

The controller renders Processing dorm cards with stable attributes:

- `data-component="processing-dorm-card"`
- `data-owner="gate-processing-controller"`
- `data-dorm-id="..."`
- `data-state="..."`

Cards support:

- click / keyboard open into Processing controls
- instructor-only right-click context menu
- female / Band / Space Force border classes
- assigned Airman display
- phase display
- current/max load display
- open/closed timer display

## Dorm modal behavior

The controller owns the Processing dorm modal lifecycle.

It safely handles:

- modal open
- modal close / X button / Escape close
- Airman-safe modal close without logout or page jump
- phase button rendering
- load input rendering
- instructor-only open/close actions
- Airman-visible load / assigned Airman workflows

## Record update behavior

All Processing dorm updates now flow through one `updateDorm()` helper.

That helper:

1. updates the record through `dataSdk.update()`
2. syncs the returned record into local `allData`
3. triggers Status Board refresh
4. triggers Squadron/board compatibility refresh
5. triggers data hooks
6. re-renders Processing

## Final Time behavior

Closed dorm edit records now commit final time through the Processing controller.

Rules:

- Final Time is normalized to `MM:SS` style when possible.
- Closed records preserve `state: closed` and `phase: Closed`.
- Final Time save happens through the same edit-form submit capture path.
- The old standalone final-time controller is no longer loaded.

## Context menu behavior

The instructor context menu is now owned by the Processing controller.

It supports:

- Edit Record
- Open Record
- Close Record
- Open Processing Controls
- Delete Record

Non-instructors do not get the context menu.

## Runtime order

Middleware now loads:

```html
<script src="/js/prc-dash-final-audit.js" defer></script>
<script src="/js/gate-status-board-controller.js?v=phase-1c-status-board-20260709" defer></script>
<script src="/js/gate-processing-controller.js?v=phase-2-processing-20260709" defer></script>
```

The order is intentional:

1. `prc-dash-final-audit.js` preserves Squadron Board and close-dorm timing helper compatibility.
2. `gate-status-board-controller.js` owns Status Board rendering.
3. `gate-processing-controller.js` owns Processing behavior and becomes the final Processing global-function owner.

## Acceptance criteria

Must pass before moving to Airport workflow consolidation:

1. Processing page renders dorm cards.
2. Processing card click opens the dorm modal.
3. X / Escape / close modal does not log out or route away.
4. Airman can update assigned Airman when permitted.
5. Load +/- / Full / Save still updates the dorm load.
6. Instructor can open an empty dorm.
7. Instructor can close an open dorm.
8. Close Dorm still retains stable final time.
9. Instructor right-click menu appears only for instructors.
10. Edit Record saves dorm name, SDQ, section, inter-sec, sex, Band, max/current load, assigned Airman, auditorium location, notes, and closed final time.
11. Status Board and Squadron Board reflect Processing changes after save.
12. No old Processing context menu duplicate appears.

## Known remaining risks

- The base `public/index.html` still contains old Processing functions, but they are patched by `GateProcessingController` after load.
- Tablet/mobile modal presentation files remain active and should be folded into a later UI/mobile polish phase.
- This phase does not repair the mobile dropdown menu or mobile watermark; those remain deferred UI polish issues.

## Next recommended phase

Proceed to Airport and local arrival workflow consolidation.

That phase should create one owner for:

- Airport bus form submission
- local arrival form submission
- confirm arrival path compatibility
- bus edit modal
- bus log rendering
- Airport mobile form layout contract, if not deferred to the UI phase
