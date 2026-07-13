# GATE Build 2 Charter

Status: Active transformation program
Initial phase: Build 2, Phase 1 — Operational Truth and Data Foundation
Operational baseline: Build 1 on `main`

## Mission

Build 2 transforms GATE into a production-grade enterprise operational platform without disrupting the receiving mission supported by Build 1.

Build 2 is not a cosmetic rewrite and is not permission to create a second application beside the current one. It is a controlled migration toward:

- one authoritative data plane;
- one domain-calculation layer;
- one route and permission model;
- one GATE Design Language;
- one responsive component system;
- one automated validation and release process.

## Operational continuity

Build 1 remains the deployed behavioral reference until each corresponding Build 2 capability passes parity, workflow, role, viewport, persistence, and rollback validation.

Build 2 work must not silently alter Build 1 runtime behavior. Runtime integration requires a defined owner, acceptance criteria, backward validation, and rollback boundary.

## Non-negotiable engineering rules

1. Backend persistence is the source of truth for operational records.
2. No operational calculation may use the DOM as a data source.
3. Shared metrics and reports must consume the same pure domain selectors.
4. Only confirmed arrivals may count as processed or arrived.
5. No direct generic-record writes from Build 2 UI components.
6. No new device-specific JavaScript layout manipulation.
7. No new corrective patch files or parallel UI layers.
8. No duplicate desktop, tablet, and phone workflows.
9. No new global workflow functions.
10. No trainee PII expansion.
11. Every critical write must expose pending, success, failure, or conflict state.
12. Every migration must include forward validation and backward validation.

## Build 2 architecture direction

```text
Persistent backend records
        ↓
Record normalizers and typed repositories
        ↓
Pure GATE domain selectors and commands
        ↓
Application state and synchronization
        ↓
GATE Design Language components
        ↓
Responsive desktop, tablet, phone, and command-display compositions
```

## Data-state separation

### Server state

Persistent operational entities:

- config records;
- dorm records;
- bus records;
- archive records;
- sound events;
- future audit events.

### Derived state

Deterministic values calculated from server state:

- arrived totals;
- projected totals;
- active bus totals;
- receiving-night summaries;
- naturalization totals;
- Space Force totals;
- dorm state groups;
- processing duration and overtime state.

### UI state

Temporary presentation state:

- active route;
- selected record;
- open dialog or sheet;
- drawer state;
- search and filter state;
- unsaved form values;
- display preferences.

UI state may not become operational truth merely because it is visible.

## Migration method

Build 2 uses a strangler migration:

1. document current behavior and ownership;
2. create a pure Build 2 contract;
3. validate it against historical fixtures;
4. compare Build 1 and Build 2 outputs from the same records;
5. integrate one consumer behind a deliberate handoff;
6. validate all roles, workflows, and viewports;
7. retire the former owner;
8. document the resulting runtime.

A feature is not migrated while both old and new paths remain active without an explicit temporary compatibility contract.

## Governance required for every work package

Every package must define:

- operational intent;
- canonical owner;
- source records;
- data mutations;
- affected calculations;
- affected roles;
- affected viewports;
- forward acceptance criteria;
- backward compatibility criteria;
- validation fixtures;
- rollback boundary;
- legacy retirement action;
- documentation update.

## Build 2 phases

### Phase 1 — Operational Truth and Data Foundation

Establish metric provenance, canonical domain calculations, record normalization, repository boundaries, historical parity tests, and future conflict-aware persistence contracts.

### Phase 2 — GATE Design Language and Responsive Application Shell

Establish design tokens, modular components, accessibility contracts, responsive application compositions, and one route/permission registry.

### Phase 3 — Feature Migration and Legacy Retirement

Migrate Status Board, Processing, Airport, Input, Archives/Reports, and Squadron Board into the Build 2 architecture while retiring duplicate owners and corrective layers.

### Phase 4 — Enterprise Validation and Release Candidate

Execute browser, role, viewport, accessibility, performance, persistence, recovery, and operational workflow validation before release designation.

## Definition of done

A Build 2 change is complete only when:

- the source of truth is explicit;
- the calculation or command has one owner;
- historical fixtures pass;
- current Build 1 behavior is compared where applicable;
- runtime consumers are validated;
- no new bloat layer was introduced;
- obsolete ownership is removed or formally time-bounded;
- documentation matches the active runtime.
