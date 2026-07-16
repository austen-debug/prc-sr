# GATE Build 2 — Program Traceability Matrix

Status: FOUNDATION ALIGNMENT CONTROL  
Purpose: map governing intent to implementation, validation, runtime ownership, and remaining gates.

| Requirement | Source owner | Validation | Runtime status | Remaining gate |
|---|---|---|---|---|
| No trainee PII expansion | Program baseline, repository/config/audit safeguards | normalization, repository, server, workflow, synchronization, component fixtures | Build 1 active; Build 2 staged | Continuous |
| Confirmed-arrival eligibility | `domain/operational-metrics.mjs` | operational truth and parity suites | Staged | Phase 3 consumer migration |
| Receiving Night One/Two from `arrived_at` | `domain/receiving.mjs` | historical 818/39 and boundary fixtures | Staged | Archives/Reports migration |
| Air Force, Space Force, female, NAT share one arrival set | `domain/operational-metrics.mjs` | domain and parity suites | Staged | Phase 3 consumer migration |
| Active Week Group has one owner | `domain/week-groups.mjs` and initialization workflow | Gate A, Gate B, and Gate D suites | Staged | Phase 3 integration |
| Last arrival is derived | `domain/arrivals.mjs` | Gate A domain suite | Staged | Status Board migration |
| Manifested bus log differs from arrived total | `domain/buses.mjs` | Gate A and parity suites | Staged | Airport migration |
| Dorm state grouping has one owner | `domain/dorms.mjs` | Gate A domain suite | Staged | Status/Squadron migration |
| Processing assignment and phase summaries have one owner | `domain/processing.mjs` | Gate A and Gate D suites | Staged | Processing migration |
| Timer/overtime calculation is deterministic | `domain/timers.mjs` | Gate A domain suite | Staged | Status/Processing integration |
| Status and Squadron summaries share truth | `domain/summaries.mjs` | Gate A domain suite | Staged | Status then Squadron migration |
| Current Summary and Archive Report share a model | `domain/reports.mjs` | Gate A domain suite | Staged | Archives/Reports migration |
| Archive snapshot is immutable and canonical | `domain/archives.mjs`, archive workflow | Gate A and Gate D suites | Staged | Phase 3 Archives migration |
| Build 1 records normalize without silent loss | `data/record-normalizer.mjs` | normalization, entity, parity suites | Staged compatibility boundary | Continuous migration validation |
| Domain consumes canonical entities directly | `data/canonical-entity.mjs`, `domain/normalization.mjs` | Gate B canonical entity suite | Staged | Phase 3 consumers |
| Legacy aliases stop at compatibility boundary | `data/legacy-compatibility.mjs`, `record-normalizer.mjs` | Gate B entity and config tests | Staged | Continuous enforcement |
| Creator/updater role provenance | data provenance plus records API | Gate B and Gate C tests | Server-enforced | Route-specific authorization |
| Unknown records remain recoverable | `record-normalizer.mjs` | normalization and Gate B entity suites | Staged | Continuous |
| Typed operational repositories | `data/repositories/*` | repository suite | Staged | Phase 3 workflow consumers |
| Critical writes require confirmed server success | Gate D workflow result and verification contracts | Gate D workflow suite | Implemented / staged | Route activation evidence |
| Server-enforced stale-write protection | records API and client | Gate C and Gate D conflict tests | Implemented | Continuous |
| Append-only audit events | audit repository, records API, D1 triggers | Gate C and Gate D tests | Implemented | Apply D1 migration to existing environment |
| Server-derived role provenance | API session bridge and records contract | Gate C tests | Implemented | Route-specific authorization |
| Squadron read-only records boundary | records API projection | Gate C tests | Implemented; login inactive | Phase 3 Squadron migration |
| Operation-scoped idempotency | `public/app/workflows/*`, archive/audit repositories | Gate D replay and resume tests | Implemented / staged | Phase 3 integration |
| Week Group initialization orchestration | `initialize-week-group.mjs` | Gate D success, validation, partial, resume, compensation tests | Implemented / staged | Phase 3 Input migration |
| Arrival and dorm transition orchestration | arrival and dorm workflows | Gate D verify/audit/conflict tests | Implemented / staged | Phase 3 Airport/Processing migration |
| Verified archive closeout | `archive-workflows.mjs` | Gate D create/verify/audit/clear/verify and resume tests | Implemented / staged | Phase 3 Archives migration |
| Immutable archive amendment | `amendArchiveWorkflow` | Gate D parent-preservation and lineage test | Implemented / staged | Phase 3 Archives migration |
| Explicit partial-failure recovery | workflow results and recovery workflows | Gate D audit retry, initialization resume/compensation, closeout resume tests | Implemented / staged | Route-specific presentation |
| Cross-tab authoritative refetch | `synchronization/invalidation-channel.mjs`, `sync-coordinator.mjs` | Gate E multi-tab and refetch suite | Implemented / staged | Gate F consolidated validation |
| Last-confirmed read-only snapshot | `synchronization/authoritative-store.mjs` | Gate E offline continuity and source-boundary tests | Implemented / staged | Gate F consolidated validation |
| Explicit offline/stale/last-sync behavior | synchronization state, shell bridge, shell selectors | Gate E state and shell-announcement suite | Implemented / staged | Gate F consolidated validation |
| Critical writes fail closed when authority is unavailable | `synchronization/guarded-records-client.mjs` | Gate E blocked-write and no-queue tests | Implemented / staged | Gate F consolidated validation |
| Static shell cache excludes operational data | offline cache policy and staged service worker | Gate E cache-policy and service-worker tests | Implemented / staged | Route-specific activation approval |
| One GATE Design Language | `design/*` | GDL suite | Staged | Route migration use |
| One component system | `components/*` | component suite | Staged | Route migration use |
| One route and permission registry | shell registries | shell suite | Staged | Route-specific server authorization |
| Capability-driven six-posture composition | `responsive/*` | responsive suite | Staged | Route-specific evidence |
| WCAG 2.2 AA foundation | `accessibility/*` | accessibility suite | Staged | Route-specific manual evidence |
| Squadron credentials remain server-side | environment bindings and repository safeguards | Gate C server boundary; future auth test | Not activated | Phase 3 Squadron migration |
| Status Board-first migration order | `PROGRAM_INTENT_BASELINE.md` | documentation gate | Approved, not started | Gate F then Phase 3 |
| Former owner retired after migration | Phase 3 route package | future ownership and middleware tests | Not started | Phase 3 |

## Approved route migration sequence

| Order | Route | Primary readiness burden |
|---:|---|---|
| 1 | Status Board | live parity, timer ownership, fullscreen/command display, rollback |
| 2 | Processing | write authorization, load conflicts, phase/timer behavior |
| 3 | Airport | dispatch, local arrival, arrival confirmation, count correction |
| 4 | Input | multi-record initialization, duplicate identity, recovery |
| 5 | Archives and Reports | shared report model, immutable snapshot, verified closeout/amendment |
| 6 | Squadron Board | server-side read-only authorization and limited-view evidence |

## Evidence rule

A requirement is not complete merely because it appears in documentation. Completion requires an identified source owner, executable validation where technically possible, explicit runtime status, and retirement of any competing owner after activation.
