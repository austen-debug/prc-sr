# WG27003 closeout incident — read-only production reconciliation

Incident observed 2026-10-30: historical WG27003 archive (displayed Oct 27), while status board remains on WG27003 showing 858 arrived; closeout API reports 0 dorm, 27 bus, 67 sound_event live rows. Historical report displays 893 arrived, 903 expected, 893 loaded, 16 dorms, 29 buses. These observations are NOT a verified D1 database snapshot.

## Operator prerequisites

1. Identify the production Cloudflare Pages deployment and exact bound D1 database. Do not assume the database from an old document.
2. Record a **verified recoverable D1 Time Travel bookmark / backup**, and coordinate no operational writes while collecting queries.
3. Execute each SELECT below in the bound D1 SQL console. **No UPDATE, DELETE, INSERT, migration, config change, or restore.**
4. Preserve returned archive IDs, timestamps and counts; redact operational content before sharing. Do not copy raw data to issues or public logs.
5. Do not repeat closeout or initialize a new group until the discrepancy is reconciled.

## A. Establish current configuration and residual counts

```sql
SELECT id, json_extract(data, '$.key') AS config_key,
       json_extract(data, '$.value') AS config_value, updated_at
FROM records WHERE type='config' AND json_extract(data,'$.key') IN ('week_group','last_airport')
ORDER BY config_key, id;

SELECT week_group, type, COUNT(*) AS records,
       MIN(created_at) AS oldest_created_at, MAX(updated_at) AS newest_updated_at
FROM records
WHERE week_group='WG27003' AND type IN ('dorm','bus','sound_event','archive')
GROUP BY week_group,type ORDER BY type;

SELECT id, cycle_id, week_group, state
FROM gate_week_groups WHERE week_group='WG27003';
```

If the third query fails due to schema differences, inspect `PRAGMA table_info('gate_week_groups');` first and select only columns present. The first two queries are against the legacy `records` schema.

## B. Identify archive(s) and integrity metadata — do not assume one

```sql
SELECT id, created_at, updated_at,
       json_extract(data,'$.archived_at') AS archived_at,
       json_extract(data,'$.legacy_closeout_request_id') AS legacy_request_id,
       json_extract(data,'$.archive_schema_version') AS archive_schema_version,
       json_extract(data,'$.source_record_count') AS source_record_count,
       json_array_length(CASE WHEN json_valid(json_extract(data,'$.source_records_json'))
         THEN json_extract(data,'$.source_records_json') ELSE '[]' END) AS source_snapshot_items,
       json_array_length(CASE WHEN json_valid(json_extract(data,'$.dorm_data'))
         THEN json_extract(data,'$.dorm_data') ELSE '[]' END) AS dorm_snapshot_items,
       json_array_length(CASE WHEN json_valid(json_extract(data,'$.bus_data'))
         THEN json_extract(data,'$.bus_data') ELSE '[]' END) AS bus_snapshot_items,
       json_extract(data,'$.total_arrived') AS archived_arrived,
       json_extract(data,'$.total_expected') AS archived_expected,
       json_extract(data,'$.total_loaded') AS archived_loaded
FROM records WHERE type='archive' AND week_group='WG27003'
ORDER BY created_at, id;
```

Multiple archives with the same display label can legitimately exist across historical cycles; associate by archive ID, created time, operation identity and source snapshot, **not just week_group**.

## C. Residual source record identity (metadata only)

```sql
SELECT type, id, created_at, updated_at,
       json_extract(data,'$.status') AS bus_status,
       json_extract(data,'$.otw_count') AS bus_count
FROM records
WHERE week_group='WG27003' AND type IN ('dorm','bus','sound_event')
ORDER BY type, created_at, id;
```

## D. Compare live IDs with the candidate archive's lossless source snapshot

Replace the exact archive identifier from section B, only if `source_records_json` is valid JSON. Older archives may contain only reporting snapshots; in that case stop and reconcile against a validated D1 backup and audit history. This query is **read-only**.

```sql
WITH archived AS (
 SELECT json_extract(j.value,'$.id') AS id,
        json_extract(j.value,'$.type') AS type,
        json_extract(j.value,'$.week_group') AS week_group,
        json_extract(j.value,'$.data') AS original_data
 FROM records a, json_each(json_extract(a.data,'$.source_records_json')) j
 WHERE a.type='archive' AND a.id='REPLACE_WITH_VERIFIED_ARCHIVE_ID'
),
live AS (
 SELECT id,type,week_group,data FROM records
 WHERE week_group='WG27003' AND type IN ('dorm','bus','sound_event')
)
SELECT l.type,
       COUNT(*) AS live_rows,
       SUM(CASE WHEN a.id IS NULL THEN 1 ELSE 0 END) AS not_in_archive,
       SUM(CASE WHEN a.id IS NOT NULL AND
           (a.type IS NOT l.type OR a.week_group IS NOT l.week_group OR a.original_data IS NOT l.data)
           THEN 1 ELSE 0 END) AS changed_since_archive
FROM live l LEFT JOIN archived a ON a.id=l.id
GROUP BY l.type ORDER BY l.type;
```

If the archive lacks `source_records_json`, do **not** assume that the surviving 27 buses were all in the October 27 archive: they may have been added or changed later. Compare archived `bus_data` against current bus identities with domain-specific fields and review audit records before any remediation.

## E. Decision gate

- **Verified archive + exact source coverage + no post-archive changes + verified backup:** plan a separate, scoped, idempotent residual cleanup with a transaction, before/after assertions, explicit operator approval and audit trail.
- **No lossless source snapshot, unmatched IDs, changed rows, multiple candidate archives, or divergent audit evidence:** stop; reconstruct from Time Travel/backup and operational audit, preserve every row, resolve attribution and only then approve cleanup.
- **Lifecycle/feature flag indicates registered transactional cycle:** use the transactional workflow; never force the legacy closeout path.
- On completion verify: archived record unchanged, no WG27003 residual dorm/bus/sound events, active configuration cleared only if still WG27003, historical archive accessible, current board reset. Re-run read-only counts and check any configured mirror-table parity.

## Code paths inspected

- `functions/api/legacy-closeout.js`: intentional `existing_archive` refusal; previous partial browser-closeout detection; new request IDs cannot reconcile an existing archive.
- `public/js/gate-archive-controller.js`: calls atomic legacy endpoint; failure handling blocks automatic repeat.
- `docs/D1_PERSISTENCE_CUTOVER.md`: production recovery and feature flag conditions.

This document does not authorize a production write. Never infer successful deployment or D1 access from GitHub changes.
