// One authoritative archive-disposition read contract for current and legacy
// presentation paths. Fail closed on unexpected read failures, not on missing
// pre-migration tables. No historical rows are mutated by this helper.
export async function withdrawnArchiveIds(env) {
  const schema = await env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='gate_admin_archive_dispositions'"
  ).first();
  if (!schema) return new Set();
  const result = await env.DB.prepare(
    "SELECT d.archive_id FROM gate_admin_archive_dispositions d WHERE d.action='withdraw' AND d.revision=(SELECT MAX(latest.revision) FROM gate_admin_archive_dispositions latest WHERE latest.archive_id=d.archive_id)"
  ).all();
  return new Set((result.results || []).map(row => String(row.archive_id)));
}
