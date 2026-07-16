# GATE Build 2 — Program Traceability Matrix

Status: FOUNDATION COMPLETE / PHASE 3A SHADOW ACTIVE / AUDIT REMEDIATION IN EXECUTION  
Purpose: map governing intent to implementation, validation, runtime ownership, and remaining route evidence.

| Requirement | Source owner | Validation | Runtime status | Remaining evidence |
|---|---|---|---|---|
| No trainee PII expansion | Program baseline, repository/config/audit safeguards | normalization, repository, server, workflow, synchronization, component, and Phase 3A fixtures | Build 1 active; Phase 3A shadow active | Continuous |
| Confirmed-arrival eligibility | `domain/operational-metrics.mjs`, Status Board shadow snapshot | operational truth, parity, Gate F, and Phase 3A suites | Hidden shadow active | Sustained live parity and mismatch disposition |
| Receiving Night One/Two from `arrived_at` | `domain/receiving.mjs` | historical 818/39 and boundary fixtures | Staged | Archives/Reports migration |
| Air Force, Space Force, female, NAT share one arrival set | `domain/operational-metrics.mjs` | domain, parity, Gate F, and Phase 3A foundation regression | Hidden calculation available | Live route evidence where populations are present |
| Active Week Group has one owner | `domain/week-groups.mjs` and initialization workflow | Gates A, B, D, F, and Phase 3A | Hidden shadow active | Sustained live context evidence |
| Latest Confirmed Arrival and Final Airport Arrival are separate concepts | `STATUS_BOARD_UX_DECISIONS.md`, arrival domain, configuration compatibility | Phase 3A mismatch fixture and Audit Remediation Gate 1 governance | Decision recorded; Build 1 remains ambiguous | Like-for-like shadow capture and later passing samples |
| Manifested bus log differs from arrived total | `domain/buses.mjs` | Gates A, F, parity, and Phase 3A active-bus tests | Hidden shadow active for board subset | Airport migration |
| Dorm state grouping has one owner | `domain/dorms.mjs`, Status Board snapshot | Gates A, F, and Phase 3A | Hidden shadow active | Sustained live state and membership parity |
| Processing assignment and phase summaries have one owner | `domain/processing.mjs` | Gates A, D, and F | Staged | Processing migration |
| Timer/overtime calculation is deterministic | `domain/timers.mjs`, Status Board timer policy | Gates A, F, and Phase 3A 40/50/60 tests | Hidden shadow active | Live timer and manual command-display evidence |
| Status and Squadron summaries share truth | `domain/summaries.mjs` | Gates A and F | Staged | Status then Squadron migration |
| Current Summary and Archive Report share a model | `domain/reports.mjs` | Gates A and F | Staged | Archives/Reports migration |
| Archive snapshot is immutable and canonical | `domain/archives.mjs`, archive workflow | Gates A, D, and F | Staged | Archives route evidence |
| Build 1 records normalize without silent loss | `data/record-normalizer.mjs` | normalization, entity, parity, Gate F, and Phase 3A | Active shadow compatibility boundary | Continuous migration validation |
| Domain consumes canonical entities directly | canonical entity and domain boundary | Gates B, F, and Phase 3A | Active in shadow | Route consumers |
| Legacy aliases stop at compatibility boundary | compatibility adapters | Gate B, data, Gate F, and Phase 3A | Active in shadow | Continuous enforcement |
| Creator/updater role provenance | data provenance plus records API | Gates B, C, and F | Server-enforced | Route-specific authorization |
| Unknown records remain recoverable | record normalizer | Gate B, data, and Gate F | Staged | Continuous |
| Typed operational repositories | `data/repositories/*` | data and Gate F | Staged | Route workflow consumers |
| Critical writes require confirmed server success | workflow result and verification contracts | Gates D and F | Implemented / staged | Write-capable route activation evidence |
| Server-enforced stale-write protection | records API and client | Gates C, D, and F | Implemented | Deployed API verification before production writes |
| Append-only audit events | audit repository, records API, D1 triggers | Gates C, D, and F | Implemented in source | Existing D1 trigger verification before production writes |
| Server-derived role provenance | API session bridge and records contract | Gates C and F | Implemented | Deployed binding verification |
| Squadron read-only records boundary | records API projection | Gates C and F | Implemented; login inactive | Squadron migration |
| Operation-scoped idempotency | workflows and archive/audit repositories | Gates D and F | Implemented / staged | Route integration |
| Week Group initialization orchestration | initialization workflow | Gates D and F | Implemented / staged | Input migration |
| Arrival and dorm transition orchestration | arrival and dorm workflows | Gates D and F | Implemented / staged | Airport/Processing migration |
| Verified archive closeout | archive workflow | Gates D and F | Implemented / staged | Archives migration |
| Immutable archive amendment | archive workflow | Gates D and F | Implemented / staged | Archives migration |
| Explicit partial-failure recovery | workflow results and recovery workflows | Gates D and F | Implemented / staged | Route-specific presentation |
| Cross-tab authoritative refetch | invalidation channel, coordinator, Status Board sync adapter | Gates E, F, and route-specific Phase 3A invalidation test | Automated route evidence complete | Live multi-tab observation |
| Last-confirmed read-only snapshot | authoritative store | Gates E and F | Implemented / staged | Route presentation evidence |
| Explicit offline/stale/last-sync behavior | sync state, shell bridge, selectors | Gates E and F | Implemented / staged | Manual Status Board degraded-state evidence |
| Critical writes fail closed when authority is unavailable | guarded records client | Gates E and F | Implemented / staged | Write-capable route integration |
| Static shell cache excludes operational data | cache policy and staged service worker | Gates E and F | Implemented / staged | Service-worker activation review |
| One GATE Design Language | `design/*` | design and Gate F suites | Staged | Visible route use |
| One component system | `components/*` | component and Gate F suites | Staged | Visible route use |
| One route and permission registry | shell registries | shell, Gate F, and Phase 3A no-shadow-route test | Six visible routes unchanged | Route-specific server authorization |
| Capability-driven six-posture composition | responsive foundation plus Status Board route contract | responsive, Gate F, Phase 3A fixture, and Audit Remediation Gate 1 | Automated route contract complete; phone portrait two-by-two restored | Manual six-posture captures |
| Right-click actions have visible keyboard and touch parity | `STATUS_BOARD_UX_DECISIONS.md` and future route action contracts | Audit Remediation Gate 1 governance; future route interaction tests | Decision recorded; legacy right-click remains | Processing/Status action inventory and manual evidence |
| WCAG 2.2 AA foundation | accessibility foundation plus Status Board route contract | accessibility, Gate F, and Phase 3A automated contracts | Automated route contract complete | Manual keyboard/screen-reader/contrast/reflow evidence |
| Fullscreen/command-display behavior | Status Board fullscreen contract | Phase 3A automated contract | Automated route contract complete | Manual entry/exit/Escape/focus-restoration evidence |
| Squadron credentials remain server-side | environment bindings and safeguards | Gate C and F source controls | Not activated | Squadron migration |
| Active middleware asset growth is prohibited | `ACTIVE_RUNTIME_BUDGET.json`, `ACTIVE_RUNTIME_STACK.md` | `active-runtime-budget.test.mjs` | Build 1 baseline governed | Gate 2 reductions and Phase 3B net-negative delta |
| Visible route migration retires the former owner | `STATUS_BOARD_RETIREMENT_MANIFEST.md` and migration rule | Audit Remediation Gate 1 source controls; future activation tests | No Build 2 visible route | Status Board activation retirement evidence |
| No new corrective runtime layers | program baseline and runtime budget | corrective-asset source test | Existing layers grandfathered only | Gate 2 removal |
| Middleware route source rewriting is temporary | middleware and retirement manifest | future Phase 3B source-absence test | Active for Build 1 Status Board | Remove during Status Board activation |
| Foundation exit decision is corrected | `CORRECTED_PHASE_1_EXIT_DECISION.md` | Gate F governance suite | Complete / staged | Route-specific migration evidence |
| External deployment state is not inferred | `DEPLOYMENT_PREREQUISITES.md` | Gate F governance suite | Documented prerequisite | Environment verification |
| Status Board-first migration order | program baseline | Gate F, Phase 3A, and remediation governance suites | In execution | Complete Status Board route gate before Processing |
| Status Board shadow authorization is bounded | shadow authorization and Phase 3A contract | Phase 3A runtime-boundary suite | Consumed / shadow active | Live and manual evidence review |
| Phase 3A evidence remains memory-only | shadow evidence ledger and active bridge | Phase 3A tests and source assertions | Active | Sustained live sample review |
| Former owner retired only after activation | Phase 3 route package and retirement manifest | future ownership and middleware tests | Not started | Production acceptance |

## Approved route migration sequence

| Order | Route | Primary readiness burden |
|---:|---|---|
| 1 | Status Board | sustained shadow parity, mismatch disposition, timer/fullscreen, stale/offline, manual accessibility, net-negative activation, and rollback |
| 2 | Processing | write authorization, load conflicts, phase/timer behavior, and removal of right-click-only actions |
| 3 | Airport | dispatch, local arrival, arrival confirmation, count correction |
| 4 | Input | multi-record initialization, duplicate identity, recovery |
| 5 | Archives and Reports | shared report model, immutable snapshot, verified closeout/amendment |
| 6 | Squadron Board | server-side read-only authorization and limited-view evidence |

## Evidence rule

A requirement is not complete merely because it appears in documentation. Completion requires an identified source owner, executable validation where technically possible, explicit runtime status, and retirement of any competing owner only after accepted production activation.
