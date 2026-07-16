# GATE Build 2 — Status Board Evidence Harness

Status: IMPLEMENTED / VALIDATION PENDING  
Runtime status: non-production fixture surface; not loaded by active middleware

## Purpose

The Status Board Evidence Harness provides a visible, fixture-only surface for the manual evidence classes that cannot be collected from the hidden calculation observer alone:

- six responsive postures;
- keyboard traversal and visible focus;
- landmarks, headings, regions, and labels;
- screen-reader route comprehension;
- contrast and forced-colors behavior;
- 200% and 400% zoom/reflow;
- touch-target review;
- fullscreen entry, exit, Escape, and focus restoration;
- stale and offline read-only presentation;
- sanitized evidence-packet assembly.

## Source

```text
public/app/status-board-shadow/review-harness/
├── index.html
├── fixtures.mjs
├── review-harness.mjs
├── review-harness-tokens.css
└── review-harness.css
```

## Isolation boundary

The harness:

- uses synthetic records and the explicit Week Group `WG-REVIEW`;
- imports the GATE component, responsive, accessibility, and evidence-review contracts;
- renders no operational data;
- calls no API;
- reads no session or authentication state;
- imports no repository or workflow command;
- uses no browser storage;
- registers no service worker;
- creates no visible GATE application route;
- is not referenced by `functions/_middleware.js`;
- cannot activate Phase 3B or retire Build 1.

## Responsive review

The harness exposes all six canonical postures through fixed review dimensions:

| Posture | Review viewport |
|---|---:|
| Desktop landscape | 1440 × 900 |
| Desktop vertical | 1024 × 1280 |
| Tablet landscape | 1024 × 768 |
| Tablet portrait | 768 × 1024 |
| Phone landscape | 844 × 390 |
| Phone portrait | 390 × 844 |

The dimensions are review fixtures, not device detection. The board composition still consumes the canonical posture and route contracts.

## Degraded-state review

The harness provides:

```text
current
stale · read only
offline · read only
```

Stale and offline modes retain the fixture data, identify the read-only state, and display last-synchronized context. The refresh control simulates a successful authoritative refresh for presentation review only; it does not call the records API.

## Fullscreen review

The fixture board uses the browser Fullscreen API and provides:

- an external entry control;
- a visible route-local exit control while fullscreen is active;
- native Escape handling;
- focus restoration to the initiating control;
- no navigation mutation.

## Evidence packet builder

The packet builder consumes:

- the aggregate memory-only shadow ledger copied from `window.GateStatusBoardShadow.getEvidence()`;
- manual evidence statuses and artifact references;
- controlled-environment prerequisite statuses and artifact references;
- optional sanitized mismatch dispositions.

It rejects identity-bearing manual fields and secret-bearing deployment fields through the existing evidence contracts. Generated JSON remains in the page's memory and output field only; the harness does not save or transmit it.

## Evidence limits

Harness review may support manual responsive, accessibility, fullscreen, degraded-state, and artifact-retention evidence. It does **not** prove:

- sustained live parity;
- authoritative live-record access;
- deployed session bindings;
- deployed D1 audit triggers;
- production route behavior;
- rollback in a deployed environment.

Those items remain separate requirements in Issue #48 and the deployment prerequisite register.

## Authorization boundary

```text
AUTHORIZED — fixture-only manual evidence collection
AUTHORIZED — sanitized in-memory evidence-packet generation

NOT AUTHORIZED — Phase 3B controlled test surface
NOT AUTHORIZED — visible Build 2 Status Board in production
NOT AUTHORIZED — Build 2 production writes
NOT AUTHORIZED — Build 1 Status Board retirement
NOT AUTHORIZED — service-worker registration
```
