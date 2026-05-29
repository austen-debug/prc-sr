// PRC DASH instructor closed-dorm reopen fail-safe
// Adds a controlled REOPEN option to the instructor right-click dorm edit modal.
(function () {
  let observerReady = false;
  let reopenStyleReady = false;

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

  function updateLocalDorm(id, record) {
    if (typeof allData === 'undefined') return;
    const index = allData.findIndex(item => item.__backendId === id);
    if (index >= 0) allData[index] = { ...allData[index], ...record };
  }

  function showEditMessage(message, isError = false) {
    const msg = document.getElementById('dorm-edit-msg');
    if (!msg) return;
    msg.textContent = message;
    msg.style.color = isError ? 'var(--red)' : 'var(--green)';
    msg.classList.remove('hidden');
  }

  function ensureReopenStyles() {
    if (reopenStyleReady || document.getElementById('prc-dorm-reopen-styles')) return;

    const style = document.createElement('style');
    style.id = 'prc-dorm-reopen-styles';
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

      #reopen-dorm-btn:hover {
        border-color: rgba(186, 230, 253, 0.78) !important;
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,0.22),
          0 10px 22px rgba(2, 132, 199, 0.22) !important;
      }
    `;

    document.head.appendChild(style);
    reopenStyleReady = true;
  }

  function normalizeEditFooter() {
    ensureReopenStyles();

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

    const finalTimeInput = document.getElementById('edit-closed-timer');
    const finalTime = finalTimeInput?.value || dorm.closed_timer || '00:00';
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
      updateLocalDorm(dorm.__backendId, result.data || {
        ...dorm,
        state: 'open',
        phase: 'OPEN',
        opened_at: reopenedOpenedAt,
        closed_at: '',
        closed_timer: ''
      });

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

  function startReopenPatch() {
    normalizeEditFooter();

    if (!observerReady) {
      const modal = document.getElementById('dorm-edit-modal');
      if (modal) {
        new MutationObserver(normalizeEditFooter).observe(modal, {
          attributes: true,
          childList: true,
          subtree: true,
          attributeFilter: ['class']
        });
        observerReady = true;
      }
    }

    setInterval(normalizeEditFooter, 750);
  }

  window.reopenDormFromEditModal = reopenDormFromEditModal;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startReopenPatch);
  } else {
    startReopenPatch();
  }
})();
