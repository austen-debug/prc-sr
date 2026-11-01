# GATE Admin System Control — Activation and Recovery Gates

Merging this code DOES NOT apply a D1 migration, lock the site, enable a feature flag, or reset any data. Production must remain unlocked until separate operator-authorized activation.

## Preflight and rollout

1. Freeze production writes; capture a verified independent D1 export and (where supported) a Time Travel bookmark. Inspect actual sqlite_master SQL, mirror parity, and lifecycle state.
2. Apply migrations/0011_gate_archive_source_immutability.sql if missing, and migrations/0012_gate_admin_system_control.sql, after staging rehearsal and a remote schema comparison. Verify all required immutable triggers.
3. Verify migrations/0007_gate_admin_provenance.sql is installed and the Admin actor is supported by all audit CHECK constraints and triggers. Do not blindly run a destructive schema rebuild on production.
4. Verify the new gate_admin_system_control row is unlocked, with revision 0. The additive schema does not change records or archived history.
5. Explicitly set GATE_ADMIN_SYSTEM_CONTROL_ENABLED=true to enable Admin lock/unlock. Admin recovery additionally requires GATE_ADMIN_WRITES_ENABLED=true, migration 0007, and the archive immutability protections from 0011.
6. Verify all four roles, existing sessions, direct URLs and APIs in staging. Rehearse both emergency actions with source snapshots, injected failures, and validation of archive and mirror integrity.

## Site Lock

The root Pages middleware enforces lock state on each authenticated non-Admin request: protected pages display the maintenance document, protected APIs return 423, and session status plus logout remain available. The existing Squadron controller checks for newly activated locks every five seconds in already-open application tabs. Admin may continue to access all operational pages and Administration.

## Reset Week Group

Requires active Site Lock, current verified Week Group/revision, recent Admin sign-in, written reason and exact typed confirmation. Saves every original operational record (raw JSON, ID, timestamps) to immutable recovery evidence before removing activity and recreating baseline dorms from the IMMUTABLE ORIGINAL INPUT MANIFEST. The Week Group label and receiving windows remain active. Existing/legacy weeks with no immutable initialization manifest are not eligible; reconstructing the initial dorms from modified live rows would risk data loss.

## Archive & Zero

Requires active Site Lock and the same Admin confirmation requirements. Writes a canonical archival report with full source records, plus independent immutable recovery evidence, then clears buses, dorms, sound events, airport-time and active Week Group config; closes a registered lifecycle when present. A partially archived or inconsistent group is rejected rather than rearchived.

These operations use a single D1 batch transaction and compare exact source records, lifecycle revision, and lock state. An unsuccessful or uncertain response must be investigated by operation ID before retrying. They do not automatically unlock the site.

## Operational boundaries

An in-flight mutation accepted before lock activation can still complete; quiesce operations before reset, and verify all source records immediately before committing the D1 batch. No automatic rollback to live operations is provided: the immutable evidence is for a separately reviewed recovery. If the Admin unlocking path is unavailable, an authorized D1 operator must recover connectivity and execute an independently reviewed, audited break-glass change. Do not remove immutability triggers or bypass role authorization.
