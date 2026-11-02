# Admin Week Group identity correction — staged rollout

**Scope:** Admin System Control -> Edit Active Week Group. Designed for one confirmed
initialization typo, including production EG27005 -> WG27005. This does **not**
rename a historical archive, reset receiving, modify the original Input manifest,
or clear a bus/dorm/sound event.

## Safety contract

- Preview is read-only. GET /api/admin-week-group reports authoritative legacy
  Week Group identity, source counts, typed mirror parity and snapshot token.
- POST is Admin-only; requires a fresh (<5 minute) Admin session, same-origin
  JSON, exact typed confirmation, unique operation UUID, and administrative reason.
- POST is disabled unless all three production flags are set to true:
  `GATE_ADMIN_SYSTEM_CONTROL_ENABLED`,
  `GATE_ADMIN_WRITES_ENABLED` and
  `GATE_ADMIN_WEEK_GROUP_EDIT_ENABLED`.
- Site Lock must be enabled, server-enforced and unchanged throughout the D1
  transaction. While locked, non-Admin routes and APIs are unavailable; this is
  a **short planned maintenance window**, not a zero-downtime rename.
- Legacy active cycles only. Registered transactional cycles, archive conflicts,
  Squadron notices, reused initialization IDs, divergent source/mirror rows,
  and unrecognized Week Group references fail closed.
- One correction per initialization. Any subsequent correction requires separate
  review, not an automatic chained rewrite.
- An independent D1 backup/Time Travel point is mandatory before production
  edits. **Do not** manually set `locked` through D1: use audited Site Lock UI.
- All source rows and the active config are compared against a cryptographic
  preview snapshot. An immutable full pre-update snapshot is written to
  `gate_admin_week_group_renames` in the **same D1 batch** as the changes.
  Every affected row is updated with optimistic exact-row equality; any
  mismatch aborts and rolls back the full batch.
- Source record IDs and payload counts remain unchanged. The operational
  `week_group` is updated in source and payload; dorm `dorm_identity` prefixes
  are updated without changing the suffix. Typed mirrors follow existing
  synchronous triggers and are verified before and after the batch.
- The immutable original manifest retains the instructor-entered label.
  Admin reset uses the immutable, audited rename mapping to restore the
  same original Input configuration under the corrected live label.
- Updates generate Admin-role record audit entries and a dedicated
  `admin_week_group_renamed` audit event.

## Production deployment order

1. Merge and deploy the code; at this stage the edit control remains disabled.
2. Confirm the exact bound production D1 database and establish an independently
   recoverable backup. Rehearse the migration and operation on a staged copy.
3. Apply `migrations/0013_gate_admin_week_group_rename.sql` to the production
   D1 Console, after verifying previous migrations 0007, 0011 and 0012
   (including record mirror/audit triggers) are complete. **Migration 0007
   rebuilds historical tables and must not be applied blindly.**
4. Enable the explicit production environment flag
   `GATE_ADMIN_WEEK_GROUP_EDIT_ENABLED=true`, with the existing Site Lock
   and Admin writes flags set to true. Redeploy environment configuration.
5. On an Admin session, navigate to System Control > Edit Active Week Group.
   The preview can be inspected while live; verify counts, identifier and
   expected receiving activity. Do not edit during active receiving.
6. Schedule a brief receiving pause, have operations finish in-flight saves,
   and LOCK SITE. Refresh the Admin preview; verify new counts and mirror
   parity. Enter the complete corrected Week Group ID.
7. Confirm `RENAME <OLD> TO <NEW>` and an administrative reason. Confirm
   verified response, then use read-only D1 and Admin Data Integrity checks
   to verify new active config, every source row and typed mirror matches,
   original manifest intact, audit receipt present, and counts unchanged.
8. UNLOCK SITE after operational acceptance. Refresh every client and verify
   Status Board, Processing, buses, Input (locked while active), Squadron,
   Archive and print summaries use the corrected label.

## Known operational limitations

- The existing authorization layer requires verified migration 0007 Admin
  provenance and Admin writes readiness before privileged edits.
- Historical archives remain immutable; this feature cannot rename them.
- Any other embedded references, such as Squadron notices, block preview.
- Site Lock does not cancel writes that were already accepted before the
  maintenance window. Quiesce live users and verify in-flight requests first.
- GitHub merge or green CI does not demonstrate production deployment or
  D1 migration execution. Neither migration nor environment flags is set by
  this branch.
