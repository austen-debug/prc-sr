// GATE Phase 4 Input Page Controller
// Canonical owner for Input page batch grid, Week Group initialization, receiving windows, Space Force dorm metadata, and initialization preflight validation.
(function () {
  'use strict';

  const WINDOW_STORAGE_PREFIX = 'gate_receiving_windows_';
  const ROW_COUNT = 25;
  const GRID_TEMPLATE = '1fr 1fr 1.5fr 1.5fr 1fr 0.5fr 0.5fr 1fr 40px';
  const WINDOW_FIELDS = [
    ['receiving_day_one_start', 'RECEIVING DAY ONE START DATE / TIME'],
    ['receiving_day_one_end', 'RECEIVING DAY ONE END DATE / TIME'],
    ['receiving_day_two_start', 'RECEIVING DAY TWO START DATE / TIME'],
    ['receiving_day_two_end', 'RECEIVING DAY TWO END DATE / TIME']
  ];

  let installed = false;
  let hooksRegistered = false;
  let passQueued = false;
  let dataSdkPatched = false;
  let archiveOpenPatched = false;

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

  function recordDisplay() {
    return window.GateRecordDisplay || null;
  }

  function activeWeekGroup() {
    try { return typeof getActiveWG === 'function' ? getActiveWG() : ''; } catch (_) { return ''; }
  }

  function allDataSafe() {
    try { return Array.isArray(allData) ? allData : []; } catch (_) { return []; }
  }

  function emptyRow(index) {
    return { rowIndex: index, sdq: '', sec: '', inter_sec: '', dorm_name: '', sex: 'male', band: false, space_force: false, load: '' };
  }

  function batchRowsSafe() {
    try {
      if (!Array.isArray(batchRows)) batchRows = Array.from({ length: ROW_COUNT }, (_, index) => emptyRow(index));
      while (batchRows.length < ROW_COUNT) batchRows.push(emptyRow(batchRows.length));
      batchRows.forEach((row, index) => {
        row.rowIndex = index;
        if (typeof row.sdq === 'undefined') row.sdq = '';
        if (typeof row.sec === 'undefined') row.sec = '';
        if (typeof row.inter_sec === 'undefined') row.inter_sec = '';
        if (typeof row.dorm_name === 'undefined') row.dorm_name = '';
        if (typeof row.sex === 'undefined') row.sex = 'male';
        if (typeof row.band === 'undefined') row.band = false;
        if (typeof row.space_force === 'undefined') row.space_force = false;
        if (typeof row.load === 'undefined') row.load = '';
        if (row.band && row.space_force) row.space_force = false;
      });
      return batchRows;
    } catch (_) {
      if (!Array.isArray(window.batchRows)) window.batchRows = Array.from({ length: ROW_COUNT }, (_, index) => emptyRow(index));
      return window.batchRows;
    }
  }

  function setBatchRow(index, patch) {
    const rows = batchRowsSafe();
    rows[index] = Object.assign(emptyRow(index), rows[index] || {}, patch || {}, { rowIndex: index });
  }

  function getWeekGroupInputValue() {
    return String(document.getElementById('wg-batch-input')?.value || activeWeekGroup() || '').trim().toUpperCase();
  }

  function storageKey(weekGroup = '') {
    return `${WINDOW_STORAGE_PREFIX}${weekGroup || getWeekGroupInputValue() || 'default'}`;
  }

  function parseStorage(weekGroup = '') {
    try { return JSON.parse(localStorage.getItem(storageKey(weekGroup)) || '{}'); } catch (_) { return {}; }
  }

  function readWindowInputs(weekGroup = '') {
    const stored = parseStorage(weekGroup);
    const values = {};
    WINDOW_FIELDS.forEach(([key]) => {
      values[key] = document.getElementById(key)?.value || stored[key] || '';
    });
    return values;
  }

  function saveWindowInputs(weekGroup = '') {
    try { localStorage.setItem(storageKey(weekGroup), JSON.stringify(readWindowInputs(weekGroup))); } catch (_) {}
  }

  function setWindowInputs(values = {}) {
    WINDOW_FIELDS.forEach(([key]) => {
      const input = document.getElementById(key);
      if (input && !input.matches(':focus')) input.value = values[key] || '';
    });
  }

  function parseDateTime(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function validateReceivingWindows() {
    const values = readWindowInputs();
    const pairs = [
      ['receiving_day_one_start', 'receiving_day_one_end', 'Receiving Day One'],
      ['receiving_day_two_start', 'receiving_day_two_end', 'Receiving Day Two']
    ];

    for (const [startKey, endKey, label] of pairs) {
      const start = values[startKey];
      const end = values[endKey];
      if ((start && !end) || (!start && end)) return `${label} requires both a start and end date/time.`;
      if (start && end) {
        const startDate = parseDateTime(start);
        const endDate = parseDateTime(end);
        if (!startDate || !endDate) return `${label} has an invalid date/time.`;
        if (endDate.getTime() <= startDate.getTime()) return `${label} end must be after start.`;
      }
    }

    const oneEnd = parseDateTime(values.receiving_day_one_end);
    const twoStart = parseDateTime(values.receiving_day_two_start);
    if (oneEnd && twoStart && twoStart.getTime() < oneEnd.getTime()) return 'Receiving Day Two cannot start before Receiving Day One ends.';
    return '';
  }

  function showInputMessage(message, isError = true) {
    const el = document.getElementById('init-status-msg');
    if (!el) {
      if (isError) window.alert(message);
      return;
    }
    el.textContent = message;
    el.className = `text-sm ${isError ? 'text-red-500' : 'text-green-400'}`;
    el.classList.remove('hidden');
    if (!isError) window.setTimeout(() => el.classList.add('hidden'), 4000);
  }

  function ensureInputPageShell() {
    const page = document.getElementById('page-input');
    const wrapper = document.getElementById('batch-grid-wrapper');
    if (!page) return;

    page.dataset.owner = 'gate-input-page-controller';
    page.dataset.component = 'input-page';

    if (wrapper) {
      wrapper.dataset.owner = 'gate-input-page-controller';
      wrapper.dataset.component = 'batch-grid-wrapper';
    }

    const initButton = document.getElementById('init-wg-btn');
    if (initButton) {
      initButton.dataset.owner = 'gate-input-page-controller';
      initButton.dataset.gateInputAction = 'initialize-week-group';
      initButton.removeAttribute('onclick');
      initButton.title = 'Validate input rows and initialize the selected week group.';
    }
  }

  function ensureReceivingWindowPanel() {
    const page = document.getElementById('page-input');
    const wgInput = document.getElementById('wg-batch-input');
    if (!page || !wgInput) return;

    const header = wgInput.closest('.flex-shrink-0');
    if (!header) return;

    let panel = document.getElementById('receiving-windows-panel');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'receiving-windows-panel';
      panel.className = 'mt-3 grid gap-3';
      panel.style.gridTemplateColumns = 'repeat(auto-fit, minmax(230px, 1fr))';
      panel.dataset.owner = 'gate-input-page-controller';
      panel.setAttribute('aria-label', 'Receiving Day One and Day Two date/time windows');
      panel.innerHTML = WINDOW_FIELDS.map(([key, label]) => `
        <div>
          <label for="${key}" class="block text-[10px] uppercase tracking-wider font-bold text-muted mb-1">${esc(label)}</label>
          <input id="${key}" type="datetime-local" class="w-full border rounded px-3 py-2 bg-transparent text-sm font-tabular" style="border-color:var(--border);color:var(--text);">
        </div>
      `).join('');
      header.appendChild(panel);
    }

    if (!panel.querySelector('.gate-input-window-help')) {
      const help = document.createElement('div');
      help.className = 'gate-input-window-help text-xs text-muted';
      help.style.gridColumn = '1 / -1';
      help.textContent = 'Receiving windows are optional but should be complete if used; they feed current summaries, archive reports, and closeout records.';
      panel.appendChild(help);
    }

    WINDOW_FIELDS.forEach(([key]) => {
      const input = document.getElementById(key);
      if (!input || input.dataset.gateInputWindowBound === 'true') return;
      input.dataset.gateInputWindowBound = 'true';
      input.dataset.owner = 'gate-input-page-controller';
      input.addEventListener('change', () => {
        saveWindowInputs();
        validateAndMarkWindows();
        schedulePass();
      });
      input.addEventListener('blur', () => {
        saveWindowInputs();
        validateAndMarkWindows();
      });
    });

    if (wgInput.dataset.gateInputWindowBound !== 'true') {
      wgInput.dataset.gateInputWindowBound = 'true';
      wgInput.addEventListener('change', () => {
        wgInput.value = String(wgInput.value || '').trim().toUpperCase();
        setWindowInputs(parseStorage(wgInput.value.trim()));
        validateAndMarkWindows();
        schedulePass();
      });
    }

    const stored = parseStorage();
    WINDOW_FIELDS.forEach(([key]) => {
      const input = document.getElementById(key);
      if (input && !input.value && stored[key]) input.value = stored[key];
    });
  }

  function validateAndMarkWindows() {
    const error = validateReceivingWindows();
    const panel = document.getElementById('receiving-windows-panel');
    if (!panel) return !error;

    let msg = document.getElementById('receiving-window-validation-msg');
    if (!msg) {
      msg = document.createElement('div');
      msg.id = 'receiving-window-validation-msg';
      msg.className = 'text-xs font-bold';
      msg.style.gridColumn = '1 / -1';
      panel.appendChild(msg);
    }

    msg.textContent = error;
    msg.classList.toggle('hidden', !error);
    msg.style.color = error ? 'var(--red)' : 'var(--green)';
    panel.dataset.valid = error ? 'false' : 'true';
    return !error;
  }

  function renderBatchGrid() {
    const header = document.querySelector('#batch-grid-wrapper .sticky');
    const container = document.getElementById('batch-rows-container');
    if (!container) return;

    const rows = batchRowsSafe();
    if (header) {
      header.style.gridTemplateColumns = GRID_TEMPLATE;
      header.dataset.owner = 'gate-input-page-controller';
      if (!header.querySelector('[data-sf-header="true"]')) {
        const loadHeader = Array.from(header.children).find(el => el.textContent.trim().toUpperCase() === 'LOAD');
        const sfHeader = document.createElement('div');
        sfHeader.dataset.sfHeader = 'true';
        sfHeader.className = 'text-[10px] uppercase font-bold tracking-wider text-muted';
        sfHeader.textContent = 'SPACE FORCE';
        if (loadHeader) header.insertBefore(sfHeader, loadHeader);
        else header.appendChild(sfHeader);
      }
    }

    container.dataset.owner = 'gate-input-page-controller';
    container.innerHTML = rows.map((row, index) => `
      <div class="grid gap-2 items-center" style="grid-template-columns:${GRID_TEMPLATE};" data-owner="gate-input-page-controller" data-input-row="${index}">
        <input class="batch-sdq border rounded px-1 py-1 bg-transparent text-xs" style="border-color:var(--border);color:var(--text);" data-row="${index}" value="${esc(row.sdq)}" aria-label="Row ${index + 1} SDQ">
        <input class="batch-sec border rounded px-1 py-1 bg-transparent text-xs" style="border-color:var(--border);color:var(--text);" data-row="${index}" value="${esc(row.sec)}" aria-label="Row ${index + 1} Section">
        <input class="batch-inter border rounded px-1 py-1 bg-transparent text-xs" style="border-color:var(--border);color:var(--text);" data-row="${index}" value="${esc(row.inter_sec)}" aria-label="Row ${index + 1} Inter Section">
        <input class="batch-dorm border rounded px-1 py-1 bg-transparent text-xs" style="border-color:var(--border);color:var(--text);" data-row="${index}" value="${esc(row.dorm_name)}" aria-label="Row ${index + 1} Dorm Name">
        <select class="batch-sex border rounded px-1 py-1 bg-transparent text-xs" style="border-color:var(--border);color:var(--text);" data-row="${index}" aria-label="Row ${index + 1} Sex">
          <option value="male" ${row.sex !== 'female' ? 'selected' : ''}>Male</option>
          <option value="female" ${row.sex === 'female' ? 'selected' : ''}>Female</option>
        </select>
        <label class="flex items-center justify-center" title="Band dorm"><input type="checkbox" class="batch-band w-4 h-4" data-row="${index}" ${row.band ? 'checked' : ''} aria-label="Row ${index + 1} Band"></label>
        <label class="flex items-center justify-center" title="Space Force dorm"><input type="checkbox" class="batch-space-force w-4 h-4" data-row="${index}" ${row.space_force ? 'checked' : ''} aria-label="Row ${index + 1} Space Force"></label>
        <input type="number" class="batch-load border rounded px-1 py-1 bg-transparent text-xs font-tabular" style="border-color:var(--border);color:var(--text);" inputmode="numeric" data-row="${index}" min="0" value="${esc(row.load)}" aria-label="Row ${index + 1} Load">
        <button type="button" data-gate-input-clear-row="${index}" class="text-red-500 text-lg leading-none" aria-label="Clear row ${index + 1}">×</button>
      </div>
    `).join('');

    configureHorizontalTabFlow();
    updateTotalLoad();
  }

  function syncBatchField(target) {
    if (!target?.dataset || typeof target.dataset.row === 'undefined') return;
    const index = Number(target.dataset.row);
    const rows = batchRowsSafe();
    if (!Number.isFinite(index) || !rows[index]) return;

    if (target.classList.contains('batch-sdq')) rows[index].sdq = target.value;
    if (target.classList.contains('batch-sec')) rows[index].sec = target.value;
    if (target.classList.contains('batch-inter')) rows[index].inter_sec = target.value;
    if (target.classList.contains('batch-dorm')) rows[index].dorm_name = target.value;
    if (target.classList.contains('batch-sex')) rows[index].sex = target.value || 'male';
    if (target.classList.contains('batch-load')) rows[index].load = target.value;

    if (target.classList.contains('batch-space-force')) {
      rows[index].space_force = Boolean(target.checked);
      if (target.checked) {
        rows[index].band = false;
        const bandInput = document.querySelector(`.batch-band[data-row="${index}"]`);
        if (bandInput) bandInput.checked = false;
      }
    }

    if (target.classList.contains('batch-band')) {
      rows[index].band = Boolean(target.checked);
      if (target.checked) {
        rows[index].space_force = false;
        const sfInput = document.querySelector(`.batch-space-force[data-row="${index}"]`);
        if (sfInput) sfInput.checked = false;
      }
    }
  }

  function syncAllBatchRowsFromDom() {
    document.querySelectorAll('#batch-rows-container [data-row]').forEach(input => syncBatchField(input));
  }

  function clearBatchRowCanonical(index) {
    const rowIndex = Number(index);
    if (!Number.isFinite(rowIndex)) return;
    setBatchRow(rowIndex, emptyRow(rowIndex));
    renderBatchGrid();
  }

  function updateTotalLoad() {
    const calc = document.getElementById('total-load-calc');
    if (!calc) return;
    calc.textContent = String(batchRowsSafe().reduce((sum, row) => sum + n(row.load), 0));
  }

  function configureHorizontalTabFlow() {
    const container = document.getElementById('batch-rows-container');
    if (!container) return;
    const fieldClasses = ['batch-sdq', 'batch-sec', 'batch-inter', 'batch-dorm', 'batch-sex', 'batch-band', 'batch-space-force', 'batch-load'];
    for (let row = 0; row < ROW_COUNT; row += 1) {
      fieldClasses.forEach((className, col) => {
        const field = container.querySelector(`.${className}[data-row="${row}"]`);
        if (field) field.tabIndex = (row * fieldClasses.length) + col + 1;
      });
    }
    container.querySelectorAll('[data-gate-input-clear-row]').forEach(button => { button.tabIndex = -1; });
  }

  function filledRows() {
    syncAllBatchRowsFromDom();
    return batchRowsSafe().filter(row => n(row.load) > 0);
  }

  function normalizedDormName(row) {
    return String(row.dorm_name || '').trim() || `Dorm ${Number(row.rowIndex || 0) + 1}`;
  }

  function normalizeDormIdentityPart(value) {
    return String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();
  }

  function dormIdentity(row) {
    const squadron = normalizeDormIdentityPart(row?.sdq);
    const dorm = normalizeDormIdentityPart(normalizedDormName(row || {}));
    return Object.freeze({
      squadron,
      dorm,
      key: `${squadron}::${dorm}`
    });
  }

  function findDuplicateDormIdentity(rows = []) {
    const seen = new Set();
    for (const row of Array.isArray(rows) ? rows : []) {
      const identity = dormIdentity(row);
      if (seen.has(identity.key)) return identity;
      seen.add(identity.key);
    }
    return null;
  }

  function preflightInitialization() {
    const weekGroup = getWeekGroupInputValue();
    if (!weekGroup) return { ok: false, message: 'Week Group ID required.' };

    const windowError = validateReceivingWindows();
    if (windowError) return { ok: false, message: windowError };

    const rows = filledRows();
    if (rows.length === 0) return { ok: false, message: 'At least one row with Load required.' };

    const conflict = rows.find(row => row.band && row.space_force);
    if (conflict) return { ok: false, message: 'A dorm cannot be both Band and Space Force. Clear one selection before initializing.' };

    const invalidLoad = rows.find(row => n(row.load) <= 0 || n(row.load) > 60);
    if (invalidLoad) return { ok: false, message: 'Dorm loads must be between 1 and 60.' };

    const duplicate = findDuplicateDormIdentity(rows);
    if (duplicate) {
      const squadronLabel = duplicate.squadron || 'UNSPECIFIED SQUADRON';
      return { ok: false, message: `Duplicate Squadron/Dorm combination detected: ${squadronLabel} + ${duplicate.dorm}.` };
    }

    const existingDorms = allDataSafe().filter(record => record.type === 'dorm' && record.week_group === weekGroup);
    if (existingDorms.length) return { ok: false, message: `${weekGroup} already has live dorm records. Close out/archive before initializing it again.` };

    if (allDataSafe().length + rows.length + 1 >= 999) return { ok: false, message: 'Record limit reached.' };
    return { ok: true, message: '' };
  }

  function syncLocalRecord(record) {
    if (!record || !record.__backendId) return;
    const list = allDataSafe();
    const index = list.findIndex(item => item.__backendId === record.__backendId);
    if (index >= 0) list[index] = { ...list[index], ...record };
    else list.push(record);
  }

  function buildDormPayload(row, weekGroup, windows) {
    const spaceForce = Boolean(row.space_force);
    const displayOrder = Number(row.rowIndex) + 1;
    const now = new Date().toISOString();
    const identitySource = {
      week_group: weekGroup,
      sdq: String(row.sdq || '').trim(),
      dorm_name: normalizedDormName(row)
    };
    const identity = recordDisplay()?.dormIdentityKey
      ? recordDisplay().dormIdentityKey(identitySource)
      : `${normalizeDormIdentityPart(weekGroup)}::${normalizeDormIdentityPart(row.sdq)}::${normalizeDormIdentityPart(normalizedDormName(row))}`;

    return Object.assign({}, windows, {
      type: 'dorm',
      dorm_name: normalizedDormName(row),
      section: String(row.sec || '').trim(),
      sdq: String(row.sdq || '').trim(),
      inter_sec: String(row.inter_sec || '').trim(),
      max_load: n(row.load),
      current_load: 0,
      sex: row.sex === 'female' ? 'female' : 'male',
      band: row.band && !spaceForce ? 'true' : 'false',
      space_force: spaceForce ? 'true' : 'false',
      is_space_force: spaceForce ? 'true' : 'false',
      display_order: displayOrder,
      input_order: displayOrder,
      source_row_index: Number(row.rowIndex),
      dorm_identity: identity,
      state: 'empty',
      phase: '',
      opened_at: '',
      closed_timer: '',
      closed_at: '',
      notes: '',
      assigned_airman: '',
      auditorium_location: '',
      overtime_sound_sent: 'false',
      overtime_sound_at: '',
      week_group: weekGroup,
      created_at: now,
      destination: '',
      bus_type: ''
    });
  }

  async function initializeWeekGroupCanonical(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    event?.stopImmediatePropagation?.();

    ensureInputPageShell();
    syncAllBatchRowsFromDom();
    saveWindowInputs();

    const preflight = preflightInitialization();
    if (!preflight.ok) {
      showInputMessage(preflight.message, true);
      return;
    }

    const weekGroup = getWeekGroupInputValue();
    const rows = filledRows();
    const windows = readWindowInputs(weekGroup);
    const btn = document.getElementById('init-wg-btn');
    const originalText = btn?.textContent || 'INITIALIZE WEEK GROUP';

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Initializing...';
    }

    let ok = 0;
    try {
      const existingConfig = allDataSafe().find(record => record.type === 'config' && record.key === 'week_group');
      const configPayload = existingConfig
        ? { ...existingConfig, value: weekGroup, updated_at: new Date().toISOString() }
        : { type: 'config', key: 'week_group', value: weekGroup, created_at: new Date().toISOString() };
      const configResult = existingConfig ? await window.dataSdk.update(configPayload) : await window.dataSdk.create(configPayload);
      if (configResult?.isOk) syncLocalRecord(configResult.data || configPayload);
      else throw new Error(configResult?.error || 'Failed to set active Week Group.');

      for (const row of rows) {
        const payload = buildDormPayload(row, weekGroup, windows);
        const result = await window.dataSdk.create(payload);
        if (result?.isOk) {
          ok += 1;
          syncLocalRecord(result.data || payload);
        }
      }

      if (ok === rows.length) {
        document.getElementById('init-success-overlay')?.classList.remove('hidden');
        showInputMessage(`${weekGroup} initialized with ${ok} dorms.`, false);
      } else {
        showInputMessage(`${ok}/${rows.length} dorms created. Check records before retrying.`, true);
      }

      try { window.GateStatusBoardController?.scheduleRender?.({ force: true }); } catch (_) {}
      try { window.GateProcessingController?.scheduleRender?.({ force: true }); } catch (_) {}
      try { window.runGateHooks?.('afterDataChanged', { source: 'gate-input-initialize-week-group' }); } catch (_) {}
    } catch (error) {
      showInputMessage(error?.message || 'Failed to initialize Week Group.', true);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    }
  }

  function returnToBoardCanonical(event) {
    event?.preventDefault?.();
    document.getElementById('init-success-overlay')?.classList.add('hidden');
    if (window.GateAppShell?.go) window.GateAppShell.go('board');
    else if (typeof showPage === 'function') showPage('board');
  }

  function isSpaceForceDorm(dorm) {
    const flags = recordDisplay()?.normalizeDormFlags?.(dorm);
    return flags ? flags.spaceForce : Boolean(dorm && (dorm.space_force === true || dorm.space_force === 'true' || dorm.is_space_force === true || dorm.is_space_force === 'true'));
  }

  function isBandDorm(dorm) {
    const flags = recordDisplay()?.normalizeDormFlags?.(dorm);
    return flags ? flags.band : Boolean(dorm && (dorm.band === true || dorm.band === 'true'));
  }

  function matchingDormIdentity(left, right, weekGroup = '') {
    const display = recordDisplay();
    if (display?.dormIdentityKey) {
      const leftRecord = { ...left, week_group: left?.week_group || weekGroup };
      const rightRecord = { ...right, week_group: right?.week_group || weekGroup };
      return display.dormIdentityKey(leftRecord) === display.dormIdentityKey(rightRecord);
    }
    return normalizeDormIdentityPart(left?.week_group || weekGroup) === normalizeDormIdentityPart(right?.week_group || weekGroup)
      && normalizeDormIdentityPart(left?.sdq) === normalizeDormIdentityPart(right?.sdq)
      && normalizeDormIdentityPart(left?.dorm_name || left?.name) === normalizeDormIdentityPart(right?.dorm_name || right?.name);
  }

  function patchDataSdk() {
    if (dataSdkPatched || !window.dataSdk || typeof window.dataSdk.create !== 'function') return;
    const originalCreate = window.dataSdk.create.bind(window.dataSdk);
    const originalUpdate = typeof window.dataSdk.update === 'function' ? window.dataSdk.update.bind(window.dataSdk) : null;

    window.dataSdk.create = function gateInputCreate(payload) {
      if (payload && payload.type === 'dorm') {
        const windows = readWindowInputs(payload.week_group || '');
        const normalizedFlags = recordDisplay()?.normalizeDormFlags?.(payload);
        const spaceForce = normalizedFlags ? normalizedFlags.spaceForce : isSpaceForceDorm(payload);
        const band = normalizedFlags ? normalizedFlags.band : (!spaceForce && isBandDorm(payload));
        const identity = payload.dorm_identity || (recordDisplay()?.dormIdentityKey ? recordDisplay().dormIdentityKey(payload) : '');
        payload = Object.assign({}, payload, windows, {
          band: band ? 'true' : 'false',
          space_force: spaceForce ? 'true' : 'false',
          is_space_force: spaceForce ? 'true' : 'false',
          dorm_identity: identity
        });
      }

      if (payload && payload.type === 'archive') {
        const windows = readWindowInputs(payload.week_group || '');
        let dormData = payload.dorm_data;
        try {
          const dorms = JSON.parse(payload.dorm_data || '[]');
          const liveDorms = allDataSafe().filter(record => record.type === 'dorm' && record.week_group === payload.week_group);
          dormData = JSON.stringify(dorms.map(dorm => {
            const live = liveDorms.find(item => matchingDormIdentity(item, dorm, payload.week_group)) || {};
            const liveFlags = recordDisplay()?.normalizeDormFlags?.(live);
            const archivedSpaceForce = isSpaceForceDorm(dorm);
            const archivedBand = isBandDorm(dorm);
            const spaceForce = liveFlags ? liveFlags.spaceForce : (Object.keys(live).length ? isSpaceForceDorm(live) : archivedSpaceForce);
            const band = liveFlags ? liveFlags.band : (Object.keys(live).length ? isBandDorm(live) : archivedBand);
            return Object.assign({}, dorm, windows, {
              display_order: live.display_order ?? dorm.display_order,
              input_order: live.input_order ?? dorm.input_order,
              source_row_index: live.source_row_index ?? dorm.source_row_index,
              dorm_identity: live.dorm_identity || dorm.dorm_identity || (recordDisplay()?.dormIdentityKey ? recordDisplay().dormIdentityKey({ ...dorm, week_group: payload.week_group }) : ''),
              band: band ? 'true' : 'false',
              space_force: spaceForce ? 'true' : 'false',
              is_space_force: spaceForce ? 'true' : 'false'
            });
          }));
        } catch (_) {}
        payload = Object.assign({}, payload, windows, { dorm_data: dormData });
      }

      return originalCreate(payload);
    };

    if (originalUpdate) {
      window.dataSdk.update = function gateInputUpdate(payload) {
        if (payload && payload.type === 'archive') {
          const modalValues = {};
          WINDOW_FIELDS.forEach(([key]) => {
            const input = document.getElementById(`archive-edit-${key}`);
            if (input) modalValues[key] = input.value || payload[key] || '';
          });
          payload = Object.assign({}, payload, modalValues);
        }
        return originalUpdate(payload);
      };
    }

    dataSdkPatched = true;
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
      panel.dataset.owner = 'gate-input-page-controller';
      panel.setAttribute('aria-label', 'Archived receiving windows');
      panel.innerHTML = WINDOW_FIELDS.map(([key, label]) => `
        <div>
          <label for="archive-edit-${key}" class="block text-sm font-medium mb-1">${esc(label)}</label>
          <input id="archive-edit-${key}" type="datetime-local" class="w-full border rounded px-3 py-2 bg-transparent font-tabular" style="border-color:var(--border);color:var(--text);">
        </div>
      `).join('');
      anchor.insertAdjacentElement('beforebegin', panel);
    }
    WINDOW_FIELDS.forEach(([key]) => {
      const input = document.getElementById(`archive-edit-${key}`);
      if (input) input.dataset.owner = 'gate-input-page-controller';
    });
  }

  function getEditArchiveIdSafe() {
    try { return editArchiveId || ''; } catch (_) { return window.editArchiveId || ''; }
  }

  function getOpenArchive() {
    const id = getEditArchiveIdSafe();
    if (!id) return null;
    return allDataSafe().find(record => record && record.type === 'archive' && record.__backendId === id) || null;
  }

  function fillArchiveWindowPanel(archive = getOpenArchive()) {
    if (!archive) return;
    ensureArchiveWindowPanel();
    WINDOW_FIELDS.forEach(([key]) => {
      const input = document.getElementById(`archive-edit-${key}`);
      if (input && !input.matches(':focus')) input.value = archive[key] || input.value || '';
    });
  }

  function collectReceivingWindowsForReport({ weekGroup = '', archive = {}, dorms = [] } = {}) {
    const stored = parseStorage(weekGroup);
    const firstDormWithWindows = (Array.isArray(dorms) ? dorms : []).find(dorm => WINDOW_FIELDS.some(([key]) => dorm && dorm[key])) || {};
    const values = {};
    WINDOW_FIELDS.forEach(([key]) => {
      values[key] =
        document.getElementById(`archive-edit-${key}`)?.value ||
        document.getElementById(key)?.value ||
        archive[key] ||
        firstDormWithWindows[key] ||
        stored[key] ||
        '';
    });
    return values;
  }

  function patchArchiveOpen() {
    if (archiveOpenPatched || typeof openArchiveEditModal !== 'function') return;
    const originalOpen = openArchiveEditModal;
    const patchedOpen = function gateInputOpenArchiveEditModal(event, id) {
      const result = originalOpen.apply(this, arguments);
      ensureArchiveWindowPanel();
      const archive = allDataSafe().find(record => record && record.type === 'archive' && record.__backendId === id);
      fillArchiveWindowPanel(archive);
      schedulePass();
      return result;
    };
    patchedOpen.__gateInputController = true;
    window.openArchiveEditModal = patchedOpen;
    try { openArchiveEditModal = patchedOpen; } catch (_) {}
    archiveOpenPatched = true;
  }

  function patchGlobals() {
    window.initBatchGrid = renderBatchGrid;
    window.clearBatchRow = clearBatchRowCanonical;
    window.handleBatchInput = function gateInputHandleBatchInput(event) {
      syncBatchField(event?.target);
      updateTotalLoad();
    };
    window.updateTotalLoadCalc = updateTotalLoad;
    window.initializeWeekGroup = initializeWeekGroupCanonical;
    window.returnToBoard = returnToBoardCanonical;
    window.showBatchMsg = showInputMessage;
    window.collectReceivingWindowsForReport = collectReceivingWindowsForReport;

    try { initBatchGrid = renderBatchGrid; } catch (_) {}
    try { clearBatchRow = clearBatchRowCanonical; } catch (_) {}
    try { handleBatchInput = window.handleBatchInput; } catch (_) {}
    try { updateTotalLoadCalc = updateTotalLoad; } catch (_) {}
    try { initializeWeekGroup = initializeWeekGroupCanonical; } catch (_) {}
    try { returnToBoard = returnToBoardCanonical; } catch (_) {}
    try { showBatchMsg = showInputMessage; } catch (_) {}
  }

  function handleInputChange(event) {
    const target = event.target;
    if (!target?.closest?.('#batch-rows-container')) return;
    syncBatchField(target);
    updateTotalLoad();
  }

  function handleClick(event) {
    const clearButton = event.target?.closest?.('[data-gate-input-clear-row]');
    if (clearButton) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      clearBatchRowCanonical(clearButton.dataset.gateInputClearRow);
      return;
    }

    const initButton = event.target?.closest?.('#init-wg-btn, [data-gate-input-action="initialize-week-group"]');
    if (initButton) {
      initializeWeekGroupCanonical(event);
      return;
    }
  }

  function runPass() {
    passQueued = false;
    ensureInputPageShell();
    ensureReceivingWindowPanel();
    ensureArchiveWindowPanel();
    fillArchiveWindowPanel();
    patchDataSdk();
    patchArchiveOpen();
    patchGlobals();
    renderBatchGrid();
    validateAndMarkWindows();

    window.GateInputPageController = Object.freeze({
      isCanonicalOwner: true,
      renderBatchGrid,
      clearBatchRow: clearBatchRowCanonical,
      initializeWeekGroup: initializeWeekGroupCanonical,
      returnToBoard: returnToBoardCanonical,
      refresh: schedulePass,
      collectReceivingWindows: collectReceivingWindowsForReport,
      validateReceivingWindows,
      preflightInitialization,
      findDuplicateDormIdentity,
      buildDormPayload,
      getRows: batchRowsSafe
    });
  }

  function schedulePass() {
    if (passQueued) return;
    passQueued = true;
    window.requestAnimationFrame(runPass);
  }

  function registerHooksOnce() {
    if (hooksRegistered || typeof window.registerGateHook !== 'function') return;
    window.registerGateHook('afterRenderAll', schedulePass);
    window.registerGateHook('afterPageChange', schedulePass);
    window.registerGateHook('afterDataChanged', schedulePass);
    window.registerGateHook('afterModalOpen', schedulePass);
    window.registerGateHook('afterCloseout', schedulePass);
    hooksRegistered = true;
  }

  function start() {
    if (!installed) {
      document.addEventListener('input', handleInputChange, true);
      document.addEventListener('change', handleInputChange, true);
      document.addEventListener('click', handleClick, true);
      installed = true;
    }
    runPass();
    registerHooksOnce();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  window.addEventListener('load', start, { once: true });
})();