# GATE Build 2 — Canonical Record Schema

Status: Phase 1C contract
Runtime: inactive; Build 1 remains authoritative
Schema: `gate-record-v3`

## Canonical envelope

Every persistent Build 2 record uses:

| Field | Type | Required | Owner | Rule |
|---|---|---:|---|---|
| `id` | string | yes | repository | Stable backend identity; never derived from display order. |
| `type` | enum | yes | repository | `bus`, `dorm`, `week_group`, `config`, `archive`, or `audit`. |
| `schema_version` | integer | yes | contract | Current value `3`. |
| `record_version` | integer | yes | repository | Monotonic optimistic-concurrency version, minimum `1`. |
| `week_group` | string | operational records | repository | Uppercase operational boundary. |
| `created_at` | ISO timestamp | yes | repository | Explicit UTC or offset normalized to UTC. |
| `updated_at` | ISO timestamp | yes | repository | Must not precede `created_at`. |
| `created_by_role` | role | yes | repository | Instructor, Airman, Leadership, Squadron, System, or Unknown. |
| `updated_by_role` | role | yes | repository | Same role vocabulary. |
| `data` | object | yes | domain repository | Type-specific payload. |

Unknown legacy fields are not silently copied into the canonical payload. A repository adapter must either map them explicitly or preserve the original source outside the canonical write payload for audit/rollback.

## Bus

Required payload fields: `bus_id`, `status`, `otw_count`.

| Field | Type | Default | Owner |
|---|---|---:|---|
| `bus_id` | string | none | Bus repository |
| `bus_type` | string | `airport` | Bus repository |
| `status` | `active` / `arrived` / `cancelled` | none | Bus domain workflow |
| `otw_count` | non-negative integer | `0` | Airport/local intake |
| `female_count` | non-negative integer | `0` | Airport/local intake |
| `nat_count` | non-negative integer | `0` | Airport/local intake |
| `space_force_count` | non-negative integer | `0` | Airport/local intake |
| `departed_at` | timestamp or null | null | Dispatch workflow |
| `arrived_at` | timestamp or null | null | Arrival confirmation |
| `driver` | string | empty | Airport workflow |
| `notes` | string | empty | Bus repository |

Count subsets cannot exceed `otw_count`. `arrived` requires `arrived_at`; `active` forbids it. Departure time never substitutes for arrival time.

## Dorm

Required payload fields: `dorm_name`, `state`, `max_load`.

| Field | Type | Default | Owner |
|---|---|---:|---|
| `dorm_name` | string | none | Input initialization |
| `sdq` | string | empty | Input initialization |
| `state` | `empty` / `open` / `closed` | `empty` | Dorm workflow |
| `phase` | string | empty | Processing workflow |
| `max_load` | non-negative integer | `0` | Input initialization |
| `current_load` | non-negative integer | `0` | Processing workflow |
| `female` | boolean | false | Input initialization |
| `band` | boolean | false | Input initialization |
| `space_force` | boolean | false | Input initialization |
| `auditorium_location` | string | empty | Input/processing workflow |
| `opened_at` | timestamp or null | null | Dorm-open workflow |
| `closed_at` | timestamp or null | null | Dorm-close workflow |
| `final_processing_time` | timestamp or null | null | Processing workflow |
| `closed_timer` | string | empty | Dorm-close workflow |
| `display_order` | integer or null | null | Input initialization |

`current_load` cannot exceed `max_load`. Band and Space Force are mutually exclusive. Open dorms require `opened_at`; closed dorms require `closed_at`.

## Week Group

Required payload fields: `week_group`, `projected_total`.

The payload Week Group must equal the envelope Week Group. `projected_total` is a non-negative integer. This record owns projected/expected population, not bus records.

## Receiving configuration

Required payload fields:

- `receiving_night_one_start`
- `receiving_night_one_end`
- `receiving_night_two_start`
- `receiving_night_two_end`

All are explicit timestamps. Each end must follow its start. Crossing midnight is valid because the contract stores complete datetimes rather than time-only values.

## Archive

Required payload fields: `archive_schema_version`, `projected_total`, `arrived_total`, `bus_data`, `dorm_data`.

Canonical totals include Air Force, Space Force, NAT, female, and cumulative arrived values. `arrived_air_force_total + arrived_space_force_total` must equal `arrived_total`. `bus_data` and `dorm_data` preserve the record identity and operational fields needed to reproduce canonical calculations.

## Audit

Required payload fields: `action`, `entity_type`, `entity_id`, and `occurred_at`. Audit records describe an action but do not replace the current operational record.

## PII boundary

The schema does not introduce trainee names, SSNs, DoD IDs, flight manifests, medical data, or other new trainee PII. Dorm operational assignment data remains limited to the minimum already required by the receiving workflow.
