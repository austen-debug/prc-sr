import { buildDormMatrixPdf } from '../../lib/dorm-matrix-pdf.mjs';
import { resolveLiveWeekGroup } from '../live-week-group.mjs';

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

function parseRecord(row) {
  if (!row) return null;
  try {
    const item = JSON.parse(row.data || '{}');
    return {
      ...item,
      type: String(item.type || row.type || '').trim().toLowerCase(),
      week_group: String(item.week_group || row.week_group || '').trim().toUpperCase(),
      created_at: item.created_at || row.created_at || ''
    };
  } catch {
    return null;
  }
}

function filenamePart(value) {
  return String(value || 'CURRENT').trim().toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'CURRENT';
}

async function dormsForWeekGroup(DB, weekGroup) {
  const result = await DB.prepare(
    "SELECT type, week_group, data, created_at, updated_at FROM records " +
    "WHERE type = 'dorm' AND week_group = ? ORDER BY created_at ASC"
  ).bind(weekGroup).all();
  return (result.results || []).map(parseRecord).filter(
    record => record?.type === 'dorm' && record.week_group === weekGroup
  );
}

export async function onRequestPost({ request, env, data }) {
  if (!['instructor','admin'].includes(String(data?.session?.role || '').trim().toLowerCase())) {
    return jsonResponse({ isOk: false, code: 'forbidden', error: 'Instructor access required.' }, 403);
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return jsonResponse({ isOk: false, code: 'invalid_form', error: 'Invalid matrix print request.' }, 400);
  }

  const noteValue = form.get('notes');
  const weekValue = form.get('week_group');
  if ((noteValue !== null && typeof noteValue !== 'string') || typeof weekValue !== 'string') {
    return jsonResponse({ isOk: false, code: 'invalid_fields', error: 'Invalid matrix print fields.' }, 400);
  }
  const notes = String(noteValue || '');
  const expected = String(weekValue || '').trim().toUpperCase();
  if (notes.length > 220) {
    return jsonResponse({ isOk: false, code: 'notes_too_long', error: 'Matrix notes must be 220 characters or fewer.' }, 400);
  }
  if (!expected || !/^[A-Z0-9_-]{1,50}$/.test(expected)) {
    return jsonResponse({ isOk: false, code: 'invalid_week_group', error: 'Select an active Week Group.' }, 400);
  }

  try {
    const live = await resolveLiveWeekGroup(env);
    if (live.status === 'recovery_required') return jsonResponse({isOk:false,code:'integrity_error',error:'Week Group recovery is required before generating reports.'},503);
    const weekGroup = live.week_group;
    if (!weekGroup || weekGroup !== expected) {
      return jsonResponse({ isOk: false, code: 'week_group_changed', error: 'The active Week Group changed. Reopen Print Matrix.' }, 409);
    }
    const dorms = await dormsForWeekGroup(env.DB, weekGroup);
    if (!dorms.length) {
      return jsonResponse({ isOk: false, code: 'no_dorms', error: 'This Week Group does not contain any dorms.' }, 409);
    }
    const pdf = buildDormMatrixPdf({ weekGroup, dorms, notes });
    return new Response(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="GATE_' + filenamePart(weekGroup) + '_MATRIX.pdf"',
        'Cache-Control': 'private, no-store, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  } catch (error) {
    return jsonResponse({
      isOk: false, code: 'matrix_pdf_failed',
      error: error?.message || 'The receiving matrix could not be generated.'
    }, 500);
  }
}
