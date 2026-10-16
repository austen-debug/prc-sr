# GATE Admin Access — Release and Provenance Acceptance
Status: code staged on a feature branch. No production migration or Cloudflare flag change is authorized by this file.

## Production-preserving baseline
- Squadron, Instructor and Airman credentials, sessions, page routes and existing operational commands retain their prior semantics.
- Instructor bus deletion, dorm deletion/correction, processing changes, initialization, closeout, historical review and archive amendments remain authorized.
- Admin inherits Instructor operational permissions and receives a separately guarded historical archive withdrawal/restore workflow.
- The physical archive delete endpoint is retired. Original snapshots and append-only amendments are not rewritten.
- Credential values stay exclusively in Cloudflare; do not include them in source, logs or test output.

## Schema migration and activation
1. Compare actual remote D1 sqlite_master SQL, table_info, indices, triggers and foreign keys with the source migration. Production tables may have been created manually. Reject the migration if any table or column diverges.
2. Take and verify an independent D1 backup and Time Travel bookmark. Arrange an operational write-quiet period.
3. Import a production-derived database into isolated staging; execute 0007 as a single atomic migration. Run foreign_key_check, integrity_check, historical row-content comparison, expected trigger-count checks, and create/update/delete probes.
4. Confirm all four actor CHECK constraints permit admin and retain existing accepted values; confirm gate_record_audit_insert and gate_record_audit_update recognize admin; test immutability triggers and source/mirror parity.
5. Deploy and verify the code with GATE_ADMIN_WRITES_ENABLED unset/false. Admin login and read-only diagnostics may function, while ALL Admin writes fail closed (HTTP 503). Existing roles continue working.
6. Recheck schema and parity in the intended D1 instance before enabling GATE_ADMIN_WRITES_ENABLED=true. This flag controls every inherited Admin mutation and the archive disposition commands. It is NOT an automatic database migration.
7. Run a real four-role smoke test plus an isolated staging archive withdrawal/restore test before authorizing any live administrative record change.

## Rollback
If Admin mutations fail, disable GATE_ADMIN_WRITES_ENABLED first and return to the accepted application build after verifying in-flight operation IDs. The expanded schema is backward-compatible with existing actor values, so application rollback is preferred over reverting D1. Do not restore an old D1 bookmark over newer receiving transactions without formal recovery handling.

## Known restrictions
- The initial shared Admin credentials identify the Admin access type, not a unique human. Provenance is role-accurate but not person-specific.
- Exceptional live lifecycle recovery, raw data repair, global configuration editing and user administration remain disabled and are represented only as future administrative surfaces.
- D1 source migration alone cannot establish production readiness; runtime gate validates deployed actor CHECK SQL, audit trigger SQL and disposition immutability markers before any Admin mutation.
- Existing legacy closeout path remains in place for current operations; no speculative operational workflow replacement is part of this PR.

## Deletion provenance
The original record deletion trigger remains an unverified `system` observation. Admin-initiated operational record deletes additionally commit a verified `record_delete_authorized` audit event with role `admin` in the same D1 batch. This does not modify the existing Instructor/Airman delete command or mislabel a database trigger as the authenticated actor.

## Final Admin read boundary and diagnostics
- A withdrawn archive is filtered from Instructor views in both `/api/archives` and legacy `/api/records` all-records listings. Existing `scope=live` receives no archive-disposition filtering. Instructor access to details and amendments of withdrawn archives is denied; Admin may inspect for recovery.
- Admin-only `/api/admin?mode=integrity` checks source/mirror parity and the six expected mirror/audit triggers without applying repairs.
- Admin-only `/api/admin?mode=security` reports role-binding presence and control flags but never transmits secret values.
- The schema migration retains the AUTOINCREMENT `sqlite_sequence` high-water marks for both Squadron revision/notice tables.
