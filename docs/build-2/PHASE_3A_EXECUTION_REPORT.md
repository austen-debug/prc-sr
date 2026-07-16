# GATE Build 2 — Phase 3A Execution Report

## Status Board Shadow Migration

Status: IMPLEMENTED — CI VALIDATION PENDING  
Visible runtime owner: Build 1  
Build 2 mode: hidden, read-only shadow

## Objective

Run the canonical Build 2 Status Board model against the same authorized in-memory records used by the operational Build 1 board, compare the complete route truth in parallel, and collect activation evidence without changing the visible route or operational workflow.

## Source added

```text
public/app/status-board-shadow/
├── contracts.mjs
├── legacy-snapshot.mjs
├── canonical-snapshot.mjs
├── parity.mjs
├── evidence-ledger.mjs
├── route-contract.mjs
├── runner.mjs
└── index.mjs

public/js/gate-status-board-shadow-controller.js
```

## Active integration

`functions/_middleware.js` loads one deferred shadow bridge after the active Status Board and timer controllers.

The bridge:

- observes the rendered Build 1 metrics, bus identities, dorm grouping, and timer presentation;
- reads the same `allData` record array and active Week Group;
- imports the canonical Build 2 shadow package;
- runs the comparison after render/data/page hooks and on a 30-second timer cadence;
- retains the latest result and aggregate evidence in memory;
- exposes read-only diagnostics through `window.GateStatusBoardShadow`.

The bridge does not write DOM state, call an API, persist evidence, queue writes, alter routing, or replace a controller.

## Compared route truth

```text
Arrived
Expected
Last arrival
Active bus identity set
Dorm state counts
Dorm membership by state
Timer display
Timer warning/critical tone
Timer overtime state
```

## Canonical policy decisions

- Confirmed arrivals require `status === arrived` and a valid `arrived_at` timestamp.
- Expected remains the sum of active Week Group dorm capacity.
- Last arrival is derived from the latest confirmed arrival.
- Timer thresholds are 40 minutes warning, 50 minutes critical, and 60 minutes overtime.
- Timer text may differ by no more than two seconds.
- Evidence is memory-only and contains aggregate comparison outcomes.

## Route-readiness contracts

Phase 3A defines automated composition evidence for all six responsive postures and route-specific accessibility/fullscreen boundaries. Manual screen-reader, keyboard, visual-capture, fullscreen, and degraded-state review remains mandatory before visible activation.

## Validation source

```text
tests/build-2/status-board-shadow/status-board-shadow.test.mjs
tests/build-2/status-board-shadow/fixtures/B2-P3A-F001-route-readiness.json
.github/workflows/build-2-phase-3a-status-board-shadow.yml
```

## Activation decision

```text
PENDING — Phase 3A CI
PENDING — sustained live shadow evidence
PENDING — manual six-posture evidence
PENDING — manual accessibility/fullscreen evidence

NOT AUTHORIZED — visible Build 2 Status Board
NOT AUTHORIZED — Build 2 production writes
NOT AUTHORIZED — Build 1 Status Board retirement
```

## Runtime boundary

Build 1 remains the sole visible Status Board owner and the only operational interaction surface. Phase 3A introduces a hidden calculation observer only. Processing, Airport, Input, Archives, Squadron Board, authentication, service-worker registration, and record persistence behavior are unchanged.

## Next after closure

```text
Phase 3B — Status Board Controlled Test Surface
Only after shadow parity and manual route evidence satisfy the activation-review gate
```
