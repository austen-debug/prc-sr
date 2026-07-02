// PRC GATE archived receiving window field population
(function () {
  const WINDOW_FIELDS = [
    ['receiving_day_one_start', 'RECEIVING DAY ONE START DATE / TIME'],
    ['receiving_day_one_end', 'RECEIVING DAY ONE END DATE / TIME'],
    ['receiving_day_two_start', 'RECEIVING DAY TWO START DATE / TIME'],
    ['receiving_day_two_end', 'RECEIVING DAY TWO END DATE / TIME']
  ];

  let started = false;
  let passScheduled = false;

  function getAllDataSafe() {
    try { return Array.isArray(allData) ? allData : []; } catch (_) { return []; }
  }

  function getEditArchiveIdSafe() {
    try { return editArchiveId || ''; } catch (_) { return window.editArchiveId || ''; }
  }

  function ensureArchiveWindowInputs() {
    const form = document.getElementById('archive-edit-form');
    const anchor = document.getElementById('archive-edit-dorm-count')?.closest('.grid');
    if (!form || !anchor || document.getElementById('archive-receiving-windows-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'archive-receiving-windows-panel';
    panel.className = 'grid grid-cols-2 gap-3';
    panel.innerHTML = WINDOW_FIELDS.map(([key, label]) => `
      <div>
        <label for="archive-edit-${key}" class="block text-sm font-medium mb-1">${label}</label>
        <input id="archive-edit-${key}" type="datetime-local" class="w-full border rounded px-3 py-2 bg-transparent font-tabular" style="border-color:var(--border);color:var(--text);">
      </div>
    `).join('');

    anchor.insertAdjacentElement('beforebegin', panel);
  }

  function fillArchiveWindowInputs(archive) {
    if (!archive) return;

    WINDOW_FIELDS.forEach(([key]) => {
      const input = document.getElementById(`archive-edit-${key}`);
      if (input && !input.matches(':focus')) input.value = archive[key] || input.value || '';
    });
  }

  function getOpenArchive() {
    const id = getEditArchiveIdSafe();
    if (!id) return null;
    return getAllDataSafe().find(record => record && record.type === 'archive' && record.__backendId === id) || null;
  }

  function syncOpenModal() {
    const modal = document.getElementById('archive-edit-modal');
    if (!modal || modal.classList.contains('hidden')) return;
    ensureArchiveWindowInputs();
    fillArchiveWindowInputs(getOpenArchive());
  }

  function patchArchiveOpen() {
    if (typeof openArchiveEditModal !== 'function' || openArchiveEditModal.__receivingWindowFieldsPatched) return;

    const originalOpen = openArchiveEditModal;
    const patchedOpen = function patchedOpenArchiveEditModal(event, id) {
      const result = originalOpen.apply(this, arguments);
      ensureArchiveWindowInputs();
      const archive = getAllDataSafe().find(record => record && record.type === 'archive' && record.__backendId === id);
      fillArchiveWindowInputs(archive);
      schedulePass();
      return result;
    };

    patchedOpen.__receivingWindowFieldsPatched = true;
    window.openArchiveEditModal = patchedOpen;
    try { openArchiveEditModal = patchedOpen; } catch (_) {}
  }

  function runPass() {
    passScheduled = false;
    ensureArchiveWindowInputs();
    patchArchiveOpen();
    syncOpenModal();
  }

  function schedulePass() {
    if (passScheduled) return;
    passScheduled = true;
    requestAnimationFrame(runPass);
  }

  function observeArchiveModal() {
    if (typeof MutationObserver === 'undefined' || !document.body) return;
    const observer = new MutationObserver(mutations => {
      const shouldSchedule = mutations.some(mutation => {
        if (mutation.type === 'childList') return true;
        if (mutation.type === 'attributes') {
          const target = mutation.target;
          if (!target?.closest) return false;
          return Boolean(target.closest('#archive-edit-modal, #archive-history'));
        }
        return false;
      });
      if (shouldSchedule) schedulePass();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }

  function start() {
    if (started) return;
    started = true;
    document.addEventListener('click', schedulePass, true);
    document.addEventListener('change', event => {
      if (event.target?.closest?.('#archive-edit-modal')) schedulePass();
    }, true);
    observeArchiveModal();
    schedulePass();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
