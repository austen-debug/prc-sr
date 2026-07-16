# GATE Build 2 — Program Traceability Matrix

Status: FOUNDATION ALIGNMENT CONTROL  
Purpose: map governing intent to implementation, validation, runtime ownership, and remaining route evidence.

| Requirement | Source owner | Validation | Runtime status | Remaining evidence |
|---|---|---|---|---|
| No trainee PII expansion | Program baseline, repository/config/audit safeguards | normalization, repository, server, workflow, synchronization, component fixtures | Build 1 active; Build 2 staged | Continuous |
| Confirmed-arrival eligibility | `domain/operational-metrics.mjs` | operational truth, parity, and Gate F suites | Staged | Status Board shadow parity |
| Receiving Night One/Two from `arrived_at` | `domain/receiving.mjs` | historical 818/39 and boundary fixtures | Staged | Archives/Reports migration |
| Air Force, Space Force, female, NAT share one arrival set | `domain/operational-metrics.mjs` | domain, parity, and Gate F suites | Staged | Status Board shadow parity |
| Active Week Group has one owner | `domain/week-groups.mjs` and initialization workflow | Gate A, B, D, and F suites | Staged | Status Board shadow parity |
| Last arrival is derived | `domain/arrivals.mjs` | Gate A and F suites | Staged | Status Board shadow parity |
| Manifested bus log differs from arrived total | `domain/buses.mjs` | Gate A, parity, and F suites | Staged | Airport migration |
| Dorm state grouping has one owner | `domain/dorms.mjs` | Gate A and F suites | Staged | Status Board shadow parity |
| Processing assignment and phase summaries have one owner | `domain/processing.mjs` | Gate A, D, and F suites | Staged | Processing migration |
| Timer/overtime calculation is deterministic | `domain/timers.mjs` | Gate A and F suites | Staged | Status Board timer evidence |
| Status and Squadron summaries share truth | `domain/summaries.mjs` | Gate A and F suites | Staged | Status then Squadron migration |
| Current Summary and Archive Report share a model | `domain/reports.mjs` | Gate A and F suites | Staged | Archives/Reports migration |
| Archive snapshot is immutable and canonical | `domain/archives.mjs`, archive workflow | Gate A, D, and F suites | Staged | Archives route evidence |
| Build 1 records normalize without silent loss | `data/record-normalizer.mjs` | normalization, entity, parity, and F suites | Staged compatibility boundary | Continuous migration validation |
| Domain consumes canonical entities directly | canonical entity and domain boundary | Gate B and F suites | Staged | Route consumers |
| Legacy aliases stop at compatibility boundary | compatibility adapters | Gate B, data, and F suites | Staged | Continuous enforcement |
| Creator/updater role provenance | data provenance plus records API | Gate B, C, and F suites | Server-enforced | Route-specific authorization |
| Unknown records remain recoverable | record normalizer | Gate B, data, and F suites | Staged | Continuous |
| Typed operational repositories | `data/repositories/*` | data and F suites | Staged | Route workflow consumers |
| Critical writes require confirmed server success | workflow result and verification contracts | Gate D and F suites | Implemented / staged | Route activation evidence |
| Server-enforced stale-write protection | records API and client | Gate C, D, and F suites | Implemented | Deployed API verification before production writes |
| Append-only audit events | audit repository, records API, D1 triggers | Gate C, D, and F suites | Implemented in source | Existing D1 trigger verification before production writes |
| Server-derived role provenance | API session bridge and records contract | Gate C and F suites | Implemented | Deployed binding verification |
| Squadron read-only records boundary | records API projection | Gate C and F suites | Implemented; login inactive | Squadron migration |
| Operation-scoped idempotency | workflows and archive/audit repositories | Gate D and F suites | Implemented / staged | Route integration |
| Week Group initialization orchestration | initialization workflow | Gate D and F suites | Implemented / staged | Input migration |
| Arrival and dorm transition orchestration | arrival and dorm workflows | Gate D and F suites | Implemented / staged | Airport/Processing migration |
| Verified archive closeout | archive workflow | Gate D and F suites | Implemented / staged | Archives migration |
| Immutable archive amendment | archive workflow | Gate D and F suites | Implemented / staged | Archives migration |
| Explicit partial-failure recovery | workflow results and recovery workflows | Gate D and F suites | Implemented / staged | Route-specific presentation |
| Cross-tab authoritative refetch | invalidation channel and coordinator | Gate E and F suites | Implemented / staged | Status Board shadow evidence |
| Last-confirmed read-only snapshot | authoritative store | Gate E and F suites | Implemented / staged | Route presentation evidence |
| Explicit offline/stale/last-sync behavior | sync state, shell bridge, selectors | Gate E and F suites | Implemented / staged | Route manual evidence |
| Critical writes fail closed when authority is unavailable | guarded records client | Gate E and F suites | Implemented / staged | Route integration |
| Static shell cache excludes operational data | cache policy and staged service worker | Gate E and F suites | Implemented / staged | Service-worker activation review |
| One GATE Design Language | `design/*` | design and F suites | Staged | Route use |
| One component system | `components/*` | component and F suites | Staged | Route use |
| One route and permission registry | shell registries | shell and F suites | Staged | Route-specific server authorization |
| Capability-driven six-posture composition | `responsive/*` | responsive and F suites | Staged | Route-specific evidence |
| WCAG 2.2 AA foundation | `accessibility/*` | accessibility and F suites | Staged | Route-specific manual evidence |
| Squadron credentials remain server-side | environment bindings and safeguards | Gate C and F source controls | Not activated | Squadron migration |
| Foundation exit decision is corrected | `CORRECTED_PHASE_1_EXIT_DECISION.md` | Gate F governance suite | Implemented / validation pending | Final-head Gate F CI |
| External deployment state is not inferred | `DEPLOYMENT_PREREQUISITES.md` | Gate F governance suite | Documented prerequisite | Environment verification |
| Status Board-first migration order | program baseline | Gate F governance suite | Approved | Phase 3A shadow package |
| Status Board shadow authorization is bounded | shadow authorization document | Gate F governance suite | Authorized after Gate F closure | Shadow parity evidence |
| Former owner retired only after activation | Phase 3 route package | future ownership and middleware tests | Not started | Production acceptance |

## Approved route migration sequence

| Order | Route | Primary readiness burden |
|---:|---|---|
| 1 | Status Board | hidden parity, timer ownership, fullscreen/command display, stale/offline, rollback |
| 2 | Processing | write authorization, load conflicts, phase/timer behavior |
| 3 | Airport | dispatch, local arrival, arrival confirmation, count correction |
| 4 | Input | multi-record initialization, duplicate identity, recovery |
| 5 | Archives and Reports | shared report model, immutable snapshot, verified closeout/amendment |
| 6 | Squadron Board | server-side read-only authorization and limited-view evidence |

## Evidence rule

A requirement is not complete merely because it appears in documentation. Completion requires an identified source owner, executable validation where technically possible, explicit runtime status, and retirement of any competing owner after accepted production activation.
