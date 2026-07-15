# GATE Build 2 — Critical Workflow Orchestration Contract

Status: FOUNDATION ALIGNMENT GATE D  
Runtime status: staged; Build 1 feature routes remain active

## Purpose

Gate D coordinates the named repository commands established in Gates B and C into verified operational workflows. A critical workflow may report completion only after required persistence, authoritative refetch, state verification, and append-only audit steps succeed.

The backend still reports:

```text
transactions: false
batchWrites: false
```

Gate D therefore uses explicit saga-style checkpoints rather than claiming unsupported atomic multi-record transactions.

## Workflow result contract

Every workflow returns:

```js
{
  ok,
  workflow,
  operationId,
  status,
  phase,
  message,
  data,
  error,
  completedSteps,
  pendingSteps,
  recovery,
  unchanged
}
```

Supported status values:

- `complete`
- `partial`
- `failed`
- `conflict`
- `blocked`

Supported phases:

- `validate`
- `load`
- `persist`
- `verify`
- `audit`
- `clear`
- `complete`

A `partial` result means at least one authoritative write may already be committed. The host must display the actual completed and pending steps and use the supplied recovery command. It may not display a generic success message.

## Operation identifiers

Every critical workflow has an operation ID. Retrying a partial workflow must reuse the same operation ID.

Operation IDs provide:

- audit idempotency;
- archive idempotency;
- initialization lineage;
- closeout resume identity;
- recovery correlation;
- duplicate-operation detection.

A retry with a new operation ID is a new operation, not a continuation.

## Required sequence

```text
validate
  ↓
load authoritative state
  ↓
persist with expected record version
  ↓
refetch authoritative state
  ↓
verify required postcondition
  ↓
append required audit event
  ↓
report complete
```

A stale conditional write returns `conflict`. An audit failure after a verified write returns `partial` with an idempotent audit-retry command.

## Airport and arrival workflows

Implemented workflows:

- `dispatchAirportBusWorkflow`
- `createLocalArrivalWorkflow`
- `confirmArrivalWorkflow`
- `correctArrivalCountsWorkflow`

Each workflow:

1. executes a named bus repository command;
2. refetches the bus from the records service;
3. verifies active, local-arrived, confirmed-arrived, or corrected-count state;
4. appends one operation-scoped audit event;
5. returns explicit conflict, partial, or complete state.

## Dorm workflows

Implemented workflows:

- `updateDormLoadWorkflow`
- `openDormWorkflow`
- `closeDormWorkflow`
- `reopenDormWorkflow`
- `correctDormFinalTimeWorkflow`

Each dorm transition records the prior and resulting record versions. Reopen and final-time correction continue using their explicit compatibility overrides, while the records API remains the final stale-write and dorm-state protection layer.

## Week Group initialization

`initializeWeekGroupWorkflow` uses this sequence:

```text
validate Week Group, windows, capacities, and duplicate Squadron/Dorm identity
  ↓
confirm no conflicting active Week Group
  ↓
confirm no unrelated live dorms for the target Week Group
  ↓
create one dorm
  ↓
verify the dorm
  ↓
audit the dorm creation
  ↓
repeat for every dorm
  ↓
set active Week Group
  ↓
verify active Week Group
  ↓
audit Week Group initialization
```

The active Week Group is deliberately set last. A partial dorm set therefore does not become the active operation.

Dorm records preserve:

- initialization operation ID;
- deterministic dorm identity;
- display/input order;
- source row index;
- receiving windows.

Retrying with the same operation ID resumes verified dorm creation rather than duplicating existing dorms.

`compensatePartialInitializationWorkflow` may remove only dorms created by the identified partial operation and only while that Week Group is not active. Unrelated live records or active status block automated compensation.

## Archive closeout

`closeoutWeekGroupWorkflow` uses this sequence:

```text
refetch buses, dorms, sound events, active Week Group, and last-airport config
  ↓
build canonical immutable snapshot
  ↓
create archive with operation ID and closeout manifest
  ↓
refetch and verify archive
  ↓
audit archive creation
  ↓
clear versioned dorm, bus, and sound-event records
  ↓
verify each record absence
  ↓
audit each cleared record
  ↓
clear last_airport and week_group config
  ↓
verify empty config values
  ↓
audit config clearing
  ↓
verify no eligible live state remains
  ↓
audit closeout completion
```

No live record is cleared before archive verification and archive audit.

The archive closeout manifest preserves:

- bus IDs;
- dorm IDs;
- sound-event IDs;
- config IDs;
- each record's pre-clear version.

A retry with the same operation ID reuses the existing archive, repairs any missing deletion audits from the manifest, and continues only the remaining clear steps.

## Archive amendments

`amendArchiveWorkflow` never updates the parent archive.

It requires:

- parent archive ID;
- amendment reason;
- valid canonical snapshot for the same Week Group;
- operation ID;
- actor role.

The workflow creates and verifies a new archive containing:

- `archive_kind: amendment`;
- `parent_archive_id`;
- `amendment_reason`;
- incremented amendment number;
- operation ID.

It then appends an `archive_amended` event. The original archive remains byte-for-byte unchanged.

## Recovery workflows

- `retryRequiredAuditWorkflow` appends a missing audit event idempotently.
- Re-running initialization with the same operation ID resumes partial initialization.
- `compensatePartialInitializationWorkflow` safely removes an inactive partial dorm set.
- Re-running closeout with the same operation ID resumes from the verified archive and closeout manifest.
- Re-running an already completed operation returns `complete` with `unchanged: true` when completion evidence exists.

## Prohibited patterns

- UI code chaining generic records API calls for a critical workflow;
- claiming success before authoritative verification;
- clearing live records before archive verification;
- setting the active Week Group before all initialization dorms exist;
- overwriting a parent archive during correction;
- generating a new operation ID while attempting to resume a partial workflow;
- swallowing an audit failure after a committed write;
- queued or optimistic critical writes while offline;
- treating a multi-record saga as a database transaction.

## Runtime boundary

Gate D adds staged modules under `public/app/workflows/` and extends staged repositories and canonical archive metadata. It does not load workflow modules through active middleware, replace Build 1 feature controllers, or activate a Build 2 route.
