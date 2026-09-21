// GATE persistence cutover adapter. Owns durable Input drafts and atomic lifecycle actions.
// Activated only after the server confirms the feature flag, staging parity, and mirror triggers.
(function () {
  'use strict';
  const WINDOWS = ['receiving_day_one_start','receiving_day_one_end','receiving_day_two_start','receiving_day_two_end'];
  const ENDPOINT = '/api/persistence';
  let mode = 'checking';
  let health = null;
  let draftId = null;
  let draftRevision = null;
  let lastSaved = '';
  let inFlight = null;
  let timer = null;
  let dirtyDuringBoot = false;
  let conflict = false;

  function instructor() { return window.GatePermissionGuard?.isInstructor?.() === true; }
  function status(message, error = false) {
    const input = document.getElementById('wg-batch-input');
    const header = input?.closest('.flex-shrink-0');
    if (!header) return;
    let label = document.getElementById('gate-draft-persistence-status');
    if (!label) {
      label = document.createElement('div');
      label.id = 'gate-draft-persistence-status';
      label.setAttribute('role', 'status');
      label.setAttribute('aria-live', 'polite');
      label.className = 'text-xs mt-2';
      header.appendChild(label);
    }
    label.textContent = message;
    label.style.color = error ? 'var(--red)' : 'var(--text)';
  }
  async function api(action, body) {
    const url = action === 'health' ? `${ENDPOINT}?mode=health` : action === 'draft' ? `${ENDPOINT}?mode=draft` : ENDPOINT;
    const result = await fetch(url, action === 'health' || action === 'draft'
      ? { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } }
      : { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type':'application/json', Accept:'application/json' }, body: JSON.stringify({ action, ...body }) });
    const parsed = await result.json();
    if (!result.ok || !parsed.isOk) {
      const error = new Error(parsed.error || `Persistence failed (HTTP ${result.status}).`);
      error.code = parsed.code || 'request_failed';
      throw error;
    }
    return parsed;
  }
  function controller() { return window.GateInputPageController; }
  function snapshot() {
    const rows = controller()?.getRows?.() || [];
    return {
      proposed_week_group: String(document.getElementById('wg-batch-input')?.value || '').trim().toUpperCase(),
      rows: rows.map((row, index) => ({
        rowIndex: index, sdq: row.sdq || '', sec: row.sec || '', inter_sec: row.inter_sec || '',
        dorm_name: row.dorm_name || '', sex: row.sex || 'male', band: Boolean(row.band),
        space_force: Boolean(row.space_force), load: row.load ?? ''
      })),
      receiving_windows: Object.fromEntries(WINDOWS.map(key => [key, document.getElementById(key)?.value || ''])),
      import_review: {
        published_total: document.getElementById('gate-import-total')?.value || null,
        band_decision: document.querySelector('#gate-import-band [data-band][aria-pressed="true"]')?.dataset.band || null
      }
    };
  }
  function restore(draft) {
    const rows = controller()?.getRows?.();
    if (!Array.isArray(rows) || !draft) return false;
    rows.splice(0, rows.length, ...draft.rows.map(row => ({ ...row })));
    const group = document.getElementById('wg-batch-input');
    if (group) group.value = draft.proposed_week_group || '';
    WINDOWS.forEach(key => { const input = document.getElementById(key); if (input) input.value = draft.receiving_windows?.[key] || ''; });
    controller()?.renderBatchGrid?.();
    return true;
  }
  function scheduleSave(delay = 850) {
    if (mode === 'checking') { dirtyDuringBoot = true; return; }
    if (mode !== 'ready' || conflict) return;
    clearTimeout(timer);
    status('Unsaved Input changes');
    timer = setTimeout(() => { flushDraft().catch(() => {}); }, delay);
  }
  async function flushDraft(force = false) {
    if (mode !== 'ready' || conflict) throw new Error('The authoritative draft is not writable.');
    clearTimeout(timer);
    if (inFlight) {
      await inFlight;
      if (conflict) throw new Error('Draft conflict. Reload before proceeding.');
    }
    const current = snapshot();
    const serialized = JSON.stringify(current);
    if (!force && draftId && serialized === lastSaved) return;
    status('Saving Input draft...');
    const task = api('save_draft', { draft_id: draftId, revision: draftRevision, ...current });
    inFlight = task;
    try {
      const saved = await task;
      draftId = saved.draft.draft_id;
      draftRevision = saved.draft.revision;
      lastSaved = JSON.stringify({
        proposed_week_group: saved.draft.proposed_week_group,
        rows: saved.draft.rows,
        receiving_windows: saved.draft.receiving_windows,
        import_review: saved.draft.import_review
      });
      // The server normalizes row values. Compare live form again rather than assuming it was saved unchanged.
      if (JSON.stringify(snapshot()) !== serialized) {
        status('Input changed during save; saving latest revision...');
        setTimeout(() => flushDraft().catch(() => {}), 0);
      } else {
        // Use the live snapshot for comparison to avoid repeated saves caused by harmless normalization.
        lastSaved = serialized;
        status(`Input saved · revision ${draftRevision}`);
      }
    } catch (error) {
      if (error.code === 'draft_conflict' || error.code === 'conflict') {
        conflict = true;
        status('Draft changed on another device. Reload before editing or initializing.', true);
      } else status(`Input save failed: ${error.message}`, true);
      throw error;
    } finally {
      if (inFlight === task) inFlight = null;
    }
  }
  async function refreshApp() {
    if (typeof window.refresh === 'function') {
      await window.refresh();
      window.runGateHooks?.('afterDataChanged', { source: 'gate-persistence-runtime' });
    } else window.location.reload();
  }
  async function refreshHealth() {
    health = await api('health');
    if (health.enabled && health.ready) mode = 'ready';
    else if (!health.enabled) mode = 'legacy';
    else mode = 'blocked';
    return health;
  }
  async function registerActive() {
    status('Registering existing active Week Group...');
    try {
      await api('adopt', {});
      await refreshHealth();
      status(`Active Week Group ${health.cycle?.week_group || ''} registered in the lifecycle database.`);
      adoptionButton();
    } catch (error) { status(`Registration failed: ${error.message}`, true); }
  }
  function adoptionButton() {
    const current = document.getElementById('gate-persistence-adopt');
    if (!health?.adoption_required) { current?.remove(); return; }
    if (current) return;
    const label = document.getElementById('gate-draft-persistence-status');
    if (!label) return;
    const button = document.createElement('button');
    button.id = 'gate-persistence-adopt';
    button.type = 'button';
    button.className = 'ml-2 rounded border px-3 py-2 text-xs font-semibold';
    button.textContent = `Register active ${health.legacy_week_group}`;
    button.addEventListener('click', registerActive);
    label.insertAdjacentElement('afterend', button);
  }
  async function initialize() {
    if (conflict) return status('Reload the conflicting Input draft before initialization.', true);
    if (health?.adoption_required || health?.cycle || health?.legacy_week_group) {
      return status('Close out the existing active Week Group before initializing another.', true);
    }
    const button = document.getElementById('init-wg-btn');
    if (button) button.disabled = true;
    try {
      await flushDraft();
      const result = await api('initialize', { draft_id: draftId, revision: draftRevision });
      draftId = null;
      draftRevision = null;
      lastSaved = '';
      await refreshHealth();
      await refreshApp();
      document.getElementById('init-success-overlay')?.classList.remove('hidden');
      status(`${result.week_group} initialized with ${result.dorm_count} dorms. Saved in D1.`);
    } catch (error) { status(`Initialization blocked: ${error.message}`, true); }
    finally { if (button) button.disabled = false; }
  }
  async function closeout() {
    if (health?.adoption_required) return status(`Register ${health.legacy_week_group} before closeout.`, true);
    const weekGroup = health?.cycle?.week_group;
    if (!weekGroup) return status('No registered active Week Group to close out.', true);
    if (!window.confirm(`Close out ${weekGroup}? The archive and live-record clearance will commit together.`)) return;
    const button = document.getElementById('closeout-btn');
    if (button) button.disabled = true;
    try {
      const result = await api('closeout', { cycle_id: health.cycle.cycle_id });
      await refreshHealth();
      if (!draftId) {
        const rows = controller()?.getRows?.();
        if (Array.isArray(rows)) rows.splice(0, rows.length, ...Array.from({length:25}, (_, index) => ({rowIndex:index,sdq:'',sec:'',inter_sec:'',dorm_name:'',sex:'male',band:false,space_force:false,load:''})));
        const input = document.getElementById('wg-batch-input'); if (input) input.value = '';
        WINDOWS.forEach(key => { const input = document.getElementById(key); if (input) input.value = ''; });
        controller()?.renderBatchGrid?.();
      }
      await refreshApp();
      status(`${result.week_group} archived as ${result.archive_id}; live records cleared atomically.`);
    } catch (error) { status(`Closeout failed: ${error.message}`, true); }
    finally { if (button) button.disabled = false; }
  }
  function lifecycleClick(event) {
    if (!instructor()) return;
    const target = event.target?.closest?.('#init-wg-btn, #closeout-btn');
    if (!target || mode === 'legacy') return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    if (mode !== 'ready') return status('Persistence verification is incomplete. No lifecycle changes were made.', true);
    if (target.id === 'init-wg-btn') initialize();
    else closeout();
  }
  function inputChanged(event) {
    if (!instructor()) return;
    const target = event.target;
    if (!target?.closest?.('#page-input, #gate-import-dialog')) return;
    if (target.closest('#batch-rows-container, #receiving-windows-panel, #gate-flight-alert-toolbar, #gate-import-dialog') || target.id === 'wg-batch-input') scheduleSave();
  }
  function potentialImport(event) {
    if (!instructor()) return;
    if (event.target?.closest?.('#gate-import-dialog, #gate-flight-alert-toolbar, [data-gate-input-clear-row]')) scheduleSave(1200);
  }
  async function boot() {
    if (!instructor()) { mode = 'legacy'; return; }
    try {
      await refreshHealth();
      if (mode === 'legacy') return;
      if (mode === 'blocked') return status(health.message || 'Persistence staging is not verified. Initialization and closeout are blocked.', true);
      const draft = (await api('draft')).draft;
      if (draft && dirtyDuringBoot) return status('A saved Input draft exists. Reload to recover it before editing.', true);
      if (draft) {
        restore(draft);
        draftId = draft.draft_id;
        draftRevision = draft.revision;
        lastSaved = JSON.stringify(snapshot());
        status(`Recovered Input draft · revision ${draftRevision}`);
      } else status('Input draft storage ready. Changes save to D1.');
      adoptionButton();
      if (dirtyDuringBoot && !draft) scheduleSave();
    } catch (error) {
      mode = 'blocked';
      status(`Persistence verification failed: ${error.message}. Lifecycle changes are blocked.`, true);
    }
  }
  window.addEventListener('click', lifecycleClick, true);
  window.addEventListener('input', inputChanged, true);
  window.addEventListener('change', inputChanged, true);
  window.addEventListener('click', potentialImport, true);
  if (document.readyState === 'complete') boot();
  else window.addEventListener('load', boot, { once: true });
})();
