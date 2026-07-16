# GATE Build 2 — Deployment Prerequisite Register

Status: GOVERNING DEPLOYMENT CONTROL  
Scope: requirements that cannot be proven solely by repository source and unit/integration simulation

## Purpose

Foundation completion and production activation are different decisions. Repository source, deterministic fixtures, handler simulations, and CI can prove the Build 2 architecture and contracts. They cannot independently prove the configuration or migration state of an external Cloudflare deployment.

## Current prerequisite status

| Prerequisite | Repository evidence | Environment evidence | Effect |
|---|---|---|---|
| Gate C records API deployed | versioning, conditional-write, role-provenance, and append-only handler tests | Not independently verified in Gate F | Required before any Build 2 route performs a production write |
| D1 migration `0002_gate_c_append_only_audit.sql` applied | migration exists; `schema.sql` contains matching triggers | Not independently verified in Gate F | Required before production write-heavy route activation; database defense in depth |
| Session secret and role bindings configured | server-side session bridge exists and tests pass | Not independently verified in Gate F | Required before any Build 2 authenticated route activation |
| Squadron credentials configured | contract requires server-side bindings only | Squadron login remains inactive | Required only before Squadron Board migration |
| Build 2 service worker scope reviewed | cache allowlist and network-only API tests pass | Not registered by Build 1 | Required before any service-worker activation |
| Rollback deployment path exercised | route packages must define rollback | No Build 2 route activated | Required separately for every route activation |
| Production accessibility review | automated foundation suite passes | Manual route evidence not yet collected | Required separately for every route activation |
| Production responsive/posture review | six-posture foundation suite passes | Route-specific evidence not yet collected | Required separately for every route activation |

## D1 verification procedure

Before a write-capable Build 2 route activates in an existing environment:

1. apply the repository migration through the approved Cloudflare D1 deployment procedure;
2. query `sqlite_master` for `prevent_audit_event_update` and `prevent_audit_event_delete`;
3. create a disposable audit event in a controlled test environment;
4. confirm update and delete attempts fail with the append-only trigger response;
5. retain the deployment log and verification result with the route migration evidence;
6. do not perform destructive verification against an operational audit record.

## Authorization impact

The unverified external prerequisites do **not** block a hidden, read-only Status Board shadow calculation that consumes the same authorized records without changing routing or operational state.

They do block:

- production Build 2 route activation;
- Build 2 critical writes;
- retirement of a Build 1 feature owner;
- Squadron login activation;
- service-worker registration in the operational application.

## Evidence rule

A route package may mark an environment prerequisite complete only with an identified environment, timestamp, operator or deployment identity, verification method, and retained result. Repository presence alone is not deployment proof.
