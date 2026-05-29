// PRC DASH closed dorm final time edit patch
// Keeps stale-state protection intact while allowing instructor right-click final time corrections.
(function () {
  let dormEditFormPatched = false;

  function normalizeFinalTime(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';

    const match = raw.match(/^(\d{1,4})(?::([0-5]\d))?$/);
    if (!match) return raw;

    const minutes = String(Number(match[1])).padStart(2, '0');
    const seconds = match[2] || '00';
    return `${minutes}:${seconds}`;
  }

  function showEditMessage(message, isError = false) {
    const msg = document.getElementById('dorm-edit-msg');
    if (!msg) return;

    msg.textContent = message;
    msg.style.color = isError ? 'var(--red)' : 'var(--green)';
    msg.classList.remove('hidden');
  }

  function getValue(id, fallback = '') {
    const el = document.getElementById(id);
    return el ? el.value : fallback;
  }

  function patchDormEditForm() {
    const form = document.getElementById('dorm-edit-form');
    if (!form || dormEditFormPatched) return;

    form.addEventListener('submit', async event => {
      event.preventDefault();
      event.stopImmediatePropagation();

      if (typeof currentRole !== 'undefined' && currentRole !== 'instructor') return;
      if (typeof editDormId === 'undefined' || !editDormId || typeof allData === 'undefined') return;

      const dorm = allData.find(record => record.__backendId === editDormId && record.type === 'dorm');
      if (!dorm) return;

      const maxLoad = Math.max(0, Number(getValue('edit-max-load', 0) || 0));
      const currentLoadRaw = Math.max(0, Number(getValue('edit-current-load', 0) || 0));
      const currentLoad = Math.min(currentLoadRaw, maxLoad);
      const finalTime = normalizeFinalTime(getValue('edit-closed-timer', dorm.closed_timer || ''));
      const isClosed = String(dorm.state || '').toLowerCase() === 'closed';

      if (isClosed && finalTime && !/^\d{1,4}:\d{2}$/.test(finalTime)) {
        showEditMessage('Final Time must use MM:SS format, such as 60:00.', true);
        return;
      }

      const payload = {
        ...dorm,
        dorm_name: getValue('edit-dorm-name', dorm.dorm_name || '').trim() || dorm.dorm_name,
        sdq: getValue('edit-sdq').trim(),
        section: getValue('edit-section').trim(),
        inter_sec: getValue('edit-inter-sec').trim(),
        sex: getValue('edit-sex', dorm.sex || 'male'),
        band: document.getElementById('edit-band')?.checked ? 'true' : 'false',
        max_load: maxLoad,
        current_load: currentLoad,
        notes: getValue('edit-notes').trim(),
        phase: isClosed ? 'Closed' : dorm.phase,
        closed_timer: isClosed ? (finalTime || dorm.closed_timer || '00:00') : dorm.closed_timer,
        manual_closed_timer_override: isClosed ? 'true' : undefined,
        updated_at: new Date().toISOString()
      };

      const result = await window.dataSdk.update(payload);

      if (result && result.isOk) {
        // Optimistically update local memory so the Processing page and Status Board reflect it immediately.
        const index = allData.findIndex(record => record.__backendId === editDormId);
        if (index >= 0) {
          allData[index] = {
            ...allData[index],
            ...(result.data || payload),
            manual_closed_timer_override: undefined
          };
        }

        if (typeof renderAll === 'function') renderAll();
        if (typeof closeDormEditModal === 'function') closeDormEditModal();
      } else {
        showEditMessage(result?.error || 'Failed to save changes.', true);
      }
    }, true);

    const finalTimeInput = document.getElementById('edit-closed-timer');
    if (finalTimeInput && finalTimeInput.dataset.prcFinalTimePatched !== 'true') {
      finalTimeInput.dataset.prcFinalTimePatched = 'true';
      finalTimeInput.addEventListener('blur', () => {
        finalTimeInput.value = normalizeFinalTime(finalTimeInput.value);
      });
      finalTimeInput.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
          event.preventDefault();
          form.requestSubmit();
        }
      });
    }

    dormEditFormPatched = true;
  }

  function startPatch() {
    patchDormEditForm();
    setInterval(patchDormEditForm, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startPatch);
  } else {
    startPatch();
  }
})();
