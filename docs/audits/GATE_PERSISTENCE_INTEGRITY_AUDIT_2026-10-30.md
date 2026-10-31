# GATE persistence integrity audit — 30 October 2026

## Scope and evidence

Static source review of active Cloudflare Functions, D1 SQLite transaction boundaries, typed mirror triggers, client-side workflow ownership, generic records CRUD, archives and amendments, and tests. Inspected: `functions/api/records.js`, `records-contract.mjs`, `legacy-closeout.js`, `persistence.js`, `persistence-core.mjs`, `functions/api/_middleware.js`, `archives.js`, `admin-archives.js`, `public/index.html`, `public/js/gate-input-page-controller.js`, `gate-archive-controller.js`, `gate-persistence-runtime.js`, `public/app/data/records-client.mjs`, `public/app/workflows/archive-workflows.mjs`, migrations 0003/0004/0011 contracts, and related test suites.

**Boundaries:** This is a code audit, not a certified production D1 database audit. GitHub merges and Cloudflare Pages previews do not prove deployed production code, active feature flags, remote D1 trigger installation, backup availability, or remediation of WG27003. Never conflate fixture test counts with production counts.

## Architecture and ownership

- `records` is the original operational authority; five `gate_v2_*` tables become transactional mirrors only with required D1 triggers and cutover readiness.
- Active group initialization: `POST /api/persistence` `initialize_legacy` or transactional `initialize`, both server-side batches. In-memory/client `batchRows` is not authoritative.
- Closeout: `POST /api/legacy-closeout` or transactional `closeout`, both server-owned D1 batches with exact source snapshot; archive is created and verified before live source deletion and config reset.
- Archives are immutable; amendments/dispositions append metadata and require independently verified schemas. `/api/archives` is canonical historical read surface.
- `/api/records` generic writes must preserve version/provenance and never mutate archived-cycle operational records.

## Findings and fixes

| Priority | Finding | Mitigation |
|---|---|---|
| P0 | Inline HTML still contained an archive-create then per-record delete closeout, which could delete live data even if archive POST failed | Replaced with fail-closed fallback; canonical archive controller exclusively owns actual closeout |
| P0 | Inline HTML still contained a non-atomic config update + per-dorm initialization loop | Replaced with fail-closed fallback; canonical server initialization remains |
| P0 | Existing archive detection used archived timestamps vs live-record timestamps; newer residual records could bypass the archive check and produce a duplicate | Now match **all** archives with same Week Group label, including old or reporting-only archives. Reused labels require deliberate reconciliation |
| P0 | Partial-closeout recovery accepted snapshot ID subset without validating complete archive metadata | Requires `lossless-record-rows-v1`, source count and dorm/bus count parity, valid archived time, original row timestamps and byte-exact remaining rows |
| P0 | Recovery was blocked if all buses/dorms had been deleted and only sound events survived | Existing-archive recovery is now evaluated before the nonempty bus/dorm precondition |
| P0 | Stale browser sessions could create or mutate live bus/dorm/sound records after a Week Group archive existed | Generic records POST/PUT/DELETE returns 409 `week_group_archived` for the affected label |
| P1 | Failure of canonical UI controller could expose fragile inline fallback behavior | Explicit no-write error rather than silent partial mutation; runtime regression tests added |
| P1 | Code and runtime status can diverge from remote D1 | Existing read-only cutover preflight and operator backup/parity procedure retained |

## Validated contracts / reviewed protections

- Archive row built from complete ordered `id,type,week_group,data,created_at,updated_at` original records; single D1 batch asserts exact snapshot, inserts archive, verifies it, deletes scoped rows, verifies removal and clears active config.
- Transactional `closeout` records cycle state, idempotency key and audit event in same batch, and refuses unresolved conflicting operations.
- Generic bus/dorm PUT/DELETE enforce record version preconditions; field-level rebases require unchanged base values.
- Operational accounting includes an SQL-time guard for competing dorm/bus updates; server validates nonnegative integral bus/dorm counts.
- Cutover feature flags are two-step and preflight checks schema, required trigger definitions, typed mirror row parity, and lifecycle state.
- Archive mutation and audit mutation paths are separated from generic records CRUD.

## Remaining operational gates / residual risk

1. Confirm exact intended production D1 binding, independent backup / D1 Time Travel bookmark, production schema and migration ledger. Code cannot perform or verify these remotely through GitHub.
2. Run `docs/incidents/WG27003_CLOSEOUT_RECONCILIATION_2026-10-30.md` read-only SQL and compare archived source records with residual rows. Historical reporting-only archives will **not** qualify for automatic recovery, by design.
3. Verify actual production Cloudflare deployment / custom domain release after merge; review whether long-lived clients require full reload. Existing open clients may run older JavaScript until reloaded.
4. Validate current live data source/mirror parity and required trigger presence before enabling `GATE_PERSISTENCE_ENABLED` and `GATE_PERSISTENCE_CUTOVER_READY`.
5. Stage simulated interrupted closeout, duplicate same-label archives, API read failure, concurrent bus/dorm changes, and archival report access on isolated D1.
6. Reconcile WG27003 archived arrivals (893) vs observed live arrivals (858); no code change proves which live records are missing.
7. Preserve unmodified historical snapshots and append-only provenance. Do not auto-clear records if source snapshot is unavailable, changed or incomplete.

## Acceptance criteria

- All dedicated server and runtime regression tests green, no known duplicate-archive bypass, no legacy inline lifecycle writes.
- Repeated closeout/initialization cannot double-write or delete unrelated Week Groups.
- Archived-label generic operational writes blocked with an explicit 409.
- Corrupt, amended, duplicate, missing or reporting-only source snapshot blocks automatic recovery with residual records untouched.
- Production recovery is acknowledged only on confirmed remote D1 state; archive remains accessible and content-identical.

## Limitations

No cloud D1 credentials, database management, Cloudflare deployment management, or private operational data were accessed as part of this audit. Source inspection and GitHub CI cannot certify live service health.
