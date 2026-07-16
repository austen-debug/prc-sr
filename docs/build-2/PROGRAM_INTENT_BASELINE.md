# GATE Build 2 — Program Intent Baseline

Status: GOVERNING BASELINE  
Runtime status: Build 1 UI remains operational; Gate C persistence protections are available; Gate D workflows and Gate E synchronization/degraded-operation assets remain staged

## Mission

GATE — Gateway Arrival Tracking Environment — is the unclassified operational throughput environment for Pfingston Reception Center receiving. It provides one authoritative operational picture from airport and local arrival through PRC processing, dormitory movement, command-display awareness, closeout, and historical review.

## Data boundary

- No trainee names.
- No trainee-level records.
- No orders data.
- No expansion of trainee PII.
- Operational counts, timing, workflow state, staff assignment, and approved configuration only.
- Cloudflare credential bindings remain server-side and never enter records, client bundles, logs, archives, or documentation values.

## Canonical workflow

```text
Airport / local arrival
        ↓
confirmed PRC arrival
        ↓
Processing and dorm assignment
        ↓
dorm open / phase / load / close
        ↓
Current Summary and command displays
        ↓
verified immutable archive closeout
```

## Architectural intent

GATE Build 2 uses:

1. one operational-truth and calculation plane;
2. one canonical entity model after the legacy compatibility boundary;
3. typed repositories and named commands;
4. server-confirmed critical writes;
5. server-enforced record versions before write-heavy migration;
6. append-only audit events for critical transitions;
7. one GATE Design Language and component system;
8. one route and permission registry;
9. one shell state model;
10. capability-driven responsive composition;
11. WCAG 2.2 AA accessibility contracts;
12. route-by-route strangler migration with explicit legacy retirement.

## Roles and route permissions

| Role | Routes | Operational boundary |
|---|---|---|
| Instructor | Status Board, Airport, Input, Processing, Archives, Squadron Board | Full approved operational and administrative functions |
| Airman | Status Board, Processing | Live execution functions explicitly approved for Airman use |
| Squadron | Squadron Board | Read-only Squadron Board data only |

Squadron authentication may consume `SQUADRON_USERNAME` and `SQUADRON_PASSWORD` only through server-side Cloudflare bindings. Navigation hiding is never authorization.

## Critical-write rule

The following workflows require confirmed server persistence and may not claim success from optimistic local state:

- Week Group initialization;
- bus dispatch and arrival confirmation;
- arrived-bus count correction;
- local arrival creation;
- dorm load, open, close, reopen, and final-time correction;
- archive create, verify, amendment, deletion, and closeout;
- active Week Group changes.

Gate D binds these operations to versioned writes, authoritative verification, required append-only audit events, explicit partial states, durable operation IDs, and resumable recovery. Gate E disables critical writes whenever synchronization state is offline, stale, failed, unknown, or syncing; blocked writes are not queued. Route migration remains blocked until Gate F completes consolidated revalidation.

## Synchronization and degraded-operation rule

- Cross-tab messages are invalidation notices only and contain no operational payload.
- A foreign notice triggers authoritative refetch before current status is restored.
- The last-confirmed record set may remain in memory for read-only display.
- Offline, stale, and failed states must be visible with last-synchronized context when available.
- Operational records, audit events, archives, and workflow payloads are never placed in a client-side database or offline write queue.
- Static-shell caching is allowlisted; `/api/*` remains network-only.

## Archive rule

An archive is an immutable historical snapshot. A correction creates a documented amendment or new version with actor role, reason, prior version, resulting version, and audit event. A normal operational workflow may not silently overwrite historical truth.

## Responsive and design rule

- GATE Design Language is the only Build 2 UI language.
- Raw colors remain in foundation tokens; components consume semantic tokens.
- The controlled spacing scale is `2, 4, 8, 12, 16, 20, 24, 32, 40, 48`.
- Responsive behavior is based on available geometry and input capability, not device identity.
- No device-specific JavaScript layout manipulation.
- No page-specific corrective CSS.
- No parallel desktop, tablet, or phone application.

## Approved migration order

```text
1. Status Board
2. Processing
3. Airport
4. Input
5. Archives and Reports
6. Squadron Board
```

Each migration package must capture Build 1 behavior, add baseline tests, run old and new paths in parallel where practical, prove responsive and accessibility behavior, define activation and rollback, and retire the former owner after acceptance.

## Corrected program position

```text
Phase 1A — Operational Truth Registry
COMPLETE

Phase 1B — Canonical Domain Core
COMPLETE / STAGED AFTER GATE A

Phase 1C — Compatibility and Canonical Entity Boundary
COMPLETE / STAGED AFTER GATE B

Phase 1D — Repository, Record Versioning, Append-Only Audit, and Critical Workflows
COMPLETE / STAGED AFTER GATES C AND D

Phase 1E — Parity Validation
COMPLETE FOR THE IMPLEMENTED FOUNDATION

Phase 2A–2E — GDL, Components, Shell, Responsive, Accessibility
COMPLETE / STAGED

Phase 3 — Feature Migration and Legacy Retirement
BLOCKED UNTIL FOUNDATION ALIGNMENT GATES A–F CLOSE
```

## Foundation gates

```text
Gate A — Program baseline and canonical domain completion       COMPLETE / STAGED
Gate B — Canonical entities and role provenance                 COMPLETE / STAGED
Gate C — Backend versioning and append-only audit events        COMPLETE
Gate D — Critical workflow orchestration                        COMPLETE / STAGED
Gate E — Synchronization and degraded operation                 COMPLETE / STAGED
Gate F — Consolidated revalidation and corrected Phase 1 exit   NEXT
```

This document governs later phase summaries when a conflict exists. A change to mission, role access, migration order, critical-write policy, archive immutability, synchronization policy, or the no-PII boundary requires an explicit program decision and corresponding fixture updates.
