# GATE Build 2 — Status Board Evidence Review Contract

Status: PACKAGE IMPLEMENTED / EVIDENCE COLLECTION OPEN  
Route: Status Board  
Runtime mode: hidden, read-only shadow; Build 1 remains visible and operational

## Purpose

This contract governs the review between completed Phase 3A shadow implementation and any future request to authorize a controlled Phase 3B Status Board test surface.

The review package evaluates retained parity, mismatch disposition, manual route evidence, environment evidence, and rollback readiness. It does not activate a route and cannot issue an authorization decision.

## Decision states

| State | Meaning | Phase 3B effect |
|---|---|---|
| `collecting` | Required samples or evidence are incomplete | Blocked |
| `blocked` | A parity, manual, environment, or rollback failure exists | Blocked |
| `ready-for-authorization-review` | All evidence classes pass | Human authorization review permitted; not authorized |

The evaluator always returns:

```text
phase3BAuthorized: false
productionRouteActivated: false
build1RetirementAuthorized: false
explicitGovernanceDecisionRequired: true
```

An explicit governance decision remains required after the evaluator reaches `ready-for-authorization-review`.

## Live parity evidence

The retained memory-only shadow ledger must satisfy all of the following:

- at least 10 samples;
- at least 5 consecutive passing samples;
- at least 270 seconds between the earliest and latest retained valid sample;
- zero blocking metrics across the retained evidence window.

The duration rule prevents repeated manual `runNow()` calls from being treated as sustained observation.

Blocking values remain:

- arrived;
- expected;
- last arrival;
- active-bus identity set;
- dorm state counts;
- dorm membership by state;
- timer display outside tolerance;
- timer tone;
- timer overtime state.

## Mismatch disposition

Every observed blocking metric requires a disposition record with:

- metric;
- disposition status;
- decision timestamp;
- decision reference;
- rationale;
- decision-owner role;
- approved source of truth when legacy or canonical behavior is accepted.

Permitted dispositions are:

- `resolved`;
- `accepted-canonical`;
- `accepted-legacy`;
- `deferred-blocking`.

A disposition does not override the zero-blocking parity requirement. The implementation or source decision must be reflected in later passing samples before the live parity class can pass.

## Manual evidence

Manual evidence is required for:

- all six responsive postures;
- keyboard route traversal;
- visible focus and logical focus order;
- landmarks, headings, regions, and labels;
- screen-reader route comprehension;
- contrast and forced-colors behavior;
- 200% and 400% zoom/reflow;
- touch targets;
- fullscreen entry and exit;
- Escape exit;
- fullscreen focus restoration;
- fullscreen route isolation;
- stale and offline read-only presentation;
- last-synchronized context;
- reconnect and authoritative refresh;
- rollback execution and Build 1 smoke validation.

Each completed entry must include:

- check identifier;
- pass/fail state;
- observation timestamp;
- environment;
- method;
- retained artifact reference;
- reviewer role.

The schema rejects identity-bearing fields such as personal names, email addresses, phone numbers, trainee identifiers, DoD identifiers, and Social Security numbers.

## Deployment and controlled-environment evidence

Before Phase 3B may be considered, evidence must confirm:

1. a controlled review environment is identified;
2. the authoritative read-only records path works;
3. session secret and route-role bindings are verified;
4. any future test-surface feature flag defaults off;
5. rollback has been exercised;
6. the Build 2 service worker remains inactive;
7. manual accessibility evidence is retained;
8. manual responsive evidence is retained.

Deployment evidence records may contain references and verification metadata, but the schema rejects secret, token, password, credential, and cookie fields.

## Rollback requirement

The governing rollback target is Build 1-only Status Board execution. The rollback removes only the shadow bridge asset from middleware and requires no record write, schema change, or data migration.

See [`STATUS_BOARD_ROLLBACK_PLAN.md`](./STATUS_BOARD_ROLLBACK_PLAN.md).

## Read-only diagnostic API

The active bridge exposes:

```text
window.GateStatusBoardShadow.getEvidenceSummary()
window.GateStatusBoardShadow.getEvidenceReview(input)
window.GateStatusBoardShadow.getReviewRequirements()
```

`getEvidenceReview(input)` accepts manual, mismatch-disposition, and deployment evidence as call arguments. It does not retain or persist those arguments.

## Storage and privacy boundary

- Shadow samples remain memory-only.
- Review evaluation is pure and non-persistent.
- No operational record is included in the review packet.
- No trainee PII is accepted.
- No deployment secret is accepted.
- No browser storage, API write, service worker, or diagnostic upload is introduced.

## Authorization boundary

```text
AUTHORIZED — continued hidden shadow evidence collection
AUTHORIZED — pure evidence evaluation and sanitized review packet
NOT AUTHORIZED — Phase 3B controlled test surface
NOT AUTHORIZED — visible Build 2 Status Board
NOT AUTHORIZED — Build 2 production writes
NOT AUTHORIZED — Build 1 Status Board retirement
NOT AUTHORIZED — service-worker activation
```
