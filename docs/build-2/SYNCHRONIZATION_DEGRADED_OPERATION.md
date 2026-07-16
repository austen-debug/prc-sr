# GATE Build 2 — Synchronization and Degraded Operation

Status: Gate E implementation contract  
Runtime status: staged; Build 1 remains operational

## Purpose

Gate E defines how Build 2 maintains a truthful operational picture across tabs and connectivity changes without creating a second client-side database or permitting unconfirmed offline writes.

## Authoritative-source rule

The records API remains authoritative. Browser state may contain one in-memory copy of the last successfully confirmed canonical record set for display continuity. That snapshot:

- is replaced only after a successful authoritative list request;
- is marked stale on cross-tab invalidation, offline transition, timeout, or synchronization failure;
- is not stored in localStorage, sessionStorage, IndexedDB, Cache Storage, or a mutation queue;
- never authorizes a critical write;
- is cleared when the host explicitly clears the synchronization context.

## Cross-tab contract

`BroadcastChannel` carries invalidation notices only.

Allowed notice fields:

```text
kind
contractVersion
entityType
entityId
weekGroup
operationId
occurredAt
originId
```

The channel does not carry records, counts, dorm loads, bus manifests, archive snapshots, audit metadata, user identity, or other operational payloads.

A receiving tab must:

```text
receive valid foreign-origin notice
→ mark the last-confirmed snapshot stale
→ mark critical writes read-only
→ refetch authoritative records
→ replace the in-memory snapshot only on success
→ restore write eligibility only when state is current and authoritative
```

A tab ignores its own notice. `BroadcastChannel` is an invalidation signal, never an operational source of truth.

## Synchronization states

```text
unknown
syncing
current
offline
stale
failed
```

A critical write is permitted only when all are true:

```text
online = true
status = current
authoritative = true
stale = false
refreshRequired = false
```

All other states are read-only.

## Degraded operation

When offline or stale, Build 2 may display the last-confirmed in-memory snapshot with:

- explicit offline/stale/failed status;
- last-synchronized timestamp when available;
- a read-only indicator;
- a statement that critical writes are disabled;
- no success indication for a blocked command.

The guarded records client returns `degraded_read_only` before calling the underlying transport. It records `queued: false`. Gate E does not implement background sync, retry queues, optimistic mutation replay, or local operational persistence.

## Connectivity behavior

### Offline event

```text
mark snapshot stale
→ status offline
→ authoritative false
→ critical writes disabled
→ continue read-only display of last-confirmed snapshot
```

### Online event

```text
status stale / refresh required
→ critical writes remain disabled
→ authoritative refetch
→ status current only on successful response
```

### Synchronization failure

The last-confirmed snapshot remains available but stale. Write eligibility remains disabled until a later successful refetch.

### Freshness timeout

A current snapshot becomes stale when it exceeds the configured synchronization interval. The timeout does not delete the snapshot; it disables critical writes and requires refresh.

## Static-shell cache boundary

The staged module service worker caches only the explicit Build 2 static-shell allowlist:

- GDL stylesheet;
- component stylesheet;
- shell stylesheet and modules;
- responsive stylesheet;
- accessibility stylesheet.

The service worker does not cache or queue:

- `/api/*` requests;
- operational records;
- audit events;
- archives;
- workflow payloads;
- authentication responses;
- HTML operational data;
- mutation requests.

Authoritative API requests are always network-only.

## Runtime activation rule

The Gate E coordinator and service worker registration helper remain staged. Build 1 does not register `gate-build-2-sw.js`, import synchronization modules, or consume the guarded Build 2 client.

A later route migration may register the service worker only after route-specific activation and rollback approval.

## Exit criteria

```text
PASS — identifier-only BroadcastChannel contract
PASS — foreign invalidation triggers authoritative refetch
PASS — sender notice is ignored locally
PASS — last-confirmed records remain in memory only
PASS — explicit current/offline/stale/failed states
PASS — last-synchronized context reaches shell presentation
PASS — critical writes fail closed outside current authoritative state
PASS — blocked writes are never queued
PASS — only static shell assets enter cache allowlist
PASS — API requests remain network-only
PASS — Build 1 does not load or register Gate E assets
PASS — all prior Build 2 regression suites remain green
```
