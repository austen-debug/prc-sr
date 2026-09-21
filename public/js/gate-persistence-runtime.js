// GATE's single persistence browser owner. Legacy controllers stay in place only for flag-off rollback.
// This module never writes directly to typed mirrors and never registers a guessed Week Group.
(function () {
  'use strict';
  const ENDPOINT = '/api/persistence';
  const WINDOWS = ['receiving_day_one_start', 'receiving_day_one_end', 'receiving_day_two_start', 'receiving_day_two_end'];
  const emptyRow = index => ({ rowIndex:index, sdq:'', sec:'', inter_sec:'', dorm_name:'', sex:'male', band:false, space_force:false, load:'' });
  let mode = 'checking';
  let health = null;
  let draftId = null;
  let draftRevision = null;
  let lastSaved = '';
  let inFlight = null;
  let timer = null;
  let dirtyDuringBoot = false;
  let conflict = false;
  let actionInFlight = false;
  let recoveredReview = null;
  let recoveredReviewGroup = '';

  const byId = id => document.getElementById(id);
  const instructor = () => window.GatePermissionGuard?.isInstructor?.() === true;
  const controller = () => window.GateInputPageController;
  const active = () => Boolean(health?.cycle || health?.legacy_week_group);

  function status(message, isError = false) {
    const header = byId('wg-batch-input')?.closest('.flex-shrink-0');
    if (!header) return;
    let label = byId('gate-draft-persistence-status');
    if (!label) {
      label = document.createElement('div');
      label.id = 'gate-draft-persistence-status';
      label.setAttribute('role', 'status');
      label.setAttribute('aria-live', 'polite');
      label.className = 'text-xs mt-2';
      header.appendChild(label);
    }
    label.textContent = message;
    label.style.color = isError ? 'var(--red)' : 'var(--text)';
  }

  async function api(action, body = {}) {
    const read = action === 'health' || action === 'draft';
    const url = read ? `${ENDPOINT}?mode=${action}` : ENDPOINT;
    const response = await fetch(url, read
      ? { credentials:'same-origin', cache:'no-store', headers:{ Accept:'application/json' } }
      : { method:'POST', credentials:'same-origin', cache:'no-store', headers:{ 'Content-Type':'application/json', Accept:'application/json' }, body:JSON.stringify({action,...body}) });
    const payload = await response.json();
    if (!response.ok || !payload.isOk) {
      const failure = new Error(payload.error || `Persistence request failed (HTTP ${response.status}).`);
      failure.code = payload.code || 'request_failed';
      throw failure;
    }
    return payload;
  }

  function snapshot() {
    const group = String(byId('wg-batch-input')?.value || '').trim().toUpperCase();
    const publishedInput = byId('gate-import-total');
    const selectedBand = document.querySelector('#gate-import-band [data-band][aria-pressed="true"]');
    // The importer owns live review controls. Preserve the saved review when that transient
    // UI has not yet been reconstructed after a refresh; do not clear it on an unrelated edit.
    const savedReview = recoveredReviewGroup === group ? recoveredReview : null;
    return {
      proposed_week_group:group,
      rows:(controller()?.getRows?.() || []).map((row,index) => ({
        rowIndex:index, sdq:row.sdq || '', sec:row.sec || '', inter_sec:row.inter_sec || '',
        dorm_name:row.dorm_name || '', sex:row.sex || 'male', band:Boolean(row.band),
        space_force:Boolean(row.space_force), load:row.load ?? ''
      })),
      receiving_windows:Object.fromEntries(WINDOWS.map(key => [key, byId(key)?.value || ''])),
      import_review:{
        published_total:publishedInput ? (publishedInput.value === '' ? null : publishedInput.value) : (savedReview?.published_total ?? null),
        band_decision:selectedBand?.dataset.band || savedReview?.band_decision || null
      }
    };
  }

  function restore(draft) {
    const rows = controller()?.getRows?.();
    if (!Array.isArray(rows) || !draft || !Array.isArray(draft.rows)) return false;
    rows.splice(0, rows.length, ...draft.rows.map(row => ({...row})));
    if (byId('wg-batch-input')) byId('wg-batch-input').value = draft.proposed_week_group || '';
    WINDOWS.forEach(key => { if (byId(key)) byId(key).value = draft.receiving_windows?.[key] || ''; });
    recoveredReview = draft.import_review ? {...draft.import_review} : null;
    recoveredReviewGroup = draft.proposed_week_group || '';
    controller()?.renderBatchGrid?.();
    return true;
  }

  function lockInput() {
    if (mode === 'legacy' || mode === 'checking') return;
    const locked = mode !== 'ready' || active() || actionInFlight;
    const selectors = '#wg-batch-input, #batch-rows-container input, #batch-rows-container select, #batch-rows-container [data-gate-input-clear-row], #receiving-windows-panel input, #gate-import-open, #gate-import-inter';
    document.querySelectorAll(selectors).forEach(element => { element.disabled = locked; });
    const initialize = byId('init-wg-btn');
    const closeout = byId('closeout-btn');
    if (initialize) initialize.disabled = locked;
    if (closeout) closeout.disabled = mode !== 'ready' || !health?.cycle || health.cycle.state !== 'active' || actionInFlight;
  }

  function scheduleSave(delay = 850) {
    if (mode === 'checking') { dirtyDuringBoot = true; return; }
    if (mode !== 'ready' || active() || conflict || actionInFlight) return;
    clearTimeout(timer);
    status('Unsaved Input changes');
    timer = setTimeout(() => { flushDraft().catch(() => {}); }, delay);
  }

  async function flushDraft() {
    if (mode !== 'ready' || active() || conflict) throw new Error('The authoritative draft is not writable.');
    clearTimeout(timer);
    if (inFlight) {
      await inFlight;
      if (conflict) throw new Error('Draft conflict. Reload before proceeding.');
    }
    const current = snapshot();
    const serialized = JSON.stringify(current);
    if (draftId && serialized === lastSaved) return;
    status('Saving Input draft...');
    const task = api('save_draft', {draft_id:draftId, revision:draftRevision, ...current});
    inFlight = task;
    try {
      const saved = await task;
      draftId = saved.draft.draft_id;
      draftRevision = saved.draft.revision;
      recoveredReview = {...saved.draft.import_review};
      recoveredReviewGroup = saved.draft.proposed_week_group || '';
      lastSaved = serialized;
      if (JSON.stringify(snapshot()) !== serialized) {
        status('Input changed during save; saving the latest revision...');
        setTimeout(() => flushDraft().catch(() => {}), 0);
      } else status(`Input saved in D1 · revision ${draftRevision}`);
    } catch (failure) {
      if (failure.code === 'draft_conflict' || failure.code === 'conflict') {
        conflict = true;
        status('Draft conflict: another device changed this draft. Reload before editing.', true);
      } else status(`Input was NOT saved: ${failure.message}`, true);
      throw failure;
    } finally {
      if (inFlight === task) inFlight = null;
    }
  }

  async function refreshHealth() {
    health = await api('health');
    if (!health.enabled) mode = 'legacy';
    else if (!health.ready || (health.cycle && health.legacy_week_group !== health.cycle.week_group)) mode = 'blocked';
    else mode = 'ready';
    lockInput();
    return health;
  }

  async function refreshApp() {
    if (typeof window.refresh === 'function') {
      await window.refresh();
      window.runGateHooks?.('afterDataChanged', {source:'gate-persistence-runtime'});
    } else window.location.reload();
    lockInput();
  }

  function adoptionButton() {
    const old = byId('gate-persistence-adopt');
    if (mode !== 'ready' || !health?.adoption_required) { old?.remove(); return; }
    if (old) { old.textContent = `Register active ${health.legacy_week_group}`; return; }
    const label = byId('gate-draft-persistence-status');
    if (!label) return;
    const button = document.createElement('button');
    button.id = 'gate-persistence-adopt';
    button.type = 'button';
    button.className = 'ml-2 rounded border px-3 py-2 text-xs font-semibold';
    button.textContent = `Register active ${health.legacy_week_group}`;
    button.addEventListener('click', () => { registerActive().catch(error => status(error.message, true)); });
    label.insertAdjacentElement('afterend', button);
  }

  async function registerActive() {
    if (actionInFlight || !instructor()) return;
    const observed = health?.legacy_week_group;
    if (!observed || !health?.adoption_required) return;
    actionInFlight = true;
    lockInput();
    try {
      await refreshHealth();
      if (mode !== 'ready' || health.legacy_week_group !== observed || !health.adoption_required) {
        return status('The active Week Group changed. Registration was not attempted; refresh and review.', true);
      }
      if (!window.confirm(`Register the existing active ${observed} in the lifecycle database? No dorm or bus records will be created or cleared.`)) return;
      await api('adopt');
      await refreshHealth();
      if (health.cycle?.state !== 'active' || health.cycle.week_group !== observed) throw new Error('Registration was not verified.');
      status(`${observed} registered without altering existing buses or dorms.`);
    } catch (failure) {
      status(`Registration not confirmed: ${failure.message}`, true);
      try { await refreshHealth(); } catch (_) {}
    } finally { actionInFlight = false; lockInput(); adoptionButton(); }
  }

  async function initialize() {
    if (actionInFlight) return;
    actionInFlight = true;
    lockInput();
    try {
      await refreshHealth();
      if (mode !== 'ready' || active()) throw new Error('Close out the existing active Week Group first.');
      if (conflict) throw new Error('Resolve the saved-draft conflict first.');
      await flushDraft();
      const requested = {draft_id:draftId, revision:draftRevision};
      let result;
      try { result = await api('initialize', requested); }
      catch (failure) {
        if (!(failure instanceof TypeError)) throw failure;
        // A lost HTTP response cannot be interpreted as a failed transaction.
        // Replay the SAME operation identity; the server returns its committed result.
        result = await api('initialize', requested);
      }
      draftId = null;
      draftRevision = null;
      lastSaved = '';
      recoveredReview = null;
      recoveredReviewGroup = '';
      await refreshHealth();
      await refreshApp();
      byId('init-success-overlay')?.classList.remove('hidden');
      status(`${result.week_group} initialized. Authoritative lifecycle verified.`);
    } catch (failure) {
      status(`Initialization not confirmed: ${failure.message}. Refresh authoritative state before another attempt.`, true);
      try { await refreshHealth(); } catch (_) {}
    } finally { actionInFlight = false; lockInput(); adoptionButton(); }
  }

  async function closeout() {
    if (actionInFlight) return;
    actionInFlight = true;
    lockInput();
    try {
      await refreshHealth();
      if (mode !== 'ready' || health.adoption_required || health.cycle?.state !== 'active') {
        throw new Error('Register the current active Week Group before closeout.');
      }
      const cycleId = health.cycle.cycle_id;
      const weekGroup = health.cycle.week_group;
      if (!window.confirm(`Close out ACTIVE ${weekGroup}? The complete archive and live-record clearance will commit in one transaction.`)) return;
      let result;
      try { result = await api('closeout', {cycle_id:cycleId}); }
      catch (failure) {
        if (!(failure instanceof TypeError)) throw failure;
        // Only a lost transport response is replayed, with the original cycle ID.
        result = await api('closeout', {cycle_id:cycleId});
      }
      await refreshHealth();
      if (health.cycle || health.legacy_week_group) throw new Error('Closeout response received, but an active cycle remains. Investigate before initializing.');
      window.runGateHooks?.('afterCloseout', {weekGroup, archiveId:result.archive_id, source:'gate-persistence-runtime'});
      const rows = controller()?.getRows?.();
      if (Array.isArray(rows)) rows.splice(0,rows.length,...Array.from({length:25},(_,index)=>emptyRow(index)));
      if (byId('wg-batch-input')) byId('wg-batch-input').value = '';
      WINDOWS.forEach(key => { if (byId(key)) byId(key).value = ''; });
      recoveredReview = null;
      recoveredReviewGroup = '';
      lastSaved = '';
      controller()?.renderBatchGrid?.();
      await refreshApp();
      status(`${weekGroup} archived as ${result.archive_id}; live records cleared atomically.`);
    } catch (failure) {
      status(`Closeout not confirmed: ${failure.message}. Check the active cycle and archive before retrying.`, true);
      try { await refreshHealth(); } catch (_) {}
    } finally { actionInFlight = false; lockInput(); adoptionButton(); }
  }

  function lifecycleClick(event) {
    const target = event.target?.closest?.('#init-wg-btn, #closeout-btn');
    if (!target || mode === 'legacy') return;
    // Intercept legacy handlers even while verification or authentication is pending.
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    if (!instructor()) return status('Instructor authorization is required.', true);
    if (mode !== 'ready') return status('Persistence verification is incomplete. No lifecycle change was made.', true);
    if (target.id === 'init-wg-btn') void initialize();
    else void closeout();
  }

  function inputChanged(event) {
    if (!instructor() || !event.target?.closest?.('#page-input, #gate-import-dialog')) return;
    const target = event.target;
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
      if (mode === 'blocked') return status('Persistence parity, triggers, or lifecycle state failed verification. Operations are blocked.', true);
      if (active()) {
        status(health.adoption_required ? `Register the existing active ${health.legacy_week_group} before closeout.` : `${health.cycle.week_group} is active. Input will unlock after closeout.`);
        adoptionButton();
        lockInput();
        return;
      }
      const draft = (await api('draft')).draft;
      if (draft && dirtyDuringBoot) {
        mode = 'blocked';
        lockInput();
        return status('An existing D1 draft conflicts with edits made during startup. Reload to recover it.', true);
      }
      if (draft) {
        if (!restore(draft)) throw new Error('Input draft could not be restored. No data was overwritten.');
        draftId = draft.draft_id;
        draftRevision = draft.revision;
        lastSaved = JSON.stringify(snapshot());
        const review = recoveredReview?.published_total !== null && recoveredReview?.published_total !== undefined
          ? ' Flight Alert review values remain stored in D1; review them before initializing.' : '';
        status(`Recovered Input draft · revision ${draftRevision}.${review}`);
      } else status('Input draft persistence is ready. Changes save to D1.');
      if (dirtyDuringBoot && !draft) scheduleSave();
      lockInput();
      adoptionButton();
    } catch (failure) {
      mode = 'blocked';
      lockInput();
      status(`Persistence startup failed: ${failure.message}. Lifecycle operations are blocked.`, true);
    }
  }

  window.addEventListener('click', lifecycleClick, true);
  window.addEventListener('input', inputChanged, true);
  window.addEventListener('change', inputChanged, true);
  window.addEventListener('click', potentialImport, true);
  window.registerGateHook?.('afterPageChange', lockInput);
  window.registerGateHook?.('afterRenderAll', lockInput);
  if (document.readyState === 'complete') void boot();
  else window.addEventListener('load', boot, {once:true});
})();
