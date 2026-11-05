import { buildDormTagPdf } from '../../lib/dorm-tag-pdf.mjs';
import { resolveLiveWeekGroup } from '../live-week-group.mjs';

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}

function instructorOnly(data) {
  return ['instructor','admin'].includes(String(data?.session?.role || '').trim().toLowerCase());
}

function safeFilenamePart(value) {
  return String(value || 'CURRENT')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'CURRENT';
}

function parseRecordData(row) {
  if (!row) return null;
  try {
    const data = JSON.parse(row.data || '{}');
    return {
      ...data,
      type: String(data.type || row.type || '').trim().toLowerCase(),
      week_group: String(data.week_group || row.week_group || '').trim().toUpperCase()
    };
  } catch {
    return null;
  }
}

async function getDorms(env, weekGroup) {
  const result = await env.DB.prepare(
    `SELECT type, week_group, data, created_at, updated_at
     FROM records
     WHERE type = 'dorm'
       AND week_group = ?
     ORDER BY created_at ASC`
  ).bind(weekGroup).all();

  return (result.results || [])
    .map(parseRecordData)
    .filter(record => record?.type === 'dorm' && record.week_group === weekGroup);
}

export async function onRequestGet({ env, data }) {
  if (!instructorOnly(data)) {
    return jsonResponse({ isOk: false, code: 'forbidden', error: 'Instructor access required.' }, 403);
  }

  try {
    const live = await resolveLiveWeekGroup(env);
    if (live.status === 'recovery_required') return jsonResponse({isOk:false,code:'integrity_error',error:'Week Group recovery is required before generating reports.'},503);
    const weekGroup = live.week_group;
    if (!weekGroup) {
      return jsonResponse({ isOk: false, code: 'no_active_week_group', error: 'No active Week Group is available to generate tags.' }, 404);
    }

    const dorms = await getDorms(env, weekGroup);
    if (!dorms.length) {
      return jsonResponse({ isOk: false, code: 'no_dorms', error: 'The current Week Group does not contain any dorms.' }, 409);
    }

    const pdf = buildDormTagPdf({ weekGroup, dorms });
    const filename = `GATE_${safeFilenamePart(weekGroup)}_TAGS.pdf`;

    return new Response(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, no-store, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  } catch (error) {
    return jsonResponse({
      isOk: false,
      code: 'tag_pdf_failed',
      error: error?.message || 'Tag PDF could not be generated.'
    }, 500);
  }
}
