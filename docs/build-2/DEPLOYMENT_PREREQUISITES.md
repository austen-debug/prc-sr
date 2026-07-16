# GATE Build 2 — Deployment Prerequisite Register

Status: GOVERNING DEPLOYMENT CONTROL  
Scope: requirements that cannot be proven solely by repository source and unit/integration simulation

## Purpose

Foundation completion and production activation are different decisions. Repository source, deterministic fixtures, handler simulations, and CI can prove the Build 2 architecture and contracts. They cannot independently prove the configuration or migration state of an external Cloudflare deployment.

## Current prerequisite status

| Prerequisite | Repository evidence | Environment evidence | Effect |
|---|---|---|---|
| Gate C records API deployed | versioning, conditional-write, role-provenance, and append-only handler tests | Not independently verified | Required before any Build 2 route performs a production write |
| D1 migration `0002_gate_c_append_only_audit.sql` applied | migration exists; `schema.sql` contains matching triggers | Not independently verified | Required before production write-heavy route activation; database defense in depth |
| Session secret and role bindings configured | server-side session bridge exists and tests pass | Not independently verified | Required before any Build 2 authenticated route activation or controlled authenticated test surface |
| Squadron credentials configured | contract requires server-side bindings only | Squadron login remains inactive | Required only before Squadron Board migration |
| Build 2 service worker scope reviewed | cache allowlist and network-only API tests pass | Not registered by Build 1 | Required before any service-worker activation |
| Rollback deployment path exercised | route packages define rollback | Status Board shadow rollback is documented but not yet exercised in a controlled environment | Required separately before a controlled or production route surface |
| Production accessibility review | automated foundation and Status Board route contracts pass | Manual route evidence not yet retained | Required separately for every route activation |
| Production responsive/posture review | six-posture foundation and route contracts pass | Route-specific evidence not yet retained | Required separately for every route activation |

## Status Board controlled test-surface prerequisites

Before Phase 3B may be authorized, retained evidence must identify:

1. the controlled environment;
2. the authoritative read-only records path used by the test surface;
3. verified session and route-role bindings;
4. a feature flag or equivalent activation control that defaults off;
5. the exercised rollback deployment path;
6. confirmation that the Build 2 service worker remains inactive;
7. retained manual accessibility evidence;
8. retained six-posture responsive evidence.

The Status Board evidence-review evaluator accepts only verification metadata and artifact references. It rejects secret, token, password, credential, and cookie fields.

## D1 verification procedure

Before a write-capable Build 2 route activates in an existing environment:

1. apply the repository migration through the approved Cloudflare D1 deployment procedure;
2. query `sqlite_master` for `prevent_audit_event_update` and `prevent_audit_event_delete`;
3. create a disposable audit event in a controlled test environment;
4. confirm update and delete attempts fail with the append-only trigger response;
5. retain the deployment log and verification result with the route migration evidence;
6. do not perform destructive verification against an operational audit record.

## Authorization impact

The unverified external prerequisites do **not** block a hidden, read-only Status Board shadow calculation or pure evidence evaluation that consumes no secrets and changes no routing or operational state.

They do block:

- Phase 3B controlled authenticated test-surface authorization;
- production Build 2 route activation;
- Build 2 critical writes;
- retirement of a Build 1 feature owner;
- Squadron login activation;
- service-worker registration in the operational application.

## Evidence rule

A route package may mark an environment prerequisite complete only with an identified environment, timestamp, operator or deployment role, verification method, artifact reference, and retained result. Repository presence alone is not deployment proof. Personal identity fields and deployment secrets must not be retained in the Status Board review packet.
