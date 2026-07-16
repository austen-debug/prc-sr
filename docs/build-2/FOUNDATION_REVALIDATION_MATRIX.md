# GATE Build 2 — Consolidated Foundation Revalidation Matrix

Status: GATE F VALIDATION CONTROL

| Control area | Governing owner | Executable evidence | Gate F decision |
|---|---|---|---|
| Program intent and route order | `PROGRAM_INTENT_BASELINE.md` | governance assertions | Required |
| Metric provenance and eligibility | domain operational-truth modules | domain and parity suites | Required |
| Canonical entities | data canonical entity and normalizer | Gate B/data suites | Required |
| Compatibility and unknown-record recovery | compatibility adapters | data and parity suites | Required |
| Role provenance | server session bridge and canonical entity | Gate B/C suites | Required |
| Record versioning and stale-write conflict | records API and client | server/data/workflow suites | Required |
| Append-only audit | API, repository, schema, migration | server/data/workflow suites | Required |
| Week Group initialization | initialization workflow | success, validation, partial, resume, compensation tests | Required |
| Arrival and dorm transitions | arrival/dorm workflows | verification, audit, conflict, recovery tests | Required |
| Archive closeout and amendment | archive workflows and models | closeout failure/resume and amendment lineage tests | Required |
| Cross-tab synchronization | invalidation channel and coordinator | synchronization suite | Required |
| Degraded read-only operation | sync state and guarded records client | synchronization suite | Required |
| Static-shell caching | offline cache policy and staged worker | cache-policy tests | Required |
| Route and permission registry | shell registries | shell suite | Required |
| GATE Design Language | design token registry | design suite | Required |
| Shared components | component library/workshop | component suite | Required |
| Responsive composition | responsive policy and CSS | responsive suite | Required |
| Accessibility foundation | accessibility contracts and CSS | accessibility suite | Required |
| Build 1 isolation | middleware and active source scan | every gate plus Gate F suite | Required |
| Existing-environment migration state | external Cloudflare/D1 environment | deployment evidence outside repository | Recorded prerequisite; not inferred |
| Status Board shadow authorization | corrected exit and shadow authorization | Gate F governance assertions | Authorized only after final CI |

## Decision classes

- **PASS:** source and executable evidence satisfy the foundation requirement.
- **PREREQUISITE:** repository evidence exists, but external deployment verification is still required before production activation.
- **BLOCK:** a failed foundation control prevents Gate F closure.

## Gate F closure rule

Gate F may close only when every repository-verifiable foundation control passes on the final pull-request head. External environment prerequisites must be documented without being falsely represented as verified.
