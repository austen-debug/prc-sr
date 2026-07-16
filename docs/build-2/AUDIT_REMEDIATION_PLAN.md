# GATE Build 2 — Audit Remediation Plan

Status: ACTIVE  
Trigger: comprehensive program-intent, UX, workflow, sustainment, and bloat audit

## Objective

Resolve the remaining gap between the validated Build 2 foundation and the intended maintainable end state before any Phase 3B controlled test surface is considered.

The remediation sequence prioritizes consolidation, evidence, and retirement over additional feature development.

## Gate 1 — Governance reconciliation and runtime-bloat controls

Purpose: establish one current program position and prevent further active-runtime growth.

Required outcomes:

- reconcile `README.md`, `PROGRAM_INTENT_BASELINE.md`, `INDEX.md`, and `ACTIVE_RUNTIME_STACK.md`;
- establish a machine-readable active middleware inventory;
- block growth above 13 direct stylesheets, 3 imported stylesheets, and 28 direct scripts;
- prohibit new corrective/fix/patch/stability runtime assets;
- require Phase 3B to be net-negative in active assets;
- create the Status Board retirement manifest;
- issue explicit UX decisions for arrival-time semantics, phone portrait metrics, and right-click parity;
- keep Build 1 visible and operational.

## Gate 2 — Runtime-owner reduction

Purpose: remove low-risk duplicate and corrective ownership before a controlled Build 2 surface is introduced.

Work packages:

1. classify every active observer, interval, wrapper, and global by owner;
2. remove inactive or provably redundant middleware assets one at a time;
3. consolidate compatible Status Board timer refresh paths;
4. remove Status Board selectors from cross-page corrective styles where ownership is already canonical;
5. preserve rollback and complete runtime-integrity validation after every removal.

Gate 2 may reduce the active Build 1 stack but may not activate a Build 2 route.

## Gate 3 — Evidence closure

Purpose: complete the evidence that cannot be manufactured by repository tests.

Required outcomes:

- sustained live shadow window;
- disposition and later passing samples for every blocking mismatch;
- six-posture retained visual evidence;
- keyboard, focus, screen-reader, contrast, forced-colors, zoom, reflow, and touch evidence;
- fullscreen entry, exit, Escape, focus restoration, and route-isolation evidence;
- stale, offline, last-sync, and reconnect evidence;
- controlled-environment API, role-binding, feature-control, and service-worker verification;
- exercised Build 1-only rollback.

Issue #48 remains the collection record.

## Gate 4 — Phase 3B authorization review

Purpose: decide whether a controlled read-only Build 2 Status Board surface may be introduced.

Authorization review requires:

- Gates 1–3 complete;
- evidence evaluator state `ready-for-authorization-review`;
- separate human governance decision;
- a default-off server-controlled activation mechanism;
- no production writes;
- no service-worker activation;
- a Phase 3B implementation plan that meets the retirement manifest and runtime-budget targets.

## Non-negotiable constraints

- No big-bang rewrite.
- No new PII or trainee-level records.
- No new offline write queue or client operational database.
- No second visible owner for the same workflow.
- No new corrective runtime layer.
- No route-order change without an explicit program decision.
- No retirement of a Build 1 owner before accepted replacement evidence and rollback.
- No claim of external deployment readiness based only on repository source.

## Completion rule

A remediation gate closes only when its source changes, governing documents, executable validation, runtime status, and next decision are all aligned. Passing documentation alone is insufficient.
