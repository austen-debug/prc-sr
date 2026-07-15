# GATE Build 2 — Program Traceability Matrix

Status: FOUNDATION ALIGNMENT CONTROL  
Purpose: map governing intent to implementation, validation, runtime ownership, and remaining gates.

| Requirement | Source owner | Validation | Runtime status | Remaining gate |
|---|---|---|---|---|
| No trainee PII expansion | Program baseline, repository/config safeguards | normalization, repository, component fixtures | Build 1 active; Build 2 staged | Continuous |
| Confirmed-arrival eligibility | `domain/operational-metrics.mjs` | operational truth and parity suites | Staged | Phase 3 consumer migration |
| Receiving Night One/Two from `arrived_at` | `domain/receiving.mjs` | historical 818/39 and boundary fixtures | Staged | Archives/Reports migration |
| Air Force, Space Force, female, NAT share one arrival set | `domain/operational-metrics.mjs` | domain and parity suites | Staged | Phase 3 consumer migration |
| Active Week Group has one owner | `domain/week-groups.mjs` | Gate A and Gate B entity suites | Staged | Phase 3 integration |
| Last arrival is derived | `domain/arrivals.mjs` | Gate A domain suite | Staged | Status Board migration |
| Manifested bus log differs from arrived total | `domain/buses.mjs` | Gate A and parity suites | Staged | Airport migration |
| Dorm state grouping has one owner | `domain/dorms.mjs` | Gate A domain suite | Staged | Status/Squadron migration |
| Processing assignment and phase summaries have one owner | `domain/processing.mjs` | Gate A domain suite | Staged | Processing migration |
| Timer/overtime calculation is deterministic | `domain/timers.mjs` | Gate A domain suite | Staged | Status/Processing integration |
| Status and Squadron summaries share truth | `domain/summaries.mjs` | Gate A domain suite | Staged | Status then Squadron migration |
| Current Summary and Archive Report share a model | `domain/reports.mjs` | Gate A domain suite | Staged | Archives/Reports migration |
| Archive snapshot is immutable and canonical | `domain/archives.mjs` | Gate A domain suite | Staged | Gates C–D transaction/audit |
| Build 1 records normalize without silent loss | `data/record-normalizer.mjs` | normalization, entity, parity suites | Staged compatibility boundary | Continuous migration validation |
| Domain consumes canonical entities directly | `data/canonical-entity.mjs`, `domain/normalization.mjs` | Gate B canonical entity suite | Staged | Phase 3 consumers |
| Legacy aliases stop at compatibility boundary | `data/legacy-compatibility.mjs`, `record-normalizer.mjs` | Gate B entity and config tests | Staged | Continuous enforcement |
| Creator/updater role provenance | `data/provenance.mjs`, typed repositories | Gate B repository suite | Staged | Gate C audit/server authorization |
| Unknown records remain recoverable | `record-normalizer.mjs` | normalization and Gate B entity suites | Staged | Continuous |
| Typed operational repositories | `data/repositories/*` | repository suite | Staged | Gate C versioning/audit |
| Critical writes require confirmed server success | repository result contract and program baseline | repository suite; future API integration | Build 1 behavior remains active | Gates C–D |
| Server-enforced stale-write protection | records API and transport capability contract | future conflict integration tests | Not implemented | Gate C |
| Append-only audit events | future `GateAuditRepository` | future audit suite | Not implemented | Gate C |
| Transactional Week Group initialization | future workflow orchestrator | future failure/recovery suite | Not implemented | Gate D |
| Verified archive closeout | future workflow orchestrator | future create/verify/audit/clear/verify suite | Build 1 remains active | Gate D |
| Cross-tab authoritative refetch | future synchronization service | future multi-tab suite | Not implemented | Gate E |
| Explicit offline/stale/last-sync behavior | shell/accessibility contracts plus future service | future degraded-operation suite | Presentation contracts staged | Gate E |
| One GATE Design Language | `design/*` | GDL suite | Staged | Route migration use |
| One component system | `components/*` | component suite | Staged | Route migration use |
| One route and permission registry | `shell/route-registry.mjs`, `permission-registry.mjs` | shell suite | Staged | Gate C server authorization |
| Capability-driven six-posture composition | `responsive/*` | responsive suite | Staged | Route-specific evidence |
| WCAG 2.2 AA foundation | `accessibility/*` | accessibility suite | Staged | Route-specific manual evidence |
| Squadron credentials remain server-side | Cloudflare bindings and repository safeguards | repository/config tests; future auth tests | Not activated | Gate C/Phase 3 |
| Status Board-first migration order | `PROGRAM_INTENT_BASELINE.md` | documentation gate | Approved, not started | Gates A–F then Phase 3 |
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

A requirement is not complete merely because it appears in documentation. Completion requires an identified source owner, executable validation where technically possible, an explicit runtime status, and retirement of any competing owner after activation.
