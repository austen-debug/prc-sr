# GATE Schema Version Registry

## Version 1 — Legacy Build 1

Unversioned or version 1 records generally store fields at the record root. Timestamp formats and optional fields vary.

Compatibility rule: read through an explicit adapter. Reading a legacy record does not authorize an in-place rewrite.

## Version 2 — Build 1 compatibility additions

Version 2-era records include additive operational fields such as Space Force counts, receiving windows, auditorium locations, closed timers, and archive schema markers.

Compatibility rule: preserve known operational fields and apply documented defaults only where the source is truly absent.

## Version 3 — Canonical Build 2

Schema identifier: `gate-record-v3`.

Version 3 adds stable identity, explicit record type, schema and record versions, normalized Week Group boundaries, explicit timestamps, role attribution, type-specific payloads, canonical status values, and deterministic validation.

Migration is adapter-based and non-destructive. Persistent conversion requires repository validation, conflict checking, audit evidence, and rollback support.
