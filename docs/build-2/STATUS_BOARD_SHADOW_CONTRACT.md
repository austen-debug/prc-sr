# GATE Build 2 — Status Board Shadow Contract

Status: PHASE 3A COMPLETE / SHADOW ACTIVE / EVIDENCE COLLECTION OPEN  
Runtime mode: hidden, read-only comparison; Build 1 remains the visible and authoritative Status Board

## Purpose

Phase 3A is the first strangler-migration package. It executes the canonical Build 2 Status Board model against the same in-memory operational records used by Build 1, captures the visible Build 1 output after rendering, and compares both models without changing routing, markup, records, permissions, or workflow ownership.

The evidence-review extension evaluates the memory-only parity ledger together with separately supplied manual, mismatch-disposition, deployment, and rollback evidence. It cannot authorize Phase 3B or activate a route.

## Active bridge

```text
public/js/gate-status-board-shadow-controller.js
```

The bridge is loaded after the active Build 1 Status Board and timer controllers. It may:

- read `allData` after the normal Build 1 data load;
- read the active Week Group;
- read visible `stat-*` metric values;
- read active bus and dorm identities from the existing Status Board controller;
- read rendered timer text and visual tone classes;
- import the pure Build 2 shadow package;
- retain the latest comparison and an aggregate evidence ledger in memory;
- evaluate supplied review evidence without retaining it;
- expose a frozen diagnostic API at `window.GateStatusBoardShadow`.

The bridge may not:

- create or expose a new route;
- render or replace Status Board markup;
- write text, attributes, classes, or styles;
- call the records API;
- create, update, or delete a record;
- queue a write;
- persist evidence in browser storage;
- register a service worker;
- retain manual or deployment evidence arguments;
- retire or bypass a Build 1 owner.

## Pure shadow and review package

```text
public/app/status-board-shadow/
├── contracts.mjs
├── legacy-snapshot.mjs
├── canonical-snapshot.mjs
├── parity.mjs
├── evidence-ledger.mjs
├── route-contract.mjs
├── runner.mjs
├── sync-adapter.mjs
├── review-contract.mjs
├── manual-evidence.mjs
├── mismatch-disposition.mjs
├── deployment-evidence.mjs
├── rollback-contract.mjs
├── review-evaluator.mjs
└── index.mjs
```

### Legacy snapshot

The legacy snapshot records the visible or active Build 1 result for:

- arrived;
- expected;
- last arrival;
- active bus identities;
- dorm state counts and identities;
- timer text;
- timer warning/critical tone;
- overtime state.

It does not retain full operational records.

### Canonical snapshot

The canonical snapshot performs:

```text
Build 1 records
→ legacy compatibility normalization
→ canonical Build 2 entities
→ canonical Status Board summary
→ route-specific Status Board snapshot
```

It uses the approved PRC timer policy:

```text
40:00 — warning
50:00 — critical
60:00 — overtime
```

A timer display difference of at most two seconds is tolerated because the visible and shadow captures cannot occur in the same event-loop instant.

## Parity classifications

| Classification | Meaning | Activation impact |
|---|---|---|
| `exact` | All checked values match | Passing sample |
| `tolerated` | Only approved timer drift exists | Passing sample |
| `divergent` | One or more blocking values differ | Blocks activation review |
| `unavailable` | A required snapshot or context is missing | Blocks activation review |

Blocking metrics are:

- arrived;
- expected;
- last arrival;
- active bus identity set;
- dorm state counts;
- dorm membership by state;
- timer tone;
- overtime state;
- timer display outside tolerance.

The last-arrival comparison deliberately exposes the current ownership difference: Build 1 displays `last_airport` configuration while Build 2 derives the most recent confirmed arrival.

## Evidence ledger

The evidence ledger is memory-only and stores aggregate sample outcomes, not records. Evidence-review readiness requires:

- at least 10 samples;
- at least 5 consecutive passing samples;
- at least 270 seconds between the earliest and latest valid retained sample;
- zero blocking metrics across the retained evidence window.

The observation-duration requirement prevents burst execution from being treated as sustained evidence.

A documented mismatch disposition does not override the zero-blocking requirement. Later samples must demonstrate that the selected source-of-truth decision has been implemented without remaining parity blockers.

## Evidence review decisions

The review evaluator returns only:

```text
collecting
blocked
ready-for-authorization-review
```

Even when all evidence passes, the result preserves:

```text
phase3BAuthorized: false
productionRouteActivated: false
build1RetirementAuthorized: false
explicitGovernanceDecisionRequired: true
```

See [`STATUS_BOARD_EVIDENCE_REVIEW_CONTRACT.md`](./STATUS_BOARD_EVIDENCE_REVIEW_CONTRACT.md).

## Responsive route contract

Phase 3A defines Status Board compositions for all six foundation postures:

1. desktop landscape;
2. desktop vertical;
3. tablet landscape;
4. tablet portrait;
5. phone landscape;
6. phone portrait.

The contract defines metric columns, dorm-state presentation, active-bus presentation, density, and fullscreen posture for each. No device-specific JavaScript layout branch is introduced.

## Accessibility and fullscreen contract

The route contract preserves:

- banner, navigation, and main landmarks;
- a Status Board route heading;
- explicit metric and active-bus labels;
- Empty, Open, and Closed region headings;
- visible timers without continuous automatic screen-reader announcements;
- stale/offline status announcements with last-synchronized context;
- visible focus and reading-order alignment;
- visible fullscreen entry and exit controls;
- Escape exit and focus restoration;
- no orientation lock and no navigation mutation.

Automated contracts do not replace route-specific manual accessibility and six-posture visual evidence required before visible activation.

## Diagnostic API

```text
window.GateStatusBoardShadow.getLatest()
window.GateStatusBoardShadow.getEvidence()
window.GateStatusBoardShadow.getEvidenceSummary()
window.GateStatusBoardShadow.getEvidenceReview(input)
window.GateStatusBoardShadow.getReviewRequirements()
```

Manual and deployment evidence supplied to `getEvidenceReview(input)` exists only for that call.

## Activation boundary

Phase 3A authorizes shadow execution and evidence evaluation only.

```text
AUTHORIZED — hidden canonical calculation and parity evidence
AUTHORIZED — pure sanitized evidence-review evaluation
NOT AUTHORIZED — Phase 3B controlled test surface
NOT AUTHORIZED — visible Build 2 Status Board
NOT AUTHORIZED — Build 2 write operation
NOT AUTHORIZED — Build 1 Status Board retirement
NOT AUTHORIZED — service-worker activation
```
