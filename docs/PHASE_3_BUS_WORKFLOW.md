# Phase 3 — Airport and Local Arrival Workflow Ownership

Status: Implemented baseline
Scope: Airport bus dispatch, local arrival creation, bus arrival confirmation, bus edit modal, local bus modal, combined bus log, Space Force bus counts, and board refresh after bus changes.

## Objective

Phase 3 consolidates the Airport and local arrival workflow so one active controller owns the full bus record lifecycle from dispatch or local arrival through arrival confirmation and edit.

## What this phase does not change

Phase 3 does not change:

- backend records API
- bus record schema
- Status Board dorm rendering
- Processing dorm workflow
- Input week-group initialization
- Archive closeout
- mobile shell/dropdown polish
- mobile watermark polish

## Active implementation

### Canonical owner

Updated:

```txt
public/js/gate-bus-workflow-controller.js
```

This controller now owns:

- airport bus form submission
- local arrival form submission
- active bus arrival confirmation
- airport/local bus edit modal open/close
- local bus modal open/close
- combined airport/local bus log rendering
- Space Force bus fields and table column
- bus-related surface refresh after create/update/arrival confirmation

The controller exposes:

```js
window.GateBusWorkflowController = {
  isCanonicalOwner: true,
  renderBusLog,
  openBusModal,
  closeBusModal,
  openLocalBusModal,
  closeLocalBusModal,
  confirmBusArrival,
  refresh,
  getEditableBuses
}
```

### Legacy global handoffs

The controller now patches these legacy globals so the monolithic app and shared components call the canonical owner:

```js
window.renderAirportBusLog = renderBusLog;
window.openAirportBusEditModal = openModal;
window.closeAirportBusEditModal = closeAirportBusEditModalCanonical;
window.openLocalBusModal = openLocalBusModalCanonical;
window.closeLocalBusModal = closeLocalBusModalCanonical;
window.confirmBusArrival = confirmBusArrivalCanonical;
```

This is important because active bus cards still call `confirmBusArrival()` from shared markup.

## Bus arrival confirmation

`confirmBusArrivalCanonical(id)` now owns the active bus arrival path.

Behavior:

1. Looks up the bus record by backend ID.
2. Verifies the bus is active/en route.
3. Uses the existing confirmation dialog when available.
4. Updates the bus to:
   - `status: 'arrived'`
   - `arrived_at: new Date().toISOString()`
   - `updated_at: new Date().toISOString()`
5. Syncs the local cache.
6. Refreshes the bus log, active bus panel, Status Board, metrics, and data hooks.

## Airport bus dispatch

Airport bus dispatch remains a create path with validation.

It preserves:

- total OTW count
- female count
- naturalization count
- Space Force count
- active week group
- airport bus ID
- bus dispatch sound event

The controller now also writes `departed_at` at dispatch time to make log timing clearer.

## Local arrival creation

Local arrivals remain `bus_type: 'local'` and are created as already arrived.

They preserve:

- originating destination
- arrived total
- female count
- naturalization count
- Space Force count
- active week group
- `created_at`
- `departed_at`
- `arrived_at`

## Bus edit modal

The bus edit modal now remains controlled by the bus workflow controller.

It can edit:

- airport bus number
- local bus name/origin
- total count
- female count
- naturalization count
- Space Force count

Saving the modal updates the record, syncs local state, closes the modal, and refreshes dependent surfaces.

## Acceptance criteria

Must pass before moving to Input / Week Group initialization consolidation:

1. Airport bus dispatch creates exactly one active airport bus record.
2. Airport bus dispatch still shows in Active Buses En Route.
3. Confirming an active bus arrival changes it to arrived and removes it from Active Buses En Route.
4. Confirming arrival updates ARRIVED totals.
5. Local arrival creates exactly one arrived local bus record.
6. Local arrival updates ARRIVED totals immediately.
7. Female, NAT, and Space Force counts are preserved for airport and local arrivals.
8. Airport/local bus log shows airport and local records in one table.
9. Clicking a bus log row opens the bus edit modal.
10. Saving the bus edit modal updates the log and board metrics.
11. Cancel/X closes the local bus and bus edit modals without changing records.

## Known remaining risks

- The base `public/index.html` still contains old airport/local bus listeners, but the Phase 3 controller intercepts submit events in capture phase and stops propagation.
- The mobile Airport form layout is still supported by `gate-airport-phone-layout-fix.js` and remains a later UI/mobile polish target.
- Archive/reporting still reads bus records and should be validated after live bus confirmation is tested.

## Next recommended phase

Proceed to Input / Week Group initialization consolidation.

That phase should create one owner for:

- batch grid state
- week group initialization
- receiving windows
- Space Force dorm column
- Band / Space Force mutual exclusion
- dorm payload validation before create
