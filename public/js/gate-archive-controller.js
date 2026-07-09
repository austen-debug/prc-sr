// GATE Phase 5 Archive / Reporting / Closeout Controller
// Canonical owner for closeout archive creation/verification, archive management, archive edit, and print/current summary handoffs.
(function () {
  'use strict';

  const WINDOW_FIELDS = [
    'receiving_day_one_start',
    'receiving_day_one_end',
    'receiving_day_two_start',
    'receiving_day_two_end'
  ];

  let installed = false;
  let hooksRegistered = false;
  let renderQueued = false;
  let archiveSearchTerm = '';
  let closeoutPatchAttempts = 0;
  let closeoutPatchTimer = null;

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
    try { return currentRole === 'instructor'; } catch (_) { return false; }
  }

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
    return records().find(record => record && record.type === 'archive' && record.__backendId === id) || null;
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

  function isSpaceForceDorm(dorm) {
    return dorm && (dorm.space_force === true || dorm.space_force === 'true' || dorm.is_space_force === true || dorm.is_space_force === 'true');
  }

  function isBandDorm(dorm) {
    return dorm && (dorm.band === true || dorm.band === 'true');
  }

  function dormLoad(dorm) {
    return n(dorm.current_load ?? dorm.loaded);
  }

  function busTime(bus) {
    return bus.arrived_at || bus.departed_at || bus.created_at || bus.updated_at || '';
  }

  function dormTime(dorm) {
    return dorm.closed_at || dorm.close_time || dorm.processed_at || dorm.updated_at || dorm.created_at || '';
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
    const date = timestamp(value);
    const s = timestamp(start);
    const e = timestamp(end);
    return Boolean(date && s && e && date.getTime() >= s.getTime() && date.getTime() < e.getTime());
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
    const femaleTotal = buses.reduce((sum, bus) => sum + n(bus.female_count), 0);
    const natTotal = buses.reduce((sum, bus) => sum + n(bus.nat_count), 0);
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

  async function runSafeCloseout() {
    if (!isInstructor()) {
      showCloseoutMessage('Instructor access required to close out week group.', true);
      return;
    }
    const weekGroup = activeWeekGroup();
    if (!weekGroup) {
      showCloseoutMessage('No active week group to close out.', true);
      return;
    }
    const dorms = getRecordsOfType('dorm').filter(dorm => dorm.week_group === weekGroup);
    const buses = getRecordsOfType('bus').filter(bus => bus.week_group === weekGroup);
    const soundEvents = getRecordsOfType('sound_event').filter(event => event.week_group === weekGroup);
    if (!dorms.length && !buses.length) {
      showCloseoutMessage('No dorm or bus records found for the active week group.', true);
      return;
    }

    const btn = document.getElementById('closeout-btn');
    const oldText = btn?.textContent || 'CLOSE OUT WEEK GROUP';
    try {
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'ARCHIVING...';
      }
      showCloseoutMessage('Creating archive record...');
      const payload = buildArchivePayload(weekGroup, dorms, buses);
      const result = await window.dataSdk.create(payload);
      if (!result?.isOk || !result.data?.__backendId) throw new Error(result?.error || 'Archive creation failed. Live records were not cleared.');
      syncLocalRecord(result.data || payload);

      showCloseoutMessage('Verifying archive record...');
      const verified = await verifyArchiveCreated(result.data.__backendId, weekGroup);
      if (!verified) throw new Error('Archive verification failed. Live records were not cleared.');

      showCloseoutMessage('Archive verified. Clearing live records...');
      await deleteRecordsSafely([...dorms, ...buses, ...soundEvents]);
      await clearConfig('last_airport', 'last airport arrival');
      await clearConfig('week_group', 'active week group');
      resetInputAfterCloseout();

      try { if (typeof renderAll === 'function') renderAll(); } catch (_) {}
      try { window.runGateHooks?.('afterCloseout', { weekGroup, archiveId: result.data.__backendId, source: 'gate-archive-controller' }); } catch (_) {}
      try { window.runGateHooks?.('afterDataChanged', { weekGroup, archiveId: result.data.__backendId, source: 'gate-archive-controller' }); } catch (_) {}
      renderArchiveManagementView({ force: true });
      showCloseoutMessage(`Week group ${weekGroup} archived and cleared.`);
      window.setTimeout(() => showCloseoutMessage(''), 6000);
    } catch (error) {
      console.error('GATE closeout failed:', error);
      showCloseoutMessage(error?.message || 'Closeout failed. Live records were not cleared.', true);
      window.alert(error?.message || 'Closeout failed. Live records were not cleared.');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = oldText;
      }
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
    if (!isInstructor()) return;
    const archive = archiveById(id);
    if (!archive) return;
    setEditArchiveId(id);
    ensureArchiveWindowPanel();
    setField('archive-edit-wg', archive.week_group || '');
    setField('archive-edit-archived-at', archive.archived_at || '');
    setField('archive-edit-dorm-count', n(archive.dorm_count));
    setField('archive-edit-bus-count', n(archive.bus_count));
    setField('archive-edit-total-arrived', n(archive.total_arrived));
    setField('archive-edit-female-total', n(archive.female_total));
    setField('archive-edit-nat-total', n(archive.nat_total));
    setField('archive-edit-dorm-data', safeJsonPretty(archive.dorm_data, []));
    setField('archive-edit-bus-data', safeJsonPretty(archive.bus_data, []));
    WINDOW_FIELDS.forEach(key => setField(`archive-edit-${key}`, archive[key] || ''));
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
    const modal = document.getElementById('archive-edit-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.setAttribute('aria-hidden', 'true');
    }
    setEditArchiveId('');
    document.body.classList.remove('gate-modal-open');
  }

  function readArchiveEditPayload(archive) {
    const dormData = parseFieldJson('archive-edit-dorm-data', []);
    const busData = parseFieldJson('archive-edit-bus-data', []);
    const windows = {};
    WINDOW_FIELDS.forEach(key => { windows[key] = document.getElementById(`archive-edit-${key}`)?.value || archive[key] || ''; });
    return Object.assign({}, archive, windows, {
      week_group: document.getElementById('archive-edit-wg')?.value.trim() || archive.week_group,
      archived_at: document.getElementById('archive-edit-archived-at')?.value.trim() || archive.archived_at,
      dorm_count: n(document.getElementById('archive-edit-dorm-count')?.value),
      bus_count: n(document.getElementById('archive-edit-bus-count')?.value),
      total_arrived: n(document.getElementById('archive-edit-total-arrived')?.value),
      female_total: n(document.getElementById('archive-edit-female-total')?.value),
      nat_total: n(document.getElementById('archive-edit-nat-total')?.value),
      space_force_total: busData.reduce((sum, bus) => sum + n(bus.space_force_count), 0),
      dorm_data: JSON.stringify(dormData),
      bus_data: JSON.stringify(busData),
      archive_schema_version: archive.archive_schema_version || 'gate-archive-schema-v3-canonical',
      updated_at: new Date().toISOString()
    });
  }

  async function saveArchiveEdit(event) {
    if (event?.target?.id !== 'archive-edit-form') return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    if (!isInstructor()) return;
    const archive = archiveById();
    if (!archive) return;
    try {
      const payload = readArchiveEditPayload(archive);
      const result = await window.dataSdk.update(payload);
      if (!result?.isOk) throw new Error(result?.error || 'Failed to save archive.');
      syncLocalRecord(result.data || payload);
      closeArchiveEditModalCanonical();
      renderArchiveManagementView({ force: true });
      try { window.runGateHooks?.('afterDataChanged', { source: 'gate-archive-edit-save' }); } catch (_) {}
    } catch (error) {
      showArchiveMessage(`Archive save failed: ${error.message}`, true);
    }
  }

  function archiveSpaceForceTotal(archive) {
    const explicit = n(archive?.space_force_total) || n(archive?.arrived_space_force_total);
    if (explicit) return explicit;
    return parseJson(archive?.bus_data, []).reduce((sum, bus) => sum + n(bus.space_force_count), 0);
  }

  function archiveTotals(items) {
    return items.reduce((totals, archive) => {
      totals.records += 1;
      totals.dorms += n(archive.dorm_count);
      totals.buses += n(archive.bus_count);
      totals.arrived += n(archive.total_arrived);
      totals.female += n(archive.female_total);
      totals.nat += n(archive.nat_total);
      totals.sf += archiveSpaceForceTotal(archive);
      return totals;
    }, { records: 0, dorms: 0, buses: 0, arrived: 0, female: 0, nat: 0, sf: 0 });
  }

  function filteredArchives() {
    const term = String(archiveSearchTerm || '').trim().toLowerCase();
    const list = archiveRecords();
    return term ? list.filter(record => String(record.week_group || '').toLowerCase().includes(term)) : list;
  }

  function archiveCard(archive) {
    const time = archiveTime(archive).getTime() ? archiveTime(archive).toLocaleString([], { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'No archive timestamp';
    return `<button type="button" class="gate-archive-record-card" data-archive-id="${esc(archive.__backendId)}" data-owner="gate-archive-controller"><span><span class="gate-archive-record-title">${esc(archive.week_group || 'Archived Week Group')}</span><span class="gate-archive-record-meta">Archived ${esc(time)}</span></span><span class="gate-archive-record-stats"><span class="gate-archive-stat-pill">${n(archive.dorm_count)} Dorms</span><span class="gate-archive-stat-pill">${n(archive.bus_count)} Buses</span><span class="gate-archive-stat-pill">${n(archive.total_arrived)} Arrived</span><span class="gate-archive-stat-pill">${n(archive.female_total)} Female</span><span class="gate-archive-stat-pill">${n(archive.nat_total)} NAT</span><span class="gate-archive-stat-pill">${archiveSpaceForceTotal(archive)} Space Force</span></span></button>`;
  }

  function renderArchiveManagementView(options = {}) {
    const container = document.getElementById('archive-history');
    if (!container) return;
    const search = document.getElementById('gate-archive-search');
    const focus = search === document.activeElement;
    const selectionStart = focus ? search.selectionStart : null;
    if (search) archiveSearchTerm = search.value;

    const all = archiveRecords();
    const visible = filteredArchives();
    const totals = archiveTotals(visible.length ? visible : all);
    container.className = 'gate-archive-manager';
    container.dataset.owner = 'gate-archive-controller';
    const toolbar = `<section class="gate-archive-toolbar"><div><span class="gate-archive-toolbar-title">Archive Management</span><span class="gate-archive-toolbar-copy">${visible.length} of ${all.length} Week Groups · ${totals.arrived} Arrived · ${totals.sf} Space Force</span></div><label class="gate-archive-search-wrap" for="gate-archive-search"><span class="gate-archive-search-label">Search Week Group</span><input id="gate-archive-search" type="search" value="${esc(archiveSearchTerm)}" placeholder="Type week group..."></label><button id="gate-archive-clear-search" type="button" class="gate-archive-clear-search" ${archiveSearchTerm ? '' : 'disabled'}>Clear</button></section>`;
    if (!all.length) container.innerHTML = toolbar + '<div class="gate-archive-empty"><span><span class="gate-archive-empty-title">No Archived Week Groups</span><span class="gate-archive-empty-copy">Archives will appear here after a week group is closed and archived.</span></span></div>';
    else if (!visible.length) container.innerHTML = toolbar + '<div class="gate-archive-empty"><span><span class="gate-archive-empty-title">No Matching Week Groups</span><span class="gate-archive-empty-copy">Clear the filter or search a different week group.</span></span></div>';
    else container.innerHTML = toolbar + `<div class="gate-archive-record-list">${visible.map(archiveCard).join('')}</div>`;

    bindArchiveSearchControls();
    if (focus) {
      const next = document.getElementById('gate-archive-search');
      next?.focus({ preventScroll: true });
      try { next?.setSelectionRange(selectionStart ?? next.value.length, selectionStart ?? next.value.length); } catch (_) {}
    }
  }

  function bindArchiveSearchControls() {
    const input = document.getElementById('gate-archive-search');
    if (input && input.dataset.gateArchiveBound !== 'true') {
      input.dataset.gateArchiveBound = 'true';
      input.addEventListener('input', () => { archiveSearchTerm = input.value; scheduleRender(); });
      input.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
          archiveSearchTerm = '';
          input.value = '';
          scheduleRender();
        }
      });
    }
    const clear = document.getElementById('gate-archive-clear-search');
    if (clear && clear.dataset.gateArchiveBound !== 'true') {
      clear.dataset.gateArchiveBound = 'true';
      clear.addEventListener('click', event => {
        event.preventDefault();
        archiveSearchTerm = '';
        scheduleRender();
      });
    }
  }

  function rows(items, mapper, colspan) {
    return items.length ? items.map(mapper).join('') : `<tr><td colspan="${colspan}" class="empty-row">No records.</td></tr>`;
  }

  function receivingSummary(dorms, buses, windows) {
    const afExpected = dorms.filter(d => !isSpaceForceDorm(d)).reduce((sum, d) => sum + n(d.max_load), 0);
    const sfExpected = dorms.filter(isSpaceForceDorm).reduce((sum, d) => sum + n(d.max_load), 0);
    const nightDefs = [
      ['Receiving Night One', windows.receiving_day_one_start, windows.receiving_day_one_end],
      ['Receiving Night Two', windows.receiving_day_two_start, windows.receiving_day_two_end]
    ];
    let afCum = 0;
    let sfCum = 0;
    let natCum = 0;
    return nightDefs.map(([label, start, end]) => {
      const hasWindow = Boolean(timestamp(start) && timestamp(end));
      const dayDorms = hasWindow ? dorms.filter(d => inWindow(dormTime(d), start, end)) : [];
      const afToday = dayDorms.filter(d => !isSpaceForceDorm(d)).reduce((sum, d) => sum + dormLoad(d), 0);
      const sfToday = dayDorms.filter(isSpaceForceDorm).reduce((sum, d) => sum + dormLoad(d), 0);
      const natToday = hasWindow ? buses.filter(b => inWindow(busTime(b), start, end)).reduce((sum, b) => sum + n(b.nat_count), 0) : 0;
      afCum += afToday;
      sfCum += sfToday;
      natCum += natToday;
      return `<div class="night"><div class="night-title">${esc(label)} <span class="night-date">${esc(formatDateTime(start))}</span></div><div class="night-text">${hasWindow ? `Processed ${afToday} AF / ${sfToday} SF tonight. Cumulative: ${afCum} AF, ${sfCum} SF, ${afCum + sfCum} of ${afExpected + sfExpected} total projected trainees. Naturalization requests: ${natToday} tonight / ${natCum} cumulative.` : `${label} date/time window is not configured.`}</div></div>`;
    }).join('');
  }

  function printableHtml({ title, weekGroup, archivedAt = '', dorms, buses, windows }) {
    const loaded = dorms.reduce((sum, dorm) => sum + dormLoad(dorm), 0);
    const expected = dorms.reduce((sum, dorm) => sum + n(dorm.max_load), 0);
    const arrived = buses.reduce((sum, bus) => sum + n(bus.otw_count), 0);
    const female = buses.reduce((sum, bus) => sum + n(bus.female_count), 0);
    const nat = buses.reduce((sum, bus) => sum + n(bus.nat_count), 0);
    const sfArrivals = buses.reduce((sum, bus) => sum + n(bus.space_force_count), 0);
    const generated = new Date().toLocaleString();
    const dormRows = rows([...dorms].sort((a, b) => clean(a.dorm_name || a.name).localeCompare(clean(b.dorm_name || b.name), undefined, { numeric: true })), dorm => `<tr><td>${esc(clean(dorm.dorm_name || dorm.name))}</td><td>${esc([dorm.sdq, dorm.section, dorm.inter_sec].filter(Boolean).join(' · ') || '—')}</td><td>${esc([isSpaceForceDorm(dorm) ? 'SF' : 'AF', dorm.sex || '', isBandDorm(dorm) ? 'Band' : ''].filter(Boolean).join(' / '))}</td><td class="num">${dormLoad(dorm)} / ${n(dorm.max_load)}</td><td>${esc(clean(dorm.phase || dorm.state))}</td><td>${esc(clean(dorm.closed_timer || dorm.elapsed || ''))}</td></tr>`, 6);
    const busRows = rows([...buses].sort((a, b) => clean(a.bus_type).localeCompare(clean(b.bus_type)) || clean(a.bus_id).localeCompare(clean(b.bus_id), undefined, { numeric: true })), bus => `<tr><td>${esc(bus.bus_type === 'local' ? clean(bus.destination || bus.originating_destination, 'Local Arrival') : `Bus #${clean(bus.bus_id)}`)}</td><td>${esc(clean(bus.bus_type))}</td><td>${esc(clean(bus.status))}</td><td class="num">${n(bus.otw_count)}</td><td class="num">${n(bus.female_count)}</td><td class="num">${n(bus.nat_count)}</td><td class="num">${n(bus.space_force_count)}</td><td>${esc(formatTime(busTime(bus)))}</td></tr>`, 8);
    return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(weekGroup)} ${esc(title)}</title><style>@page{size:Letter landscape;margin:.25in}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;background:#fff;margin:0}.sheet{padding:.08in}.classification{height:.24in;display:flex;align-items:center;justify-content:center;background:#166534;color:#fff;border:1px solid #14532d;font-size:8px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.no-print{margin:8px 0;padding:6px 10px;border:1px solid #94a3b8;border-radius:6px;background:#0f172a;color:#fff;font-weight:900}.top{display:grid;grid-template-columns:1fr 2.8in;gap:.12in;padding:.1in 0;border-bottom:2px solid #0f172a}.title h1{margin:0;font-size:20px;text-transform:uppercase;letter-spacing:-.035em}.subtitle{margin-top:4px;color:#475569;font-size:9px;font-weight:900;text-transform:uppercase}.meta{border:1px solid #cbd5e1;background:#f8fafc;padding:.06in;font-size:8px}.row{display:flex;justify-content:space-between;gap:8px;margin-bottom:3px}.label{color:#475569;font-weight:900;text-transform:uppercase}.value{font-weight:900;text-align:right}.metrics{display:grid;grid-template-columns:repeat(6,1fr);gap:.06in;margin:.1in 0}.box{border:1px solid #cbd5e1;background:#f8fafc;padding:.06in;min-height:.45in}.box .label{font-size:7px}.big{font-size:18px;font-weight:900;margin-top:2px}.section-title{margin:.08in 0 .04in;font-size:9px;font-weight:900;text-transform:uppercase;border-bottom:1px solid #cbd5e1;padding-bottom:2px}.receiving-summary{display:grid;grid-template-columns:1fr 1fr;gap:.08in}.night{border:1px solid #cbd5e1;background:#f8fafc;padding:.06in}.night-title{font-size:8px;font-weight:900;text-transform:uppercase}.night-date{color:#64748b}.night-text{font-size:8px;line-height:1.35;font-weight:700;margin-top:3px}.detail-grid{display:grid;grid-template-columns:1.4fr 1fr;gap:.08in;margin-top:.06in}table{width:100%;border-collapse:collapse;font-size:7px;table-layout:fixed}th,td{border:1px solid #cbd5e1;padding:3px;text-align:left;vertical-align:top;overflow:hidden;text-overflow:ellipsis}th{background:#e2e8f0;font-size:6px;text-transform:uppercase}.num{text-align:right;font-variant-numeric:tabular-nums}.empty-row{text-align:center;color:#64748b}.footer{display:flex;justify-content:space-between;margin-top:.08in;border-top:2px solid #0f172a;padding-top:.04in;color:#475569;font-size:7px;font-weight:800}@media print{.no-print{display:none}.classification,.box,.night,th,.meta{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body><main class="sheet"><div class="classification">UNCLASSIFIED / NO PII / STATUS COUNTS ONLY</div><button class="no-print" onclick="window.print()">Print / Save as PDF</button><header class="top"><div class="title"><h1>${esc(title)}</h1><div class="subtitle">Gateway Arrival Tracking Environment — Pfingston Reception Center</div></div><div class="meta"><div class="row"><span class="label">Week Group</span><span class="value">${esc(weekGroup)}</span></div><div class="row"><span class="label">Archived</span><span class="value">${esc(formatDateTime(archivedAt))}</span></div><div class="row"><span class="label">Generated</span><span class="value">${esc(generated)}</span></div></div></header><section class="metrics"><div class="box"><div class="label">Arrived</div><div class="big">${arrived}</div></div><div class="box"><div class="label">Loaded</div><div class="big">${loaded}</div></div><div class="box"><div class="label">Expected</div><div class="big">${expected}</div></div><div class="box"><div class="label">Females</div><div class="big">${female}</div></div><div class="box"><div class="label">NAT</div><div class="big">${nat}</div></div><div class="box"><div class="label">Space Force</div><div class="big">${sfArrivals}</div></div></section><div class="section-title">Receiving Processing Summary</div><section class="receiving-summary">${receivingSummary(dorms, buses, windows)}</section><section class="detail-grid"><div><div class="section-title">Dorm Detail Snapshot</div><table><thead><tr><th>Dorm</th><th>Sq / Sec / Int</th><th>Flags</th><th>Load</th><th>Status</th><th>Timer</th></tr></thead><tbody>${dormRows}</tbody></table></div><div><div class="section-title">Bus Detail Snapshot</div><table><thead><tr><th>Bus / Source</th><th>Type</th><th>Status</th><th>Total</th><th>F</th><th>NAT</th><th>SF</th><th>Time</th></tr></thead><tbody>${busRows}</tbody></table></div></section><div class="footer"><span>Prepared by GATE</span><span>No PII / status counts only / full record retained in archive JSON</span></div><div class="classification">UNCLASSIFIED / NO PII / STATUS COUNTS ONLY</div></main></body></html>`;
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

  function printArchiveReport(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    event?.stopImmediatePropagation?.();
    const archive = archiveById();
    if (!archive) return showArchiveMessage('Open an archived week group before printing.', true);
    try {
      const dorms = parseFieldJson('archive-edit-dorm-data', []);
      const buses = parseFieldJson('archive-edit-bus-data', []);
      const windows = collectWindows({ weekGroup: archive.week_group, archive, dorms });
      const weekGroup = document.getElementById('archive-edit-wg')?.value.trim() || archive.week_group || 'Week Group';
      openPrintWindow(printableHtml({ title: 'GATE Receiving Archive Report', weekGroup, archivedAt: archive.archived_at, dorms, buses, windows }), `gate-archive-report/${encodeURIComponent(weekGroup)}`);
    } catch (error) {
      showArchiveMessage(`Print failed: ${error.message}`, true);
    }
  }

  function printCurrentSummaryReport(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    event?.stopImmediatePropagation?.();
    const weekGroup = activeWeekGroup();
    if (!weekGroup) return window.alert('Initialize or select a Week Group before printing a current summary.');
    const dorms = getRecordsOfType('dorm').filter(dorm => dorm.week_group === weekGroup);
    const buses = getRecordsOfType('bus').filter(bus => bus.week_group === weekGroup);
    const windows = collectWindows({ weekGroup, dorms });
    openPrintWindow(printableHtml({ title: 'GATE Receiving Current Summary', weekGroup, archivedAt: '', dorms, buses, windows }), `gate-current-summary/${encodeURIComponent(weekGroup)}`);
  }

  function ensureCurrentSummaryButton() {
    const page = document.getElementById('page-archives');
    if (!page) return;
    let button = document.getElementById('print-current-summary-btn');
    if (!button) {
      const container = page.querySelector('.max-w-3xl') || page;
      const title = container.querySelector('h2, h3');
      button = document.createElement('button');
      button.id = 'print-current-summary-btn';
      button.type = 'button';
      button.className = 'px-4 py-2 rounded-lg font-bold text-white text-sm mb-4';
      button.style.background = 'var(--blue)';
      if (title) title.insertAdjacentElement('afterend', button);
      else container.insertAdjacentElement('afterbegin', button);
    }
    button.textContent = 'Print Current Summary';
    button.dataset.owner = 'gate-archive-controller';
    button.onclick = printCurrentSummaryReport;
  }

  function bindArchivePrintButton() {
    const button = document.querySelector('#archive-edit-modal button[onclick="printArchiveSpreadsheet()"], #archive-edit-modal button[data-archive-print="true"]');
    if (!button) return;
    button.textContent = 'PRINT / PDF';
    button.dataset.archivePrint = 'true';
    button.dataset.owner = 'gate-archive-controller';
    button.onclick = printArchiveReport;
  }

  function handleClick(event) {
    const card = event.target?.closest?.('#archive-history [data-archive-id]');
    if (card) {
      openArchiveEditModalCanonical(event, card.dataset.archiveId);
      return;
    }
    const archivePrint = event.target?.closest?.('#archive-edit-modal button[data-archive-print="true"], #archive-edit-modal button[onclick="printArchiveSpreadsheet()"]');
    if (archivePrint) {
      printArchiveReport(event);
      return;
    }
    const current = event.target?.closest?.('#print-current-summary-btn');
    if (current) printCurrentSummaryReport(event);
  }

  function patchGlobals() {
    window.initiateCloseout = initiateCloseoutCanonical;
    window.renderArchives = renderArchiveManagementView;
    window.openArchiveEditModal = openArchiveEditModalCanonical;
    window.closeArchiveEditModal = closeArchiveEditModalCanonical;
    window.printArchiveSpreadsheet = printArchiveReport;
    window.printCurrentSummaryReport = printCurrentSummaryReport;
    try { initiateCloseout = initiateCloseoutCanonical; } catch (_) {}
    try { renderArchives = renderArchiveManagementView; } catch (_) {}
    try { openArchiveEditModal = openArchiveEditModalCanonical; } catch (_) {}
    try { closeArchiveEditModal = closeArchiveEditModalCanonical; } catch (_) {}
    try { printArchiveSpreadsheet = printArchiveReport; } catch (_) {}
  }

  function scheduleRender(options = {}) {
    if (renderQueued && !options.force) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      runPass();
    });
  }

  function runPass() {
    patchGlobals();
    patchCloseoutButton();
    ensureArchiveWindowPanel();
    ensureCurrentSummaryButton();
    bindArchivePrintButton();
    renderArchiveManagementView();
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
      refresh: () => scheduleRender({ force: true })
    });
  }

  function registerHooksOnce() {
    if (hooksRegistered || typeof window.registerGateHook !== 'function') return;
    window.registerGateHook('afterRenderAll', () => scheduleRender({ force: true }));
    window.registerGateHook('afterPageChange', () => scheduleRender());
    window.registerGateHook('afterDataChanged', () => scheduleRender({ force: true }));
    window.registerGateHook('afterModalOpen', () => scheduleRender());
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
