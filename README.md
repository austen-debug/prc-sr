# GATE — Gateway Arrival Tracking Environment

GATE is the unclassified operational throughput environment for Pfingston Reception Center receiving. It provides one operational picture from airport and local arrival through PRC processing, dormitory movement, command-display awareness, closeout, and historical review.

## Data boundary

GATE stores operational counts, timestamps, workflow state, dorm configuration, approved staff assignment, and historical receiving summaries.

It does not store trainee names, trainee-level records, orders data, or expanded trainee PII. Cloudflare credentials and session secrets remain server-side and may not enter records, browser storage, client bundles, archives, logs, or documentation values.

## Operational workflow

```text
Airport / local arrival
        ↓
confirmed PRC arrival
        ↓
Processing and dorm assignment
        ↓
dorm open / phase / load / close
        ↓
Status Board and command awareness
        ↓
verified immutable archive closeout
```

### Airport

- Maintain final airport-arrival planning context.
- Dispatch and track airport buses.
- Confirm arrivals and record approved population counts.
- Add local buses and local arrivals.
- Correct bus records through authorized workflows.

### Input

- Configure the Week Group, dorm identities, capacities, indicators, and receiving windows.
- Reject incomplete windows and duplicate dorm identities.
- Initialize expected strength and the operational dorm set.

### Processing

- Update dorm load, phase, assignment, and approved location context.
- Open, close, reopen, and correct dorm processing state.
- Preserve Female, Band, and Space Force indicators.

### Status Board

- Display Arrived and Expected strength.
- Display arrival-time and local-time context.
- Display active buses and Empty, Open, and Closed dorm regions.
- Display load, phase, timer, overtime, and operational indicators.
- Support fullscreen command-display use.

### Archives and reports

- Review immutable closed Week Groups and operational rollups.
- Print/PDF archived reports and the current receiving summary.
- Record corrections as amendments rather than silent archive overwrites.

### Squadron Board

- Provide a limited, read-only operational display.
- Hide staff assignment, location detail, internal notes, archives, and audit data.

## Access roles

### Instructor access

Instructor access controls the structure and authority of the operation and includes all six approved routes.

### Airman access

Airman access supports live Status Board and Processing execution without exposing Instructor-only controls.

Airman access does not include Squadron Board and does not initialize week groups, dispatch airport buses, open or close dorms, right-click edit dorm records, close out week groups, or access Archives.

### Squadron access

Squadron access is read-only and limited to Squadron Board. Squadron credentials are supplied through server-side Cloudflare environment bindings and may not be persisted in application records or exposed in client assets.

Navigation visibility is not authorization. The server remains authoritative.

## Current runtime

Build 1 remains the only visible operational application.

Cloudflare middleware currently serves:

- 13 directly injected stylesheets;
- 3 imported stylesheets;
- 28 directly injected scripts;
- one hidden, read-only Phase 3A Status Board shadow observer.

The current order and ownership are documented in [`docs/ACTIVE_RUNTIME_STACK.md`](./docs/ACTIVE_RUNTIME_STACK.md). The machine-readable ceiling is [`docs/build-2/ACTIVE_RUNTIME_BUDGET.json`](./docs/build-2/ACTIVE_RUNTIME_BUDGET.json).

No new corrective, patch, fix, restoration, finalizer, cleanup, or stability asset may be activated. A visible Build 2 route must reduce the active asset count and retire the competing Build 1 owner.

## Build 2 status

Completed or staged:

- canonical operational truth and entity boundaries;
- typed repositories, server versions, conflicts, and role provenance;
- append-only audit ownership;
- critical workflow orchestration and recovery;
- synchronization and degraded-operation contracts;
- GATE Design Language, components, shell, responsive, and accessibility foundations.

Active:

- hidden, read-only Status Board shadow comparison;
- memory-only aggregate parity evidence.

Not authorized:

- Phase 3B controlled test surface;
- visible Build 2 production route;
- Build 2 production critical writes;
- Build 1 Status Board retirement;
- operational Build 2 service-worker registration;
- Squadron login activation.

The current program position is maintained in [`docs/build-2/INDEX.md`](./docs/build-2/INDEX.md). The governing mission and constraints are maintained in [`docs/build-2/PROGRAM_INTENT_BASELINE.md`](./docs/build-2/PROGRAM_INTENT_BASELINE.md).

## Migration order

```text
1. Status Board
2. Processing
3. Airport
4. Input
5. Archives and Reports
6. Squadron Board
```

Each route migration must preserve operational behavior, prove responsive and accessibility behavior, define activation and rollback, and retire the former owner after acceptance.

## Status Board cleanup gate

Before Phase 3B may be considered:

- live and manual evidence must be complete;
- Latest Confirmed Arrival and Final Airport Arrival must be separate concepts;
- phone portrait metrics must preserve the approved two-by-two composition;
- every right-click action must have visible keyboard and touch parity;
- the active Status Board stack must meet [`docs/build-2/STATUS_BOARD_RETIREMENT_MANIFEST.md`](./docs/build-2/STATUS_BOARD_RETIREMENT_MANIFEST.md);
- external API, database, session-binding, accessibility, responsive, and rollback prerequisites must be verified.

## Development rules

- Preserve Build 1 until the replacement owner is accepted.
- Do not add parallel route, component, calculation, or responsive systems.
- Do not add page-specific corrective CSS.
- Do not add broad mutation observers or polling when lifecycle/store events can own the update.
- Do not queue offline operational writes.
- Do not infer external deployment state from repository source.
- Use semantic GDL tokens and shared components.
- Keep evidence and workshop utilities outside active middleware and routing.
