// PRC DASH instructor closed-dorm reopen fail-safe
// Safe runtime patch. Does not touch navigation or page routing.
(function () {
  var patchStarted = false;

  function isInstructor() {
    try {
      return typeof currentRole === 'undefined' || currentRole === 'instructor';
    } catch (error) {
      return false;
    }
  }

  function parseTimerToSeconds(value) {
    var raw = String(value || '').trim();
    var match = raw.match(/^(\d{1,5})(?::([0-5]\d))?$/);
    if (!match) return 0;

    var minutes = Number(match[1] || 0);
    var seconds = Number(match[2] || 0);
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return 0;

    return Math.max(0, (minutes * 60) + seconds);
  }

  function getEditDormId() {
    try {
      return typeof editDormId === 'undefined' ? null : editDormId;
    } catch (error) {
      return null;
    }
  }

  function getEditDorm() {
    var id = getEditDormId();
    if (!id) return null;

    try {
      if (typeof allData === 'undefined' || !Array.isArray(allData)) return null;
      return allData.find(function (record) {
        return record && record.__backendId === id && record.type === 'dorm';
      }) || null;
    } catch (error) {
      return null;
    }
  }

  function showEditMessage(message, isError) {
    var msg = document.getElementById('dorm-edit-msg');
    if (!msg) return;

    msg.textContent = message;
    msg.style.color = isError ? 'var(--red)' : 'var(--green)';
    msg.classList.remove('hidden');
  }

  function getFinalTimeValue(dorm) {
    var input = document.getElementById('edit-closed-timer');
    return (input && input.value) || (dorm && dorm.closed_timer) || '00:00';
  }

  function ensureStyles() {
    if (document.getElementById('prc-dorm-reopen-styles')) return;

    var style = document.createElement('style');
    style.id = 'prc-dorm-reopen-styles';
    style.textContent = '' +
      '#dorm-edit-form .prc-dorm-edit-actions{display:flex!important;flex-wrap:wrap!important;gap:.5rem!important;justify-content:flex-end!important;align-items:center!important;}' +
      '#dorm-edit-form .prc-dorm-edit-actions>button{box-sizing:border-box!important;min-width:88px!important;width:88px!important;min-height:36px!important;padding:.5rem .65rem!important;border-radius:.65rem!important;font-size:.72rem!important;font-weight:900!important;letter-spacing:.065em!important;line-height:1!important;text-align:center!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;}' +
      '#reopen-dorm-btn{background:linear-gradient(135deg,rgba(37,99,235,.94),rgba(56,189,248,.84))!important;color:#fff!important;border:1px solid rgba(125,211,252,.52)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 8px 18px rgba(2,132,199,.16)!important;}' +
      '#reopen-dorm-btn:hover{border-color:rgba(186,230,253,.82)!important;}' +
      '#reopen-dorm-btn.hidden{display:none!important;}';

    document.head.appendChild(style);
  }

  function findFooter(form, saveButton) {
    var node = saveButton ? saveButton.parentElement : null;
    while (node && node !== form) {
      if (node.classList && node.classList.contains('flex')) return node;
      node = node.parentElement;
    }
    return saveButton ? saveButton.parentElement : null;
  }

  function ensureReopenButton() {
    try {
      ensureStyles();

      var form = document.getElementById('dorm-edit-form');
      if (!form) return;

      var saveButton = form.querySelector('button[type="submit"]');
      if (!saveButton) return;

      var footer = findFooter(form, saveButton);
      if (!footer) return;

      footer.classList.add('prc-dorm-edit-actions');

      var cancelButton = footer.querySelector('button[onclick*="closeDormEditModal"]');
      var deleteButton = footer.querySelector('button[onclick*="deleteDormitoryFromEditModal"]');
      var buttons = [cancelButton, deleteButton, saveButton];
      buttons.forEach(function (button) {
        if (button) {
          button.style.minWidth = '88px';
          button.style.width = '88px';
          button.style.minHeight = '36px';
        }
      });

      var reopenButton = document.getElementById('reopen-dorm-btn');
      if (!reopenButton) {
        reopenButton = document.createElement('button');
        reopenButton.id = 'reopen-dorm-btn';
        reopenButton.type = 'button';
        reopenButton.textContent = 'REOPEN';
        reopenButton.addEventListener('click', function (event) {
          event.preventDefault();
          event.stopPropagation();
          reopenDormFromEditModal();
        });

        if (deleteButton) footer.insertBefore(reopenButton, deleteButton);
        else footer.insertBefore(reopenButton, saveButton);
      }

      var dorm = getEditDorm();
      var isClosed = dorm && String(dorm.state || '').toLowerCase() === 'closed';
      reopenButton.classList.toggle('hidden', !isClosed);
      reopenButton.disabled = !isClosed;
    } catch (error) {
      console.warn('PRC DASH reopen button patch failed:', error);
    }
  }

  async function reopenDormFromEditModal() {
    try {
      if (!isInstructor()) return;

      var dorm = getEditDorm();
      if (!dorm) return;

      if (String(dorm.state || '').toLowerCase() !== 'closed') {
        showEditMessage('Only closed dorms can be reopened.', true);
        return;
      }

      var elapsedSeconds = parseTimerToSeconds(getFinalTimeValue(dorm));
      var reopenedOpenedAt = new Date(Date.now() - (elapsedSeconds * 1000)).toISOString();

      var result = await window.dataSdk.update(Object.assign({}, dorm, {
        state: 'open',
        phase: 'OPEN',
        opened_at: reopenedOpenedAt,
        closed_at: '',
        closed_timer: '',
        manual_reopen_override: 'true',
        updated_at: new Date().toISOString()
      }));

      if (result && result.isOk) {
        try {
          if (typeof allData !== 'undefined' && Array.isArray(allData)) {
            var index = allData.findIndex(function (record) { return record.__backendId === dorm.__backendId; });
            if (index >= 0) {
              allData[index] = Object.assign({}, allData[index], result.data || {}, {
                state: 'open',
                phase: 'OPEN',
                opened_at: reopenedOpenedAt,
                closed_at: '',
                closed_timer: '',
                manual_reopen_override: undefined
              });
            }
          }
        } catch (error) {
          console.warn('PRC DASH reopen local update failed:', error);
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
        showEditMessage((result && result.error) || 'Failed to reopen dorm.', true);
      }
    } catch (error) {
      console.warn('PRC DASH reopen dorm failed:', error);
      showEditMessage('Failed to reopen dorm.', true);
    }
  }

  function startPatch() {
    if (patchStarted) return;
    patchStarted = true;

    window.reopenDormFromEditModal = reopenDormFromEditModal;
    ensureReopenButton();

    setInterval(ensureReopenButton, 750);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startPatch);
  } else {
    startPatch();
  }
})();
