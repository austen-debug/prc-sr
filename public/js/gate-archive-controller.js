// GATE Phase 8C Archive / Reporting / Closeout Controller
// Canonical owner for closeout archive creation/verification, archive management, archive edit, and print/current summary handoffs.
(function () {
  'use strict';

  const WINDOW_FIELDS = [
    'receiving_day_one_start',
    'receiving_day_one_end',
    'receiving_day_two_start',
    'receiving_day_two_end'
  ];

  const receivingEngineReady = globalThis.GateReceivingWindowEngine
    ? Promise.resolve(globalThis.GateReceivingWindowEngine)
    : import('/js/gate-receiving-window-engine.js?v=receiving-day-truth-20260928')
      .then(() => globalThis.GateReceivingWindowEngine);
  const receivingEngine = () => globalThis.GateReceivingWindowEngine || null;

  let installed = false;
  let hooksRegistered = false;
  let renderQueued = false;
  let archiveSearchTerm = '';
  let archiveYearFilter = 'all';
  let archiveIndex = [];
  let archiveIndexLoaded = false;
  let archiveIndexPromise = null;
  let archiveRefreshQueued = false;
  let selectedArchiveId = '';
  const archiveDetailCache = new Map();
  const archiveDetailPromises = new Map();
  let closeoutPatchAttempts = 0;
  let closeoutPatchTimer = null;
  let closeoutInProgress = false;
  let weekGroupProgressPhraseIndex = 0;

  function n(value) {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function esc(value) {
    if (typeof window.GateComponents?.esc === 'function') return window.GateComponents.esc(value);
    if (typeof escapeHtml === 'function') return escapeHtml(value);
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function clean(value, fallback = '—') {
    const text = String(value ?? '').trim();
    return text ? text : fallback;
  }

  function records() {
    try { return Array.isArray(allData) ? allData : []; } catch (_) { return []; }
  }

  function getRecordsOfType(type) {
    if (typeof window.getRecords === 'function') return window.getRecords(type);
    return records().filter(record => record && record.type === type);
  }

  function activeWeekGroup() {
    try { return typeof window.getActiveWG === 'function' ? window.getActiveWG() : ''; } catch (_) { return ''; }
  }

  function isInstructor() {
    const serverRole = document.body?.dataset.gateSessionRole || '';
    if (serverRole) return ['instructor','admin'].includes(serverRole);
    try { return ['instructor','admin'].includes(currentRole); } catch (_) { return false; }
  }

  function canAmendArchive() {
    const role = document.body?.dataset.gateSessionRole || (typeof currentRole === 'undefined' ? '' : currentRole);
    return role === 'instructor' || role === 'admin';
  }

  let amendmentSaveInProgress = false;
  let amendmentOutcomeUnknown = false;

  function setEditArchiveId(id) {
    try { editArchiveId = id || null; } catch (_) { window.editArchiveId = id || null; }
  }

  function getEditArchiveId() {
    try { return editArchiveId || ''; } catch (_) { return window.editArchiveId || ''; }
  }

  function archiveRecords() {
    return getRecordsOfType('archive').sort((a, b) => archiveTime(b).getTime() - archiveTime(a).getTime());
  }

  function archiveById(id = getEditArchiveId()) {
    // The canonical archive read model applies all recorded amendments.
    return archiveDetailCache.get(String(id || ''))?.archive || null;
  }

  function archiveTime(archive) {
    const date = new Date(archive?.archived_at || archive?.created_at || archive?.updated_at || '');
    return Number.isNaN(date.getTime()) ? new Date(0) : date;
  }

  function parseJson(value, fallback = []) {
    try {
      if (!String(value || '').trim()) return fallback;
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function safeJsonPretty(value, fallback = []) {
    try { return JSON.stringify(parseJson(value, fallback), null, 2); } catch (_) { return JSON.stringify(fallback, null, 2); }
  }

  function parseFieldJson(id, fallback = []) {
    const field = document.getElementById(id);
    const value = field ? field.value.trim() : '';
    if (!value) return fallback;
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) throw new Error(`${id} must contain a JSON array.`);
    return parsed;
  }

  function truthyFlag(value) {
    return value === true || value === 'true' || value === '1' || value === 1;
  }

  function isSpaceForceDorm(dorm) {
    return dorm && (truthyFlag(dorm.space_force) || truthyFlag(dorm.is_space_force));
  }

  function isBandDorm(dorm) {
    return dorm && truthyFlag(dorm.band);
  }

  function dormLoad(dorm) {
    return n(dorm.current_load ?? dorm.loaded);
  }

  function busTime(bus) {
    return bus.arrived_at || bus.departed_at || bus.created_at || bus.updated_at || '';
  }

  function busSpaceForceCount(bus) {
    return Math.min(n(bus.space_force_count), n(bus.otw_count));
  }

  function busAirForceCount(bus) {
    return Math.max(n(bus.otw_count) - busSpaceForceCount(bus), 0);
  }

  function timestamp(value) {
    const date = new Date(value || '');
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatDateTime(value) {
    const date = timestamp(value);
    return date ? date.toLocaleString([], { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
  }

  function formatTime(value) {
    const date = timestamp(value);
    return date ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
  }

  function inWindow(value, start, end) {
    return receivingEngine()?.inWindow(value, start, end) === true;
  }

  function formatReceivingWindowDateTime(value) {
    const epoch = receivingEngine()?.toEpoch(value);
    if (!Number.isFinite(epoch)) return '—';
    return new Intl.DateTimeFormat('en-US', {
      timeZone: receivingEngine()?.TIME_ZONE || 'America/Chicago',
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    }).format(new Date(epoch));
  }

  function collectWindows({ weekGroup = '', archive = {}, dorms = [] } = {}) {
    if (typeof window.GateInputPageController?.collectReceivingWindows === 'function') {
      return window.GateInputPageController.collectReceivingWindows({ weekGroup, archive, dorms });
    }
    if (typeof window.collectReceivingWindowsForReport === 'function') {
      return window.collectReceivingWindowsForReport({ weekGroup, archive, dorms });
    }
    const values = {};
    const firstDormWithWindows = (Array.isArray(dorms) ? dorms : []).find(dorm => WINDOW_FIELDS.some(key => dorm && dorm[key])) || {};
    WINDOW_FIELDS.forEach(key => {
      values[key] = document.getElementById(`archive-edit-${key}`)?.value || document.getElementById(key)?.value || archive[key] || firstDormWithWindows[key] || '';
    });
    return values;
  }

  function closeoutStatusElement() {
    const closeoutBtn = document.getElementById('closeout-btn');
    if (!closeoutBtn) return null;
    let el = document.getElementById('closeout-safety-msg');
    if (!el) {
      el = document.createElement('div');
      el.id = 'closeout-safety-msg';
      el.className = 'text-xs font-bold text-muted';
      el.style.minHeight = '20px';
      closeoutBtn.insertAdjacentElement('afterend', el);
    }
    return el;
  }

  function showCloseoutMessage(message, isError = false) {
    const el = closeoutStatusElement();
    if (!el) {
      if (isError) window.alert(message);
      return;
    }
    el.textContent = message;
    el.style.color = isError ? 'var(--red)' : 'var(--green)';
  }

  // Native modal stays above every page re-render while the canonical closeout runs.
  // It owns no operational records, timers, or persistence; confirmation remains separate.
  function showCloseoutProgress(weekGroup, action = 'closeout') {
    const phrases = [
      '60 SECONDS… HYDRATE',
      'I PROMISE IT’S DOING SOMETHING…',
      'DO TEN PUSH-UPS WHILE YOU WAIT',
      'DFAC ASSISTANTS GO!',
      'SHORT CHOPPY STEPPING OUR WAY THROUGH PROCESSING…',
      'HYDRATE OR DIE',
      'I… AM AN AMERICAN AIRMAN…',
      'GUIDON IS CURRENTLY ENTERING THE STAIRWELL…'
    ];
    let dialog = document.getElementById('gate-closeout-progress');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'gate-closeout-progress';
      dialog.className = 'gate-closeout-progress';
      dialog.setAttribute('aria-labelledby', 'gate-closeout-progress-title');
      dialog.setAttribute('aria-describedby', 'gate-closeout-progress-stage gate-closeout-progress-phrase');
      dialog.setAttribute('aria-modal', 'true');
      dialog.innerHTML = [
        '<div class="gate-closeout-progress-panel">',
        '<span class="gate-closeout-progress-spinner" aria-hidden="true"></span>',
        '<h2 id="gate-closeout-progress-title">ARCHIVING WEEK GROUP</h2>',
        '<p id="gate-closeout-progress-week"></p>',
        '<p id="gate-closeout-progress-stage" role="status" aria-live="polite" aria-atomic="true"></p>',
        '<p id="gate-closeout-progress-phrase"></p>',
        '</div>'
      ].join('');
      // Escape must not cancel the server-side closeout after it has begun.
      dialog.addEventListener('cancel', event => event.preventDefault());
      document.body.appendChild(dialog);
    }
    dialog.querySelector('#gate-closeout-progress-title').textContent = action === 'initialize' ? 'INITIALIZING WEEK GROUP' : 'ARCHIVING WEEK GROUP';
    dialog.querySelector('#gate-closeout-progress-week').textContent = 'Week Group: ' + weekGroup;
    dialog.querySelector('#gate-closeout-progress-phrase').textContent = phrases[weekGroupProgressPhraseIndex];
    weekGroupProgressPhraseIndex = (weekGroupProgressPhraseIndex + 1) % phrases.length;
    updateCloseoutProgress(action === 'initialize' ? 'Registering Week Group…' : 'Creating archive record…');
    if (!dialog.open) dialog.showModal();
  }

  function updateCloseoutProgress(message) {
    const stage = document.getElementById('gate-closeout-progress-stage');
    if (stage) stage.textContent = message;
  }

  function hideCloseoutProgress() {
    const dialog = document.getElementById('gate-closeout-progress');
    if (!dialog) return;
    if (dialog.open) dialog.close();
    dialog.remove();
  }

  // Shared Input-page progress presentation; controllers retain ownership of their writes.
  window.GateWeekGroupProgress = Object.freeze({
    show: showCloseoutProgress,
    update: updateCloseoutProgress,
    hide: hideCloseoutProgress
  });

  function showArchiveMessage(message, isError = true) {
    const msg = document.getElementById('archive-edit-msg');
    if (!msg) {
      if (isError) window.alert(message);
      return;
    }
    msg.textContent = message || '';
    msg.style.color = isError ? 'var(--red)' : 'var(--green)';
    msg.classList.toggle('hidden', !message);
  }

  function syncLocalRecord(record) {
    if (!record || !record.__backendId) return;
    const list = records();
    const index = list.findIndex(item => item.__backendId === record.__backendId);
    if (index >= 0) list[index] = { ...list[index], ...record };
    else list.push(record);
  }

  function removeLocalRecord(record) {
    if (!record || !record.__backendId) return;
    const list = records();
    const index = list.findIndex(item => item.__backendId === record.__backendId);
    if (index >= 0) list.splice(index, 1);
  }

  async function fetchRecordsDirectly() {
    const response = await fetch('/api/records', { method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store' });
    const result = await response.json();
    if (!result.isOk) throw new Error(result.error || 'Unable to fetch records.');
    return Array.isArray(result.records) ? result.records : [];
  }

  function buildDormHistory(dorms, windows = {}) {
    return dorms.map(dorm => Object.assign({}, windows, {
      name: dorm.dorm_name,
      dorm_name: dorm.dorm_name,
      sdq: dorm.sdq || '',
      section: dorm.section || '',
      inter_sec: dorm.inter_sec || '',
      sex: dorm.sex || '',
      band: dorm.band || 'false',
      space_force: dorm.space_force || dorm.is_space_force || 'false',
      is_space_force: dorm.is_space_force || dorm.space_force || 'false',
      auditorium_location: dorm.auditorium_location || '',
      current_load: n(dorm.current_load),
      max_load: n(dorm.max_load),
      state: dorm.state || '',
      phase: dorm.phase || '',
      notes: dorm.notes || '',
      assigned_airman: dorm.assigned_airman || '',
      opened_at: dorm.opened_at || '',
      closed_at: dorm.closed_at || '',
      closed_timer: dorm.closed_timer || '',
      open_time: dorm.opened_at ? formatTime(dorm.opened_at) : '—',
      close_time: dorm.closed_at ? formatTime(dorm.closed_at) : '—',
      elapsed: dorm.closed_timer || '—'
    }));
  }

  function buildBusHistory(buses) {
    return buses.map(bus => ({
      bus_id: bus.bus_id || '',
      bus_type: bus.bus_type || 'airport',
      originating_destination: bus.originating_destination || bus.destination || '',
      destination: bus.destination || '',
      departed_at: bus.departed_at || bus.created_at || '',
      created_at: bus.created_at || '',
      arrived_at: bus.arrived_at || '',
      otw_count: n(bus.otw_count),
      female_count: n(bus.female_count),
      nat_count: n(bus.nat_count),
      space_force_count: n(bus.space_force_count),
      status: bus.status || ''
    }));
  }

  function buildArchivePayload(weekGroup, dorms, buses) {
    const windows = collectWindows({ weekGroup, dorms });
    const arrivedBuses = buses.filter(bus => bus.status === 'arrived');
    const totalArrived = arrivedBuses.reduce((sum, bus) => sum + n(bus.otw_count), 0);
    const femaleTotal = arrivedBuses.reduce((sum, bus) => sum + n(bus.female_count), 0);
    const natTotal = arrivedBuses.reduce((sum, bus) => sum + n(bus.nat_count), 0);
    const spaceForceTotal = buses.reduce((sum, bus) => sum + n(bus.space_force_count), 0);
    const arrivedSpaceForceTotal = arrivedBuses.reduce((sum, bus) => sum + n(bus.space_force_count), 0);
    const loadedTotal = dorms.reduce((sum, dorm) => sum + n(dorm.current_load), 0);
    const expectedTotal = dorms.reduce((sum, dorm) => sum + n(dorm.max_load), 0);
    return Object.assign({}, windows, {
      type: 'archive',
      week_group: weekGroup,
      archived_at: new Date().toISOString(),
      dorm_count: dorms.length,
      bus_count: buses.length,
      total_arrived: totalArrived,
      total_loaded: loadedTotal,
      total_expected: expectedTotal,
      female_total: femaleTotal,
      nat_total: natTotal,
      space_force_total: spaceForceTotal,
      arrived_space_force_total: arrivedSpaceForceTotal,
      dorm_data: JSON.stringify(buildDormHistory(dorms, windows)),
      bus_data: JSON.stringify(buildBusHistory(buses)),
      archive_schema_version: 'gate-archive-schema-v3-canonical',
      closeout_safety_version: 'archive-verified-before-clear-v3'
    });
  }

  async function verifyArchiveCreated(archiveId, weekGroup) {
    const latest = await fetchRecordsDirectly();
    return latest.some(record => record.__backendId === archiveId && record.type === 'archive' && record.week_group === weekGroup && String(record.archive_schema_version || '').startsWith('gate-archive-schema-v3'));
  }

  async function deleteRecordsSafely(items) {
    const failures = [];
    for (const item of items) {
      const result = await window.dataSdk.delete(item);
      if (result?.isOk) removeLocalRecord(item);
      else failures.push(item.dorm_name || item.bus_id || item.type || item.__backendId || 'record');
    }
    if (failures.length) throw new Error(`Archive verified, but ${failures.length} live record(s) could not be cleared.`);
  }

  async function clearConfig(key, label) {
    const latest = await fetchRecordsDirectly();
    const record = latest.find(item => item.type === 'config' && item.key === key);
    if (!record) return;
    const result = await window.dataSdk.update({ ...record, value: '', updated_at: new Date().toISOString() });
    if (!result?.isOk) throw new Error(`Archive verified, but ${label} could not be cleared.`);
    syncLocalRecord(result.data || { ...record, value: '' });
  }

  function resetInputAfterCloseout() {
    const input = document.getElementById('wg-batch-input');
    if (input) input.value = '';
    try {
      batchRows = Array.from({ length: 25 }, (_, index) => ({ rowIndex: index, sdq: '', sec: '', inter_sec: '', dorm_name: '', sex: 'male', band: false, space_force: false, load: '' }));
    } catch (_) {
      window.batchRows = Array.from({ length: 25 }, (_, index) => ({ rowIndex: index, sdq: '', sec: '', inter_sec: '', dorm_name: '', sex: 'male', band: false, space_force: false, load: '' }));
    }
    try { window.GateInputPageController?.refresh?.(); } catch (_) {}
    try { if (typeof initBatchGrid === 'function') initBatchGrid(); } catch (_) {}
    try { if (typeof updateTotalLoadCalc === 'function') updateTotalLoadCalc(); } catch (_) {}
  }

  // Legacy closeout is a single authenticated D1 batch, never a sequence of
  // browser-directed record deletions. Server generates and verifies the
  // lossless archive, clears the active records and config atomically.
  async function runSafeCloseout() {
    if (closeoutInProgress) return;
    if (!isInstructor()) return showCloseoutMessage('Instructor access required to close out Week Group.', true);
    const weekGroup = activeWeekGroup();
    if (!weekGroup) return showCloseoutMessage('No active Week Group to close out.', true);

    const button = document.getElementById('closeout-btn');
    closeoutInProgress = true;
    let committed = false;
    let timeout = null;
    try {
      if (button) button.disabled = true;
      showCloseoutProgress(weekGroup);
      updateCloseoutProgress('Verifying operational records and preparing lossless archive…');
      const requestId = window.crypto?.randomUUID?.();
      if (!requestId) throw new Error('Secure operation identity is unavailable; closeout was not attempted.');
      const windows = collectWindows({ weekGroup,
        dorms: getRecordsOfType('dorm').filter(dorm => dorm.week_group === weekGroup) });
      const controller = new AbortController();
      timeout = window.setTimeout(() => controller.abort(), 30000);
      let response;
      try {
        response = await fetch('/api/legacy-closeout', {
          method:'POST', credentials:'same-origin', cache:'no-store', signal:controller.signal,
          headers:{'Content-Type':'application/json','Accept':'application/json'},
          body:JSON.stringify({week_group:weekGroup,request_id:requestId,receiving_windows:windows})
        });
      } catch (error) {
        // A dropped/aborted response does not prove the transaction rolled back.
        // Reconcile by the same request ID; never issue a second closeout write.
        if (timeout !== null) window.clearTimeout(timeout);
        timeout = null;
        updateCloseoutProgress('Connection interrupted. Checking whether archive committed…');
        let recovered;
        try {
          const status = await fetch('/api/legacy-closeout?request_id=' + encodeURIComponent(requestId), {
            credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'},
            signal:AbortSignal.timeout(10000)
          });
          recovered = await status.json();
          if (!status.ok || !recovered.isOk) recovered = null;
        } catch (_) {}
        if (!recovered?.closed)
          throw new Error('Closeout outcome is not confirmed. Do not retry or initialize another Week Group until records and archive are reconciled.');
        response = {ok:true,json:async()=>recovered};
      } finally {
        if (timeout !== null) window.clearTimeout(timeout);
        timeout = null;
      }
      const result = await response.json();
      if (!response.ok || !result?.isOk || !result.closed)
        throw new Error(result?.error || 'Archive and clearance were not confirmed. No second closeout was attempted.');
      committed = true;
      updateCloseoutProgress('Archive committed; active records cleared atomically.');
      showCloseoutMessage(`Week Group ${weekGroup} archived as ${result.archive_id}; live records cleared.`);
    } catch (error) {
      console.error('GATE atomic closeout not confirmed:', error);
      showCloseoutMessage(error?.message || 'Closeout could not be verified.', true);
      window.alert(error?.message || 'Closeout could not be verified. Do not retry.');
    } finally {
      if (timeout !== null) window.clearTimeout(timeout);
      hideCloseoutProgress();
      closeoutInProgress = false;
      if (button) button.disabled = false;
    }
    if (committed) {
      // A fresh page load is the authoritative UI reconciliation. It removes
      // stale boards and Input controls without waiting on a possibly stalled
      // secondary records GET while the blocking progress modal is open.
      window.location.reload();
    }
  }

  function initiateCloseoutCanonical(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    event?.stopImmediatePropagation?.();
    const message = 'Close out this week group? GATE will create and verify the archive before clearing live records.';
    if (typeof showConfirm === 'function') showConfirm(message, runSafeCloseout);
    else if (window.confirm(message)) runSafeCloseout();
  }

  function patchCloseoutButton() {
    const btn = document.getElementById('closeout-btn');
    if (!btn) return false;
    closeoutStatusElement();
    btn.onclick = initiateCloseoutCanonical;
    btn.dataset.owner = 'gate-archive-controller';
    window.initiateCloseout = initiateCloseoutCanonical;
    try { initiateCloseout = initiateCloseoutCanonical; } catch (_) {}
    return true;
  }

  function ensureArchiveWindowPanel() {
    const form = document.getElementById('archive-edit-form');
    const anchor = document.getElementById('archive-edit-dorm-count')?.closest('.grid');
    if (!form || !anchor) return;
    let panel = document.getElementById('archive-receiving-windows-panel');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'archive-receiving-windows-panel';
      panel.className = 'grid grid-cols-2 gap-3';
      panel.dataset.owner = 'gate-archive-controller';
      panel.innerHTML = WINDOW_FIELDS.map(key => `<div><label for="archive-edit-${key}" class="block text-sm font-medium mb-1">${esc(key.replaceAll('_', ' ').toUpperCase())}</label><input id="archive-edit-${key}" type="datetime-local" class="w-full border rounded px-3 py-2 bg-transparent font-tabular" style="border-color:var(--border);color:var(--text);"></div>`).join('');
      anchor.insertAdjacentElement('beforebegin', panel);
    }
  }

  function setField(id, value) {
    const field = document.getElementById(id);
    if (field) field.value = value ?? '';
  }

  function openArchiveEditModalCanonical(event, id) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    event?.stopImmediatePropagation?.();
    if (!canAmendArchive() || amendmentOutcomeUnknown) return;
    const archive = archiveById(id);
    if (!archive) return;
    setEditArchiveId(id);
    ensureArchiveWindowPanel();
    setField('archive-edit-wg', archive.week_group || '');
    setField('archive-edit-archived-at', archive.archived_at || '');
    setField('archive-edit-dorm-count', n(archive.dorm_count));
    setField('archive-edit-bus-count', n(archive.bus_count));
    setField('archive-edit-total-arrived', n(archive.total_arrived));
    setField('archive-edit-total-expected', n(archive.total_expected));
    setField('archive-edit-total-loaded', n(archive.total_loaded));
    setField('archive-edit-female-total', n(archive.female_total));
    setField('archive-edit-nat-total', n(archive.nat_total));
    setField('archive-edit-reason', '');
    WINDOW_FIELDS.forEach(key => setField('archive-edit-'+key, String(archive[key]||'').slice(0,16)));
    showArchiveMessage('', false);
    const modal = document.getElementById('archive-edit-modal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.setAttribute('aria-hidden', 'false');
    }
    document.body.classList.add('gate-modal-open');
    try { window.runGateHooks?.('afterModalOpen', { modal: 'archive-edit', archiveId: id, source: 'gate-archive-controller' }); } catch (_) {}
  }

  function closeArchiveEditModalCanonical(event) {
    event?.preventDefault?.();
    if (amendmentSaveInProgress || amendmentOutcomeUnknown) return;
    const modal = document.getElementById('archive-edit-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.setAttribute('aria-hidden', 'true');
    }
    setEditArchiveId('');
    document.body.classList.remove('gate-modal-open');
  }

  function readArchiveEditPayload(archive) {
    const changes = {};
    const fields = {
      total_arrived:'archive-edit-total-arrived',
      total_expected:'archive-edit-total-expected',
      total_loaded:'archive-edit-total-loaded',
      female_total:'archive-edit-female-total',
      nat_total:'archive-edit-nat-total'
    };
    for (const [field,id] of Object.entries(fields)) {
      const raw=String(document.getElementById(id)?.value ?? '');
      if (!/^\d+$/.test(raw)||!Number.isSafeInteger(Number(raw))) throw new Error('Invalid '+field+' value.');
      const value=Number(raw);
      if (value!==Number(archive[field]||0)) changes[field]=value;
    }
    WINDOW_FIELDS.forEach(key=>{
      const value=String(document.getElementById('archive-edit-'+key)?.value||'');
      if (value!==String(archive[key]||'').slice(0,16)) changes[key]=value;
    });
    if (!Object.keys(changes).length) throw new Error('No changed fields. Enter a correction before saving.');
    const reason=String(document.getElementById('archive-edit-reason')?.value||'').trim();
    if (reason.length<5||reason.length>2000) throw new Error('Explain the correction in at least five characters.');
    return {reason,changes};
  }

  async function saveArchiveEdit(event) {
    if (event?.target?.id !== 'archive-edit-form') return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    if (!canAmendArchive()||amendmentSaveInProgress||amendmentOutcomeUnknown) return;
    const id=getEditArchiveId();
    const detail=archiveDetailCache.get(id);
    if (!detail?.archive||!Array.isArray(detail.amendments)) return showArchiveMessage('Reload the archive detail before amending.',true);
    const submit=event.target.querySelector('[type="submit"]');
    amendmentSaveInProgress=true;
    if(submit) submit.disabled=true;
    try {
      const {reason,changes}=readArchiveEditPayload(detail.archive);
      const requestId=window.crypto?.randomUUID?.();
      if (!requestId) throw new Error('Secure amendment identity is unavailable.');
      const payload={action:'amend_archive',archive_id:id,request_id:requestId,
        expected_amendment_count:detail.amendments.length,reason,changes};
      let committed=false;
      let response;
      try {
        response=await fetch('/api/persistence',{
          method:'POST',credentials:'same-origin',cache:'no-store',
          headers:{'Content-Type':'application/json',Accept:'application/json'},
          body:JSON.stringify(payload),signal:AbortSignal.timeout(30000)
        });
        const result=await response.json();
        if(!response.ok||!result?.isOk){
          const failure=new Error(result?.error||'Archive amendment was rejected.');
          failure.definitive=response.status>=400&&response.status<500;
          throw failure;
        }
        committed=true;
      }catch(error){
        if(error.definitive){
          if(response?.status===409){
            // Another operator amended this archive: discard stale revision before retry.
            archiveDetailCache.delete(id);
            void loadArchiveDetail(id,true);
          }
          throw error;
        }
        // Unknown network outcome: verify this exact amendment ID, never POST again.
        try {
          const check=await archiveApi('/api/archives?id='+encodeURIComponent(id));
          committed=Array.isArray(check.amendments)&&check.amendments.some(item=>item.amendment_id===requestId);
        }catch(_){}
        if(!committed){
          amendmentOutcomeUnknown=true;
          throw new Error('Amendment outcome is unconfirmed. Reload the archive to verify its history before making another correction.');
        }
      }
      archiveDetailCache.delete(id);
      archiveIndexLoaded=false;
      amendmentSaveInProgress=false;
      closeArchiveEditModalCanonical();
      // A committed correction is not reversed by an unavailable GET.
      try{
        await Promise.all([refreshArchiveIndex(true),loadArchiveDetail(id,true)]);
      }catch(_){
        showArchiveMessage('Amendment saved in D1. Refresh the archive to display the correction.',true);
      }
    }catch(error){
      showArchiveMessage(error?.message||'Unable to save amendment.',true);
    }finally{
      amendmentSaveInProgress=false;
      if(submit)submit.disabled=amendmentOutcomeUnknown;
    }
  }

  function archiveSpaceForceTotal(archive) {
    return n(archive?.space_force_total || archive?.arrived_space_force_total);
  }

  function integrityLabel(value) {
    if (value === 'lossless') return 'Lossless Snapshot';
    if (value === 'canonical') return 'Canonical Archive';
    return 'Legacy Archive';
  }

  function integrityTone(value) {
    if (value === 'lossless') return 'is-lossless';
    if (value === 'canonical') return 'is-canonical';
    return 'is-legacy';
  }

  async function archiveApi(url = '/api/archives') {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      credentials: 'same-origin'
    });
    const payload = await response.json();
    if (!response.ok || !payload?.isOk) throw new Error(payload?.error || 'Unable to load archive records.');
    return payload;
  }

  async function refreshArchiveIndex(force = false) {
    if (!isInstructor()) return [];
    if (archiveIndexPromise) {
      if (force) archiveRefreshQueued = true;
      return archiveIndexPromise;
    }
    archiveIndexPromise = archiveApi('/api/archives')
      .then(payload => {
        archiveIndex = Array.isArray(payload.archives) ? payload.archives : [];
        archiveIndexLoaded = true;
        if (selectedArchiveId && !archiveIndex.some(item => item.id === selectedArchiveId)) {
          selectedArchiveId = '';
        }
        renderArchiveManagementView();
        if (selectedArchiveId) void loadArchiveDetail(selectedArchiveId);
        return archiveIndex;
      })
      .catch(error => {
        archiveIndexLoaded = true;
        const container = document.getElementById('archive-history');
        if (container) {
          container.innerHTML = `<div class="gate-archive-empty is-error"><span><span class="gate-archive-empty-title">Archive Read Unavailable</span><span class="gate-archive-empty-copy">${esc(error.message)}</span></span></div>`;
        }
        return [];
      })
      .finally(() => {
        archiveIndexPromise = null;
        if (archiveRefreshQueued) {
          archiveRefreshQueued = false;
          void refreshArchiveIndex(true);
        }
      });
    return archiveIndexPromise;
  }

  async function loadArchiveDetail(id, force = false) {
    const key = String(id || '');
    if (!key) return null;
    if (!force && archiveDetailCache.has(key) && archiveDetailCache.get(key)?.isOk!==false) return archiveDetailCache.get(key);
    if (!force && archiveDetailPromises.has(key)) return archiveDetailPromises.get(key);
    const promise = archiveApi(`/api/archives?id=${encodeURIComponent(key)}`)
      .then(payload => {
        archiveDetailCache.set(key, payload);
        if (selectedArchiveId === key) renderArchiveManagementView();
        return payload;
      })
      .catch(error => {
        archiveDetailCache.set(key, { isOk: false, error: error.message || 'Unable to load archive.' });
        if (selectedArchiveId === key) renderArchiveManagementView();
        return null;
      })
      .finally(() => archiveDetailPromises.delete(key));
    archiveDetailPromises.set(key, promise);
    return promise;
  }

  function archiveTotals(items) {
    return items.reduce((totals, archive) => {
      totals.records += 1;
      totals.dorms += n(archive.dorm_count);
      totals.buses += n(archive.bus_count);
      totals.arrived += n(archive.total_arrived);
      totals.expected += n(archive.total_expected);
      totals.sf += archiveSpaceForceTotal(archive);
      return totals;
    }, { records: 0, dorms: 0, buses: 0, arrived: 0, expected: 0, sf: 0 });
  }

  function archiveYear(archive) {
    const date = archiveTime(archive);
    return date.getTime() ? String(date.getFullYear()) : 'Unknown';
  }

  function archiveMonth(archive) {
    const date = archiveTime(archive);
    return date.getTime()
      ? date.toLocaleString([], { month: 'long' })
      : 'Unknown Date';
  }

  function filteredArchives() {
    const term = String(archiveSearchTerm || '').trim().toLowerCase();
    return archiveIndex.filter(record => {
      const matchesTerm = !term || String(record.week_group || '').toLowerCase().includes(term);
      const matchesYear = archiveYearFilter === 'all' || archiveYear(record) === archiveYearFilter;
      return matchesTerm && matchesYear;
    });
  }


  // An archive index is a document library, not a second operational dashboard.
  function archiveListRow(archive) {
    const value = archiveTime(archive);
    const archived = value.getTime()
      ? value.toLocaleString([], { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : 'Date unavailable';
    return '<button type="button" class="gate-archive-list-row" data-archive-id="' + esc(archive.id) + '">' +
      '<span class="gate-archive-list-primary"><strong>' + esc(archive.week_group || 'Archived Week Group') + '</strong>' +
      '<span>Archived ' + esc(archived) + '</span></span>' +
      '<span class="gate-archive-list-counts">' + n(archive.total_arrived) + ' arrived <span aria-hidden="true">·</span> ' +
      n(archive.dorm_count) + ' dorms</span>' +
      '<span class="gate-archive-list-chevron" aria-hidden="true">›</span>' +
      '</button>';
  }

  function groupedArchiveHtml(items) {
    const groups = new Map();
    const sorted = [...items].sort((a, b) => archiveTime(b).getTime() - archiveTime(a).getTime());
    sorted.forEach(archive => {
      const year = archiveYear(archive);
      if (!groups.has(year)) groups.set(year, []);
      groups.get(year).push(archive);
    });
    return [...groups.entries()].map(([year, entries]) =>
      '<section class="gate-archive-year-group" aria-label="Archives from ' + esc(year) + '">' +
      '<div class="gate-archive-year-divider"><h3>' + esc(year) + '</h3><span>' +
      entries.length + ' Week Group' + (entries.length === 1 ? '' : 's') + '</span></div>' +
      '<div class="gate-archive-year-list">' + entries.map(archiveListRow).join('') + '</div>' +
      '</section>'
    ).join('');
  }


  function archiveWindowRow(label, start, end) {
    const configured = Boolean(timestamp(start) && timestamp(end));
    return '<div class="gate-archive-compact-line"><span>' + esc(label) + '</span><strong>' +
      (configured ? esc(formatDateTime(start)) + ' – ' + esc(formatDateTime(end)) : 'Not configured') +
      '</strong></div>';
  }

  function archiveDormRows(dorms) {
    if (!dorms.length) return '<tr><td colspan="6" class="gate-archive-table-empty">No dorm snapshot retained.</td></tr>';
    return [...dorms]
      .sort((a, b) => clean(a.dorm_name || a.name).localeCompare(clean(b.dorm_name || b.name), undefined, { numeric: true }))
      .map(dorm => `<tr><td><strong>${esc(clean(dorm.dorm_name || dorm.name))}</strong></td><td>${esc([dorm.sdq, dorm.section, dorm.inter_sec].filter(Boolean).join(' / ') || '—')}</td><td>${esc([isSpaceForceDorm(dorm) ? 'Space Force' : 'Air Force', dorm.sex || '', isBandDorm(dorm) ? 'Band' : ''].filter(Boolean).join(' · '))}</td><td class="num">${dormLoad(dorm)} / ${n(dorm.max_load)}</td><td>${esc(clean(dorm.phase || dorm.state))}</td><td class="num">${esc(clean(dorm.closed_timer || dorm.elapsed || ''))}</td></tr>`)
      .join('');
  }

  function archiveBusRows(buses) {
    if (!buses.length) return '<tr><td colspan="9" class="gate-archive-table-empty">No bus snapshot retained.</td></tr>';
    return [...buses]
      .sort((a, b) => (timestamp(busTime(a))?.getTime() || 0) - (timestamp(busTime(b))?.getTime() || 0))
      .map(bus => `<tr><td><strong>${esc(bus.bus_type === 'local' ? clean(bus.destination || bus.originating_destination, 'Local Arrival') : `Bus #${clean(bus.bus_id)}`)}</strong></td><td>${esc(clean(bus.bus_type))}</td><td>${esc(formatTime(bus.departed_at || bus.created_at))}</td><td>${esc(formatTime(bus.arrived_at))}</td><td>${esc(clean(bus.status))}</td><td class="num">${n(bus.otw_count)}</td><td class="num">${n(bus.female_count)}</td><td class="num">${n(bus.nat_count)}</td><td class="num">${n(bus.space_force_count)}</td></tr>`)
      .join('');
  }

  function archiveAmendments(amendments) {
    if (!amendments.length) return '<div class="gate-archive-amendment-empty">No corrections or amendments recorded.</div>';
    return `<ol class="gate-archive-amendment-list">${amendments.map(amendment => {
      const fields = Object.entries(amendment.changes || {}).map(([field, value]) =>
        `${field}: ${String(amendment.previous_values?.[field] ?? '—')} → ${String(value ?? '—')}`);
      return `<li><div><strong>Amendment #${n(amendment.amendment_number)}</strong><span>${esc(formatDateTime(amendment.created_at))} · ${esc(amendment.actor_role || 'unknown role')}</span></div><p>${esc(amendment.reason || 'Correction recorded.')}</p><small>${fields.length ? esc(fields.join(' · ')) : 'No display fields listed.'}</small></li>`;
    }).join('')}</ol>`;
  }


  function archiveBackButton() {
    return '<button id="gate-archive-back" type="button" class="gate-archive-back-action">' +
      '<span aria-hidden="true">←</span> All archived Week Groups</button>';
  }

  function archiveDetailSection(key, label, supportingText, contents, openPanels) {
    return '<details class="gate-archive-detail-section" data-archive-panel="' + esc(key) + '"' +
      (openPanels.has(key) ? ' open' : '') + '>' +
      '<summary><span class="gate-archive-detail-section-title">' + esc(label) + '</span>' +
      '<span class="gate-archive-detail-section-description">' + esc(supportingText) + '</span>' +
      '<span class="gate-archive-detail-chevron" aria-hidden="true">⌄</span></summary>' +
      '<div class="gate-archive-detail-section-body">' + contents + '</div></details>';
  }

  function archiveInspectorHtml(openPanels = new Set()) {
    if (!selectedArchiveId) return '';
    const detail = archiveDetailCache.get(selectedArchiveId);
    const back = '<nav class="gate-archive-detail-nav" aria-label="Archive navigation">' + archiveBackButton() + '</nav>';
    if (!detail) {
      return '<section class="gate-archive-focused-detail" data-archive-detail-id="' + esc(selectedArchiveId) + '">' +
        back + '<div class="gate-archive-loading" role="status">Loading Week Group details…</div></section>';
    }
    if (detail.isOk === false) {
      return '<section class="gate-archive-focused-detail" data-archive-detail-id="' + esc(selectedArchiveId) + '">' +
        back + '<div class="gate-archive-empty is-error"><span><strong>Archive unavailable</strong><span>' +
        esc(detail.error || 'Unable to load this archive.') + '</span></span></div></section>';
    }

    const archive = detail.archive || {};
    const dorms = Array.isArray(detail.dorms) ? detail.dorms : [];
    const buses = Array.isArray(detail.buses) ? detail.buses : [];
    const amendments = Array.isArray(detail.amendments) ? detail.amendments : [];
    const lifecycle = detail.lifecycle || null;
    const stat = (label, value) =>
      '<span class="gate-archive-overview-stat"><strong>' + n(value) + '</strong><small>' + esc(label) + '</small></span>';
    const stats = [
      stat('Arrived', archive.total_arrived),
      stat('Expected', archive.total_expected),
      stat('Loaded', archive.total_loaded),
      stat('Dorms', archive.dorm_count || dorms.length),
      stat('Buses', archive.bus_count || buses.length)
    ].join('');
    const smallerStats = [
      'Female ' + n(archive.female_total),
      'NAT ' + n(archive.nat_total),
      'Space Force ' + n(archive.space_force_total)
    ].join('  ·  ');

    const dormTable = '<div class="gate-archive-table-wrap"><table class="gate-archive-table">' +
      '<thead><tr><th>Dorm</th><th>Sq / Sec / Int</th><th>Population</th><th>Load</th><th>Final Status</th><th>Timer</th></tr></thead>' +
      '<tbody>' + archiveDormRows(dorms) + '</tbody></table></div>';
    const busTable = '<div class="gate-archive-table-wrap"><table class="gate-archive-table">' +
      '<thead><tr><th>Bus / Source</th><th>Type</th><th>Departed</th><th>Arrived</th><th>Status</th>' +
      '<th>Total</th><th>F</th><th>NAT</th><th>SF</th></tr></thead>' +
      '<tbody>' + archiveBusRows(buses) + '</tbody></table></div>';
    const windowRows =
      archiveWindowRow('Receiving Night One', archive.receiving_day_one_start, archive.receiving_day_one_end) +
      archiveWindowRow('Receiving Night Two', archive.receiving_day_two_start, archive.receiving_day_two_end);
    const history =
      '<p class="gate-archive-detail-disclaimer">Read-only history. Stored archives and source snapshots are not rewritten by this view.</p>' +
      '<div class="gate-archive-compact-line"><span>Snapshot</span><strong>' + esc(integrityLabel(archive.integrity)) + '</strong></div>' +
      '<div class="gate-archive-compact-line"><span>Schema</span><strong>' + esc(archive.archive_schema_version || 'Legacy / unspecified') + '</strong></div>' +
      '<div class="gate-archive-compact-line"><span>Lifecycle</span><strong>' +
        (lifecycle ? esc(lifecycle.state || 'closed') + ' · ' + esc(lifecycle.cycle_id || '—') : 'Unavailable') +
      '</strong></div>' +
      (archive.source_record_count ? '<p class="gate-archive-detail-secondary">' + n(archive.source_record_count) + ' retained source records</p>' : '') +
      '<div class="gate-archive-history-label">Correction history · ' + amendments.length + '</div>' +
      archiveAmendments(amendments);

    return '<section class="gate-archive-focused-detail" data-archive-detail-id="' + esc(selectedArchiveId) + '">' +
      back +
      '<header class="gate-archive-detail-head"><div><span class="gate-archive-kicker">Historical Receiving Record</span>' +
      '<h2>' + esc(archive.week_group || 'Archived Week Group') + '</h2>' +
      '<p>Archived ' + esc(formatDateTime(archive.archived_at)) + '</p></div>' +
      '<div class="gate-archive-detail-actions">' +
      (canAmendArchive() ? '<button type="button" class="gate-archive-print-action" data-archive-amend-id="' + esc(selectedArchiveId) + '">CREATE AMENDMENT</button>' : '') +
      '<button type="button" class="gate-archive-print-action" data-archive-print-id="' +
      esc(selectedArchiveId) + '">PRINT / PDF</button></div></header>' +
      '<div class="gate-archive-overview" aria-label="Week Group summary">' + stats + '</div>' +
      '<p class="gate-archive-overview-secondary">' + esc(smallerStats) + '</p>' +
      '<div class="gate-archive-detail-sections">' +
      archiveDetailSection('dorms', 'Dormitories', dorms.length + ' records', dormTable, openPanels) +
      archiveDetailSection('buses', 'Movement History', buses.length + ' bus records', busTable, openPanels) +
      archiveDetailSection('windows', 'Receiving Windows', 'Receiving Night One and Two', windowRows, openPanels) +
      archiveDetailSection('history', 'Record Information', amendments.length + ' correction' +
        (amendments.length === 1 ? '' : 's') + ' · ' + integrityLabel(archive.integrity), history, openPanels) +
      '</div></section>';
  }


  function renderArchiveManagementView() {
    const container = document.getElementById('archive-history');
    if (!container) return;
    const search = document.getElementById('gate-archive-search');
    const yearSelect = document.getElementById('gate-archive-year-filter');
    const searchFocused = search === document.activeElement;
    const selectionStart = searchFocused ? search.selectionStart : null;
    if (search) archiveSearchTerm = search.value;
    if (yearSelect) archiveYearFilter = yearSelect.value || 'all';

    // Preserve a user's expanded disclosure panels through unrelated re-renders,
    // but reset disclosure state when another historical record is selected.
    const previousDetail = container.querySelector('[data-archive-detail-id]');
    const openPanels = previousDetail?.dataset.archiveDetailId === selectedArchiveId
      ? new Set([...previousDetail.querySelectorAll('[data-archive-panel][open]')]
        .map(panel => panel.dataset.archivePanel))
      : new Set();

    if (!archiveIndexLoaded) {
      container.className = 'gate-archive-manager';
      container.innerHTML = '<div class="gate-archive-loading" role="status">Loading receiving archives…</div>';
      if (!archiveIndexPromise) void refreshArchiveIndex();
      return;
    }

    const visible = filteredArchives();
    const years = [...new Set(archiveIndex.map(archiveYear))].sort((a, b) =>
      b.localeCompare(a, undefined, { numeric: true }));
    const activeGroup = activeWeekGroup();
    // Preserve the established header, controls, active Week Group context, and printing.
    const hero = '<section class="gate-archive-hero"><div><span class="gate-archive-kicker">Historical Operations Repository</span><h1>Receiving Archives</h1><p>Closed Week Groups are presented from retained D1 archive records. Historical source snapshots remain untouched.</p></div><div class="gate-archive-hero-actions"><div class="gate-archive-current-report-row"><button id="print-current-summary-btn" type="button" class="gate-archive-current-report" ' +
      (activeGroup ? '' : 'disabled') + '>PRINT CURRENT SUMMARY</button><button id="print-tags-btn" type="button" class="gate-archive-current-report" title="Generate 3 × 2 inch folder tags for the current live Week Group" ' +
      (activeGroup ? '' : 'disabled') + '>PRINT TAGS</button><button id="print-matrix-btn" type="button" class="gate-archive-current-report gate-archive-matrix-action" title="Generate the landscape receiving matrix for the active Week Group" ' +
      (activeGroup ? '' : 'disabled') + '>PRINT MATRIX</button></div><span class="gate-archive-current-context">' +
      (activeGroup ? 'Active: ' + esc(activeGroup) : 'No active Week Group') + '</span></div></section>';

    if (selectedArchiveId) {
      container.className = 'gate-archive-manager gate-archive-detail-mode';
      container.dataset.owner = 'gate-archive-controller';
      container.innerHTML = hero + archiveInspectorHtml(openPanels);
    } else {
      const toolbar = '<section class="gate-archive-toolbar gate-archive-toolbar-simple">' +
        '<div class="gate-archive-toolbar-summary"><span class="gate-archive-toolbar-title">Archived Week Groups</span>' +
        '<span class="gate-archive-toolbar-copy">' + visible.length + ' of ' + archiveIndex.length + ' records</span></div>' +
        '<div class="gate-archive-library-filters">' +
        '<label class="gate-archive-search-wrap" for="gate-archive-search"><span class="gate-archive-search-label">Search Week Group</span>' +
        '<input id="gate-archive-search" type="search" value="' + esc(archiveSearchTerm) + '" placeholder="Search Week Group…"></label>' +
        '<label class="gate-archive-year-wrap" for="gate-archive-year-filter"><span class="gate-archive-search-label">Year</span>' +
        '<select id="gate-archive-year-filter"><option value="all">All years</option>' +
        years.map(year => '<option value="' + esc(year) + '"' +
          (archiveYearFilter === year ? ' selected' : '') + '>' + esc(year) + '</option>').join('') +
        '</select></label></div></section>';
      const library = !archiveIndex.length
        ? '<div class="gate-archive-empty"><span><strong>No Archived Week Groups</strong><span>Closed receiving records will appear here.</span></span></div>'
        : !visible.length
          ? '<div class="gate-archive-empty"><span><strong>No matching Week Groups</strong><span>Adjust the search or year filter.</span></span></div>'
          : groupedArchiveHtml(visible);
      container.className = 'gate-archive-manager gate-archive-library-mode';
      container.dataset.owner = 'gate-archive-controller';
      container.innerHTML = hero + toolbar +
        '<section class="gate-archive-library" aria-label="Archived Week Groups">' + library + '</section>';
      bindArchiveSearchControls();
    }

    if (searchFocused) {
      const next = document.getElementById('gate-archive-search');
      next?.focus({ preventScroll: true });
      try { next?.setSelectionRange(selectionStart ?? next.value.length, selectionStart ?? next.value.length); } catch (_) {}
    }
    if (selectedArchiveId && !archiveDetailCache.has(selectedArchiveId) && !archiveDetailPromises.has(selectedArchiveId)) {
      void loadArchiveDetail(selectedArchiveId);
    }
  }

  function bindArchiveSearchControls() {
    const input = document.getElementById('gate-archive-search');
    if (input && input.dataset.gateArchiveBound !== 'true') {
      input.dataset.gateArchiveBound = 'true';
      input.addEventListener('input', () => {
        archiveSearchTerm = input.value;
        scheduleRender();
      });
      input.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
          archiveSearchTerm = '';
          input.value = '';
          scheduleRender();
        }
      });
    }
    const year = document.getElementById('gate-archive-year-filter');
    if (year && year.dataset.gateArchiveBound !== 'true') {
      year.dataset.gateArchiveBound = 'true';
      year.addEventListener('change', () => {
        archiveYearFilter = year.value || 'all';
        scheduleRender();
      });
    }
    const clear = document.getElementById('gate-archive-clear-search');
    if (clear && clear.dataset.gateArchiveBound !== 'true') {
      clear.dataset.gateArchiveBound = 'true';
      clear.addEventListener('click', event => {
        event.preventDefault();
        archiveSearchTerm = '';
        archiveYearFilter = 'all';
        scheduleRender();
      });
    }
  }


  function selectArchive(id) {
    const next = String(id || '');
    if (!next) return;
    selectedArchiveId = next;
    renderArchiveManagementView();
    document.getElementById('archive-history')?.scrollIntoView({ block: 'start' });
    void loadArchiveDetail(next);
  }

  function showArchiveLibrary() {
    selectedArchiveId = '';
    renderArchiveManagementView();
    document.getElementById('archive-history')?.scrollIntoView({ block: 'start' });
  }

  function rows(items, mapper, colspan) {
    return items.length ? items.map(mapper).join('') : `<tr><td colspan="${colspan}" class="empty-row">No records.</td></tr>`;
  }

  function arrivedBuses(buses) {
    return (Array.isArray(buses) ? buses : []).filter(bus => String(bus?.status || '').toLowerCase() === 'arrived');
  }

  function reportMetrics(dorms, buses, summary = null) {
    if (summary) {
      return {
        arrived: n(summary.total_arrived),
        loaded: n(summary.total_loaded),
        expected: n(summary.total_expected),
        female: n(summary.female_total),
        nat: n(summary.nat_total),
        sf: n(summary.space_force_total || summary.arrived_space_force_total)
      };
    }
    const completed = arrivedBuses(buses);
    return {
      arrived: completed.reduce((sum, bus) => sum + n(bus.otw_count), 0),
      loaded: (Array.isArray(dorms) ? dorms : []).reduce((sum, dorm) => sum + dormLoad(dorm), 0),
      expected: (Array.isArray(dorms) ? dorms : []).reduce((sum, dorm) => sum + n(dorm.max_load), 0),
      female: completed.reduce((sum, bus) => sum + n(bus.female_count), 0),
      nat: completed.reduce((sum, bus) => sum + n(bus.nat_count), 0),
      sf: completed.reduce((sum, bus) => sum + n(bus.space_force_count), 0)
    };
  }

  function receivingSummary(dorms, buses, windows) {
    const totalProjected = dorms.reduce((sum, dorm) => sum + n(dorm.max_load), 0);
    const sfProjected = dorms.filter(isSpaceForceDorm).reduce((sum, dorm) => sum + n(dorm.max_load), 0);
    const summary = receivingEngine()?.summarizeArrivals(buses, windows);
    const dayDefs = [
      ['Receiving Day One', summary?.dayOne],
      ['Receiving Day Two', summary?.dayTwo]
    ];
    let processedCum = 0;
    let natCum = 0;
    let sfCum = 0;

    return dayDefs.map(([label, day]) => {
      const hasWindow = Boolean(day && Number.isFinite(day.start) && Number.isFinite(day.end));
      const processedToday = hasWindow ? n(day.totals.arrived) : 0;
      const natToday = hasWindow ? n(day.totals.naturalization) : 0;
      const sfToday = hasWindow ? n(day.totals.spaceForce) : 0;
      processedCum += processedToday;
      natCum += natToday;
      sfCum += sfToday;

      const standardSentence = `The PRC received and processed ${processedToday} of the projected ${totalProjected} trainees during this receiving day, for a cumulative total of ${processedCum}. ${natToday} trainees requested U.S. naturalization, for a cumulative total of ${natCum}.`;
      const sfSentence = (sfProjected > 0 || sfToday > 0 || sfCum > 0)
        ? ` The PRC received ${sfToday} Space Force trainees of the projected ${sfProjected}, for a cumulative total of ${sfCum} Space Force trainees.`
        : '';
      const range = hasWindow
        ? `${formatReceivingWindowDateTime(day.rawStart)} – ${formatReceivingWindowDateTime(day.rawEnd)}`
        : 'Window not configured';

      return `<article class="report-night"><div class="report-night-head"><strong>${esc(label)}</strong><span>${esc(range)}</span></div><p>${hasWindow ? esc(standardSentence + sfSentence) : 'No receiving window was configured for this period.'}</p></article>`;
    }).join('');
  }

  function chunks(items, size) {
    const list = Array.isArray(items) ? items : [];
    if (!list.length) return [];
    const result = [];
    for (let index = 0; index < list.length; index += size) result.push(list.slice(index, index + size));
    return result;
  }

  function reportChrome({ title, weekGroup, pageLabel, asOf, body }) {
    return `<section class="report-page"><div class="report-classification">UNCLASSIFIED / NO PII / STATUS COUNTS ONLY</div><header class="report-header"><div><span class="report-kicker">Gateway Arrival Tracking Environment</span><h1>${esc(title)}</h1><p>Pfingston Reception Center · Week Group ${esc(weekGroup)}</p></div><div class="report-meta"><div><span>Page</span><strong>${esc(pageLabel)}</strong></div><div><span>Data As Of</span><strong>${esc(asOf)}</strong></div></div></header><main class="report-body">${body}</main><footer class="report-footer"><span>Prepared by GATE</span><span>Historical source data remains retained in D1.</span></footer><div class="report-classification">UNCLASSIFIED / NO PII / STATUS COUNTS ONLY</div></section>`;
  }

  function printableHtml({ title, weekGroup, archivedAt = '', dorms, buses, windows, summary = null }) {
    const metrics = reportMetrics(dorms, buses, summary);
    const generated = new Date().toLocaleString();
    const asOf = archivedAt ? formatDateTime(archivedAt) : generated;
    const sortedDorms = [...dorms].sort((a, b) => clean(a.dorm_name || a.name).localeCompare(clean(b.dorm_name || b.name), undefined, { numeric: true }));
    const sortedBuses = [...buses].sort((a, b) => (timestamp(busTime(a))?.getTime() || 0) - (timestamp(busTime(b))?.getTime() || 0));
    const dormPages = chunks(sortedDorms, 19);
    const busPages = chunks(sortedBuses, 21);
    const totalPages = 1 + dormPages.length + busPages.length;
    let pageNumber = 1;

    const metricHtml = [
      ['Arrived', metrics.arrived],
      ['Loaded', metrics.loaded],
      ['Expected', metrics.expected],
      ['Female', metrics.female],
      ['NAT', metrics.nat],
      ['Space Force', metrics.sf]
    ].map(([label, value]) => `<div class="report-metric"><span>${esc(label)}</span><strong>${n(value)}</strong></div>`).join('');

    const summaryBody = `<section class="report-metrics">${metricHtml}</section><section class="report-section"><div class="report-section-title">Receiving Processing Summary</div><div class="report-night-grid">${receivingSummary(dorms, buses, windows)}</div></section><section class="report-summary-note"><strong>Report Basis</strong><span>Receiving Day totals include only ARRIVED bus records and classify them exclusively by ARRIVED AT time within the configured PRC Central-time window. En-route buses, departure times, and dorm processing times do not determine Receiving Day credit.</span></section>`;
    const pages = [reportChrome({
      title,
      weekGroup,
      pageLabel: `${pageNumber++} of ${totalPages}`,
      asOf,
      body: summaryBody
    })];

    dormPages.forEach((pageRows, index) => {
      const bodyRows = pageRows.length
        ? pageRows.map(dorm => `<tr><td><strong>${esc(clean(dorm.dorm_name || dorm.name))}</strong></td><td>${esc([dorm.sdq, dorm.section, dorm.inter_sec].filter(Boolean).join(' / ') || '—')}</td><td>${esc([isSpaceForceDorm(dorm) ? 'SF' : 'AF', dorm.sex || '', isBandDorm(dorm) ? 'Band' : ''].filter(Boolean).join(' · '))}</td><td class="num">${dormLoad(dorm)} / ${n(dorm.max_load)}</td><td>${esc(clean(dorm.phase || dorm.state))}</td><td class="num">${esc(clean(dorm.closed_timer || dorm.elapsed || ''))}</td></tr>`).join('')
        : '<tr><td colspan="6" class="empty-row">No dorm records retained.</td></tr>';
      const body = `<div class="report-section-title">Dormitory Detail · ${index + 1} of ${dormPages.length}</div><table class="report-table report-dorm-table"><colgroup><col style="width:16%"><col style="width:20%"><col style="width:19%"><col style="width:13%"><col style="width:20%"><col style="width:12%"></colgroup><thead><tr><th>Dorm</th><th>Sq / Sec / Int</th><th>Population</th><th>Load</th><th>Final Status</th><th>Timer</th></tr></thead><tbody>${bodyRows}</tbody></table>`;
      pages.push(reportChrome({ title, weekGroup, pageLabel: `${pageNumber++} of ${totalPages}`, asOf, body }));
    });

    busPages.forEach((pageRows, index) => {
      const bodyRows = pageRows.length
        ? pageRows.map(bus => `<tr><td><strong>${esc(bus.bus_type === 'local' ? clean(bus.destination || bus.originating_destination, 'Local Arrival') : `Bus #${clean(bus.bus_id)}`)}</strong></td><td>${esc(clean(bus.bus_type))}</td><td>${esc(formatTime(bus.departed_at || bus.created_at))}</td><td>${esc(formatTime(bus.arrived_at))}</td><td>${esc(clean(bus.status))}</td><td class="num">${n(bus.otw_count)}</td><td class="num">${n(bus.female_count)}</td><td class="num">${n(bus.nat_count)}</td><td class="num">${n(bus.space_force_count)}</td></tr>`).join('')
        : '<tr><td colspan="9" class="empty-row">No bus records retained.</td></tr>';
      const body = `<div class="report-section-title">Bus / Arrival Detail · ${index + 1} of ${busPages.length}</div><table class="report-table report-bus-table"><colgroup><col style="width:20%"><col style="width:10%"><col style="width:11%"><col style="width:11%"><col style="width:12%"><col style="width:9%"><col style="width:9%"><col style="width:9%"><col style="width:9%"></colgroup><thead><tr><th>Bus / Source</th><th>Type</th><th>Departed</th><th>Arrived</th><th>Status</th><th>Total</th><th>F</th><th>NAT</th><th>SF</th></tr></thead><tbody>${bodyRows}</tbody></table>`;
      pages.push(reportChrome({ title, weekGroup, pageLabel: `${pageNumber++} of ${totalPages}`, asOf, body }));
    });

    const css = `@page{size:11in 8.5in;margin:.35in}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#e2e8f0;color:#0f172a;font-family:Arial,Helvetica,sans-serif}.screen-controls{position:fixed;top:12px;right:12px;z-index:10}.screen-controls button{padding:10px 14px;border:0;border-radius:6px;background:#0f172a;color:#fff;font-weight:800;cursor:pointer}.report-page{width:10.3in;height:7.8in;margin:18px auto;background:#fff;display:flex;flex-direction:column;overflow:hidden;break-after:page;page-break-after:always;box-shadow:0 8px 30px rgba(15,23,42,.16)}.report-page:last-of-type{break-after:auto;page-break-after:auto}.report-classification{height:.24in;flex:0 0 .24in;display:flex;align-items:center;justify-content:center;background:#166534;color:#fff;border:1px solid #14532d;font-size:7.5pt;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.report-header{display:grid;grid-template-columns:minmax(0,1fr) 2.75in;gap:.22in;align-items:start;padding:.14in .08in .12in;border-bottom:2px solid #0f172a}.report-kicker{font-size:7.5pt;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#475569}.report-header h1{margin:.035in 0 0;font-size:17pt;line-height:1;text-transform:uppercase}.report-header p{margin:.055in 0 0;font-size:8.5pt;font-weight:700;color:#475569}.report-meta{display:grid;grid-template-columns:1fr 1fr;gap:.06in}.report-meta div{border:1px solid #cbd5e1;background:#f8fafc;padding:.07in}.report-meta span{display:block;font-size:6.5pt;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#64748b}.report-meta strong{display:block;margin-top:.025in;font-size:8pt}.report-body{flex:1;min-height:0;padding:.1in .08in;overflow:hidden}.report-metrics{display:grid;grid-template-columns:repeat(6,1fr);gap:.07in}.report-metric{border:1px solid #cbd5e1;background:#f8fafc;padding:.08in;min-height:.62in}.report-metric span{display:block;font-size:6.5pt;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#64748b}.report-metric strong{display:block;margin-top:.04in;font-size:18pt;line-height:1}.report-section{margin-top:.16in}.report-section-title{margin:0 0 .07in;padding-bottom:.035in;border-bottom:1px solid #94a3b8;font-size:8pt;font-weight:900;letter-spacing:.09em;text-transform:uppercase}.report-night-grid{display:grid;grid-template-columns:1fr 1fr;gap:.1in}.report-night{border:1px solid #cbd5e1;background:#f8fafc;padding:.09in;min-height:1.15in}.report-night-head{display:flex;justify-content:space-between;gap:.12in;align-items:baseline}.report-night-head strong{font-size:8pt;text-transform:uppercase}.report-night-head span{font-size:6.8pt;color:#64748b}.report-night p{margin:.08in 0 0;font-size:8pt;line-height:1.4;font-weight:600}.report-summary-note{display:grid;grid-template-columns:1.15in 1fr;gap:.1in;margin-top:.14in;padding:.08in;border:1px solid #cbd5e1}.report-summary-note strong{font-size:7pt;text-transform:uppercase}.report-summary-note span{font-size:7.5pt;line-height:1.35;color:#475569}.report-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:8pt}.report-table thead{display:table-header-group}.report-table tr{break-inside:avoid;page-break-inside:avoid}.report-table th,.report-table td{border:1px solid #cbd5e1;padding:.052in .045in;text-align:left;vertical-align:middle;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.report-table th{background:#e2e8f0;font-size:6.5pt;font-weight:900;letter-spacing:.055em;text-transform:uppercase}.report-table td.num,.report-table th.num{text-align:right;font-variant-numeric:tabular-nums}.empty-row{text-align:center!important;color:#64748b}.report-footer{height:.27in;flex:0 0 .27in;display:flex;align-items:center;justify-content:space-between;gap:.2in;padding:.04in .08in;border-top:1px solid #94a3b8;font-size:6.5pt;font-weight:700;color:#64748b}@media print{html,body{background:#fff}.screen-controls{display:none!important}.report-page{margin:0;width:10.3in;height:7.8in;box-shadow:none}.report-classification,.report-metric,.report-night,.report-meta div,.report-table th{-webkit-print-color-adjust:exact;print-color-adjust:exact}}`;
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(weekGroup)} ${esc(title)}</title><style>${css}</style></head><body><div class="screen-controls"><button type="button" onclick="window.print()">Print / Save as PDF</button></div>${pages.join('')}</body></html>`;
  }

  function openPrintWindow(html, slug = 'gate-report') {
    const printWindow = window.open(`${window.location.origin}/print/${slug}`, '_blank');
    if (!printWindow) {
      window.alert('Popup blocked. Allow popups to print or save the report.');
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
  }

  async function printArchiveReport(event) {
    event?.preventDefault?.();
    await receivingEngineReady;
    event?.stopPropagation?.();
    event?.stopImmediatePropagation?.();
    const triggerId = event?.target?.closest?.('[data-archive-print-id]')?.dataset.archivePrintId || '';
    const id = triggerId || selectedArchiveId;
    if (!id) return window.alert('Select an archived Week Group before printing.');
    try {
      const detail = await loadArchiveDetail(id);
      if (!detail?.archive) throw new Error('Archive detail is unavailable.');
      const archive = detail.archive;
      const dorms = Array.isArray(detail.dorms) ? detail.dorms : [];
      const buses = Array.isArray(detail.buses) ? detail.buses : [];
      const windows = {
        receiving_day_one_start: archive.receiving_day_one_start || '',
        receiving_day_one_end: archive.receiving_day_one_end || '',
        receiving_day_two_start: archive.receiving_day_two_start || '',
        receiving_day_two_end: archive.receiving_day_two_end || ''
      };
      const weekGroup = archive.week_group || 'Week Group';
      openPrintWindow(
        printableHtml({
          title: 'GATE Receiving Archive Report',
          weekGroup,
          archivedAt: archive.archived_at,
          dorms,
          buses,
          windows,
          summary: archive
        }),
        `gate-archive-report/${encodeURIComponent(weekGroup)}`
      );
    } catch (error) {
      window.alert(`Archive print failed: ${error.message || 'Unable to build report.'}`);
    }
  }

  async function printCurrentSummaryReport(event) {
    await receivingEngineReady;
    event?.preventDefault?.();
    event?.stopPropagation?.();
    event?.stopImmediatePropagation?.();
    const weekGroup = activeWeekGroup();
    if (!weekGroup) return window.alert('Initialize or select a Week Group before printing a current summary.');
    const dorms = getRecordsOfType('dorm').filter(dorm => dorm.week_group === weekGroup);
    const buses = getRecordsOfType('bus').filter(bus => bus.week_group === weekGroup);
    const windows = collectWindows({ weekGroup, dorms });
    openPrintWindow(
      printableHtml({
        title: 'GATE Receiving Current Summary',
        weekGroup,
        archivedAt: '',
        dorms,
        buses,
        windows
      }),
      `gate-current-summary/${encodeURIComponent(weekGroup)}`
    );
  }


  // Keep the preparation dialog outside the dynamically replaced Archive grid.
  // The existing delegated capture click handler remains the single button owner.
  function ensureMatrixDialog() {
    const existing = document.getElementById('gate-matrix-dialog');
    if (existing) return existing;
    const dialog = document.createElement('dialog');
    dialog.id = 'gate-matrix-dialog';
    dialog.className = 'gate-matrix-dialog';
    dialog.setAttribute('aria-labelledby', 'gate-matrix-dialog-title');
    dialog.innerHTML = [
      '<form id="gate-matrix-form" method="post" action="/api/reports/matrix" target="_blank" rel="noopener">',
      '<div class="gate-matrix-dialog-head">',
      '<span class="gate-archive-kicker">Receiving Reports</span>',
      '<h2 id="gate-matrix-dialog-title">Prepare Receiving Matrix</h2>',
      '<p id="gate-matrix-week-label" class="gate-matrix-week-label"></p>',
      '</div>',
      '<div class="gate-matrix-dialog-body">',
      '<p>GATE will fill in M/F, Dorm, SQ and Max Enrolled. All other matrix fields remain blank for handwriting.</p>',
      '<input type="hidden" name="week_group" id="gate-matrix-week-group">',
      '<label for="gate-matrix-notes">Print notes <span>(optional)</span></label>',
      '<textarea id="gate-matrix-notes" name="notes" rows="3" maxlength="220" placeholder="Notes to include in the PDF&#8230;"></textarea>',
      '<small>Maximum 220 characters. Notes print on the PDF only and are not saved to GATE.</small>',
      '</div>',
      '<div class="gate-matrix-dialog-actions">',
      '<button id="gate-matrix-cancel" type="button">Cancel</button>',
      '<button id="gate-matrix-generate" type="submit">Generate PDF</button>',
      '</div>',
      '</form>'
    ].join('');
    dialog.querySelector('#gate-matrix-cancel').addEventListener('click', () => dialog.close());
    dialog.querySelector('#gate-matrix-form').addEventListener('submit', () => {
      // Allow the browser's native new-tab POST before closing the preparation dialog.
      setTimeout(() => { if (dialog.open) dialog.close(); }, 0);
    });
    dialog.addEventListener('close', () => {
      document.getElementById('print-matrix-btn')?.focus({ preventScroll: true });
    });
    document.body.appendChild(dialog);
    return dialog;
  }

  function openMatrixDialog(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    event?.stopImmediatePropagation?.();
    if (!isInstructor()) {
      window.alert('Instructor access required to generate the receiving matrix.');
      return;
    }
    const weekGroup = activeWeekGroup();
    if (!weekGroup) {
      window.alert('No active Week Group is available to generate the receiving matrix.');
      return;
    }
    const dialog = ensureMatrixDialog();
    dialog.querySelector('#gate-matrix-week-group').value = weekGroup;
    dialog.querySelector('#gate-matrix-week-label').textContent = 'Week Group: ' + weekGroup;
    dialog.querySelector('#gate-matrix-notes').value = '';
    if (!dialog.open) dialog.showModal();
    dialog.querySelector('#gate-matrix-notes').focus();
  }

  function printDormTags(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    event?.stopImmediatePropagation?.();

    if (!isInstructor()) {
      window.alert('Instructor access required to generate folder tags.');
      return;
    }

    const weekGroup = activeWeekGroup();
    if (!weekGroup) {
      window.alert('No active Week Group is available to generate tags.');
      return;
    }

    const preview = window.open('/api/reports/tags', '_blank');
    if (!preview) {
      window.alert('Popup blocked. Allow popups to open the folder-tag PDF.');
      return;
    }
    try { preview.opener = null; } catch (_) {}
  }

  function ensureCurrentSummaryButton() {
    const summaryButton = document.getElementById('print-current-summary-btn');
    if (summaryButton) {
      summaryButton.dataset.owner = 'gate-archive-controller';
      summaryButton.onclick = printCurrentSummaryReport;
    }

    const tagButton = document.getElementById('print-tags-btn');
    if (tagButton) {
      tagButton.dataset.owner = 'gate-archive-controller';
      tagButton.onclick = printDormTags;
    }
  }

  function bindArchivePrintButton() {
    document.querySelectorAll('[data-archive-print-id]').forEach(button => {
      button.dataset.owner = 'gate-archive-controller';
    });
  }

  function handleClick(event) {
    const archiveBack = event.target?.closest?.('#gate-archive-back');
    if (archiveBack) {
      event.preventDefault();
      showArchiveLibrary();
      return;
    }
    const matrixPrint = event.target?.closest?.('#print-matrix-btn');
    if (matrixPrint) {
      openMatrixDialog(event);
      return;
    }
    const tagPrint = event.target?.closest?.('#print-tags-btn');
    if (tagPrint) {
      void printDormTags(event);
      return;
    }
    const current = event.target?.closest?.('#print-current-summary-btn');
    if (current) {
      void printCurrentSummaryReport(event);
      return;
    }
    const archiveAmend=event.target?.closest?.('[data-archive-amend-id]');
    if(archiveAmend){
      openArchiveEditModalCanonical(event,archiveAmend.dataset.archiveAmendId);
      return;
    }
    const archivePrint = event.target?.closest?.('[data-archive-print-id]');
    if (archivePrint) {
      void printArchiveReport(event);
      return;
    }
    const card = event.target?.closest?.('#archive-history [data-archive-id]');
    if (card) {
      event.preventDefault();
      selectArchive(card.dataset.archiveId);
    }
  }

  function archivePageActive() {
    return document.getElementById('page-archives')?.classList.contains('active') === true;
  }

  function renderArchivesFromLegacyLoop() {
    if (!archivePageActive()) return;
    if (!archiveIndexLoaded && !archiveIndexPromise) void refreshArchiveIndex();
  }

  function patchGlobals() {
    window.initiateCloseout = initiateCloseoutCanonical;
    window.renderArchives = renderArchivesFromLegacyLoop;
    window.openArchiveEditModal = openArchiveEditModalCanonical;
    window.closeArchiveEditModal = closeArchiveEditModalCanonical;
    window.printArchiveSpreadsheet = printArchiveReport;
    window.printCurrentSummaryReport = printCurrentSummaryReport;
    window.printDormTags = printDormTags;
    try { initiateCloseout = initiateCloseoutCanonical; } catch (_) {}
    try { renderArchives = renderArchivesFromLegacyLoop; } catch (_) {}
    try { openArchiveEditModal = openArchiveEditModalCanonical; } catch (_) {}
    try { closeArchiveEditModal = closeArchiveEditModalCanonical; } catch (_) {}
    try { printArchiveSpreadsheet = printArchiveReport; } catch (_) {}
  }

  function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      runPass();
    });
  }

  function refreshArchives() {
    archiveIndexLoaded = false;
    archiveDetailCache.clear();
    archiveDetailPromises.clear();
    return refreshArchiveIndex(true);
  }

  function runPass() {
    patchGlobals();
    patchCloseoutButton();
    if (archivePageActive()) {
      renderArchiveManagementView();
      ensureCurrentSummaryButton();
      bindArchivePrintButton();
    }
    window.GateArchiveController = Object.freeze({
      isCanonicalOwner: true,
      buildArchivePayload,
      runSafeCloseout,
      initiateCloseout: initiateCloseoutCanonical,
      renderArchives: renderArchiveManagementView,
      openArchiveEditModal: openArchiveEditModalCanonical,
      closeArchiveEditModal: closeArchiveEditModalCanonical,
      printArchiveReport,
      printCurrentSummaryReport,
      printDormTags,
      openMatrixDialog,
      refresh: refreshArchives
    });
  }

  function registerHooksOnce() {
    if (hooksRegistered || typeof window.registerGateHook !== 'function') return;
    window.registerGateHook('afterPageChange', context => {
      if (context?.page === 'archives') {
        scheduleRender();
        if (!archiveIndexLoaded) void refreshArchiveIndex();
      }
    });
    window.registerGateHook('afterCloseout', () => {
      archiveIndexLoaded = false;
      archiveDetailCache.clear();
      archiveDetailPromises.clear();
      void refreshArchiveIndex(true);
    });
    hooksRegistered = true;
  }

  function startCloseoutPatchRetry() {
    if (closeoutPatchTimer) return;
    closeoutPatchTimer = setInterval(() => {
      closeoutPatchAttempts += 1;
      patchCloseoutButton();
      if (closeoutPatchAttempts >= 24) {
        clearInterval(closeoutPatchTimer);
        closeoutPatchTimer = null;
      }
    }, 250);
  }

  function start() {
    if (!installed) {
      document.addEventListener('click', handleClick, true);
      document.addEventListener('submit', saveArchiveEdit, true);
      installed = true;
    }
    registerHooksOnce();
    runPass();
    startCloseoutPatchRetry();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  window.addEventListener('load', start, { once: true });
})();
