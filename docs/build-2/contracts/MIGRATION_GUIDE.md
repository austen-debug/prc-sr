# GATE Build 2 Data Migration Guide

Build 1 records remain authoritative. Phase 1C performs no production migration and registers no runtime assets.

## Read normalization

1. Identify source type and schema.
2. Preserve backend identity.
3. Normalize Week Group and known operational fields.
4. Convert timestamps with explicit zones to UTC.
5. Report legacy local timestamps that require repository timezone context.
6. Validate the version 3 representation.
7. Reject unsupported or ambiguous records instead of inventing values.

## Future persistent conversion

A repository may persist version 3 only after source-version detection, conflict checking, validation, preservation of known operational fields, audit preparation, and rollback review.

## Known mappings

Bus: `total_count` or `total` maps to `otw_count`; `naturalization_count` maps to `nat_count`; `departure_time` maps to `departed_at`. Only `arrived_at` confirms arrival.

Dorm: `capacity` maps to `max_load`; `loaded` maps to `current_load`; `is_female`, `is_band`, and `is_space_force` map to their canonical flags.

Week Group: `expected_total` maps to `projected_total`.

## Prohibited behavior

No array-position identity, DOM-derived values, departure-time arrival fallback, silent timezone assumption, destructive rewrite during reads, silent field loss, or trainee PII expansion.
