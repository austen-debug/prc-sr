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

  function parseTimerToSeconds(value) {
    const raw = String(value || '').trim();
    const match = raw.match(/^(\d{1,5})(?::([0-5]\d))?$/);
    if (!match) return 0;

    const minutes = Number(match[1] || 0);
    const seconds = Number(match[2] || 0);
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return 0;

    return Math.max(0, (minutes * 60) + seconds);
  }

  function getEditDorm() {
    if (typeof editDormId === 'undefined' || !editDormId || typeof allData === 'undefined') return null;
    return allData.find(record => record.__backendId === editDormId && record.type === 'dorm') || null;
  }

  function ensureEditActionStyles() {
    if (document.getElementById('prc-dorm-edit-action-styles')) return;

    const style = document.createElement('style');
    style.id = 'prc-dorm-edit-action-styles';
    style.textContent = `
      #dorm-edit-form .prc-dorm-edit-actions {
        display: flex !important;
        flex-wrap: wrap !important;
        gap: 0.5rem !important;
        justify-content: flex-end !important;
        align-items: center !important;
      }

      #dorm-edit-form .prc-dorm-edit-actions > button {
        min-width: 86px !important;
        min-height: 34px !important;
        padding: 0.48rem 0.72rem !important;
        border-radius: 0.62rem !important;
        font-size: 0.72rem !important;
        font-weight: 900 !important;
        letter-spacing: 0.065em !important;
        line-height: 1 !important;
        text-align: center !important;
      }

      #reopen-dorm-btn {
        background: linear-gradient(135deg, rgba(37, 99, 235, 0.92), rgba(56, 189, 248, 0.82)) !important;
        color: #fff !important;
        border: 1px solid rgba(125, 211, 252, 0.46) !important;
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,0.18),
          0 8px 18px rgba(2, 132, 199, 0.16) !important;
      }
    `;

    document.head.appendChild(style);
  }

  function normalizeEditFooter() {
    ensureEditActionStyles();

    const form = document.getElementById('dorm-edit-form');
    if (!form) return;

    const saveButton = form.querySelector('button[type="submit"]');
    if (!saveButton) return;

    const footer = saveButton.closest('.flex');
    if (!footer) return;

    footer.classList.add('prc-dorm-edit-actions');

    const dorm = getEditDorm();
    const isClosed = String(dorm?.state || '').toLowerCase() === 'closed';
    let reopenButton = document.getElementById('reopen-dorm-btn');

    if (!isClosed) {
      if (reopenButton) reopenButton.remove();
      return;
    }

    if (!reopenButton) {
      reopenButton = document.createElement('button');
      reopenButton.id = 'reopen-dorm-btn';
      reopenButton.type = 'button';
      reopenButton.textContent = 'REOPEN';
      reopenButton.addEventListener('click', reopenDormFromEditModal);

      const deleteButton = footer.querySelector('button[onclick*="deleteDormitoryFromEditModal"]');
      if (deleteButton) footer.insertBefore(reopenButton, deleteButton);
      else footer.insertBefore(reopenButton, saveButton);
    }
  }

  async function reopenDormFromEditModal() {
    if (typeof currentRole !== 'undefined' && currentRole !== 'instructor') return;

    const dorm = getEditDorm();
    if (!dorm) return;

    if (String(dorm.state || '').toLowerCase() !== 'closed') {
      showEditMessage('Only closed dorms can be reopened.', true);
      return;
    }

    const finalTime = getValue('edit-closed-timer', dorm.closed_timer || '00:00') || dorm.closed_timer || '00:00';
    const elapsedSeconds = parseTimerToSeconds(finalTime);
    const reopenedOpenedAt = new Date(Date.now() - (elapsedSeconds * 1000)).toISOString();

    const result = await window.dataSdk.update({
      ...dorm,
      state: 'open',
      phase: 'OPEN',
      opened_at: reopenedOpenedAt,
      closed_at: '',
      closed_timer: '',
      manual_reopen_override: 'true',
      updated_at: new Date().toISOString()
    });

    if (result && result.isOk) {
      const index = allData.findIndex(record => record.__backendId === dorm.__backendId);
      if (index >= 0) {
        allData[index] = {
          ...allData[index],
          ...(result.data || {}),
          state: 'open',
          phase: 'OPEN',
          opened_at: reopenedOpenedAt,
          closed_at: '',
          closed_timer: '',
          manual_reopen_override: undefined
        };
      }

      if (typeof createSoundEvent === 'function') {
        await createSoundEvent('dorm_open', {
          dorm_id: dorm.__backendId,
          dorm_name: dorm.dorm_name || '',
          action: 'reopen_dorm'
        });
      }

      if (typeof renderAll === 'function') renderAll();
      if (typeof closeDormEditModal === 'function') closeDormEditModal();
    } else {
      showEditMessage(result?.error || 'Failed to reopen dorm.', true);
    }
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
    normalizeEditFooter();
    window.reopenDormFromEditModal = reopenDormFromEditModal;
    setInterval(() => {
      patchDormEditForm();
      normalizeEditFooter();
    }, 750);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startPatch);
  } else {
    startPatch();
  }
})();
