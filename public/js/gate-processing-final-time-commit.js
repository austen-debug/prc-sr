// GATE Processing Final Time Commit Controller
// Directly commits closed dorm Final Time edits and forces Processing / Status Board refresh.
(function () {
  'use strict';

  let installed = false;
  let submitting = false;
  let lastSavedDormId = '';
  let lastSavedAt = 0;

  function isInstructor() {
    try { return currentRole === 'instructor'; } catch (_) { return false; }
  }

  function allRecords() {
    if (Array.isArray(window.allData)) return window.allData;
    try { return Array.isArray(allData) ? allData : []; } catch (_) { return []; }
  }

  function activeEditDormId() {
    try { return editDormId || ''; } catch (_) { return ''; }
  }

  function dormById(id) {
    return allRecords().find(record => record && record.type === 'dorm' && record.__backendId === id) || null;
  }

  function normalizeFinalTime(value, fallback = '00:00') {
    const raw = String(value || '').trim();
    if (!raw) return fallback || '00:00';
    const match = raw.match(/^(\d{1,5})(?::([0-5]\d))?$/);
    if (!match) return raw;
    return `${String(Number(match[1] || 0)).padStart(2, '0')}:${match[2] || '00'}`;
  }

  function normalizeUpper(value) {
    return String(value || '').trim().toUpperCase();
  }

  function syncLocalRecord(record) {
    if (!record || !record.__backendId) return;
    const records = allRecords();
    if (!Array.isArray(records)) return;
    const index = records.findIndex(item => item && item.__backendId === record.__backendId);
    if (index >= 0) records[index] = { ...records[index], ...record };
    else records.push(record);
  }

  function setMessage(message, isError = false) {
    const msg = document.getElementById('dorm-edit-msg');
    if (!msg) return;
    msg.textContent = message;
    msg.style.color = isError ? 'var(--red)' : 'var(--green)';
    msg.classList.remove('hidden');
  }

  function showCardConfirmation(dormId, finalTime) {
    lastSavedDormId = dormId;
    lastSavedAt = Date.now();

    window.setTimeout(() => {
      if (lastSavedDormId === dormId && Date.now() - lastSavedAt >= 2800) {
        lastSavedDormId = '';
        forceRefresh();
      }
    }, 3000);

    window.setTimeout(() => markSavedCards(dormId, finalTime), 50);
    window.setTimeout(() => markSavedCards(dormId, finalTime), 250);
  }

  function markSavedCards(dormId, finalTime) {
    if (!dormId || !lastSavedDormId) return;
    const selectors = [
      `#page-processing .proc-card[onclick*="${CSS.escape(dormId)}"]`,
      `#page-board .gate-dorm-card[data-dorm-id="${CSS.escape(dormId)}"]`,
      `#page-board .dorm-card[data-dorm-id="${CSS.escape(dormId)}"]`
    ];

    document.querySelectorAll(selectors.join(',')).forEach(card => {
      if (!card || card.querySelector('.gate-final-time-saved-badge')) return;
      const badge = document.createElement('div');
      badge.className = 'gate-final-time-saved-badge';
      badge.textContent = `FINAL TIME UPDATED · ${finalTime}`;
      badge.style.cssText = [
        'margin-top:0.45rem',
        'padding:0.32rem 0.5rem',
        'border-radius:999px',
        'border:1px solid rgba(134,239,172,0.42)',
        'background:rgba(22,163,74,0.18)',
        'color:#dcfce7',
        'font-size:0.62rem',
        'font-weight:950',
        'letter-spacing:0.09em',
        'text-align:center',
        'text-transform:uppercase'
      ].join(';');
      card.appendChild(badge);
    });
  }

  function forceRefresh() {
    try { if (typeof renderAll === 'function') renderAll(); } catch (error) { console.warn('GATE Final Time renderAll refresh failed:', error); }
    try { if (typeof renderProcessingPage === 'function') renderProcessingPage(); } catch (_) {}
    try { window.GateDormBoardController?.refresh?.(); } catch (_) {}
    try { window.runGateHooks?.('afterDataChanged', { source: 'final-time-commit' }); } catch (_) {}
    try { window.runGateHooks?.('afterRenderAll', { source: 'final-time-commit' }); } catch (_) {}

    if (lastSavedDormId) {
      const dorm = dormById(lastSavedDormId);
      if (dorm) window.setTimeout(() => markSavedCards(lastSavedDormId, dorm.closed_timer || ''), 40);
    }
  }

  function readEditPayload(dorm, finalTime) {
    const value = id => document.getElementById(id)?.value;
    const checked = id => Boolean(document.getElementById(id)?.checked);

    const maxLoad = Math.max(0, Number(value('edit-max-load') || dorm.max_load || 0));
    const currentLoadRaw = Math.max(0, Number(value('edit-current-load') || dorm.current_load || 0));
    const currentLoad = Math.min(currentLoadRaw, maxLoad);

    const airman = document.getElementById('edit-assigned-airman');
    const auditorium = document.getElementById('edit-auditorium-location');

    return {
      ...dorm,
      dorm_name: String(value('edit-dorm-name') || dorm.dorm_name || '').trim() || dorm.dorm_name,
      sdq: String(value('edit-sdq') || '').trim(),
      section: String(value('edit-section') || '').trim(),
      inter_sec: String(value('edit-inter-sec') || '').trim(),
      sex: value('edit-sex') || dorm.sex || 'male',
      band: checked('edit-band') ? 'true' : 'false',
      max_load: maxLoad,
      current_load: currentLoad,
      notes: String(value('edit-notes') || '').trim(),
      assigned_airman: airman ? normalizeUpper(airman.value) : dorm.assigned_airman,
      auditorium_location: auditorium ? normalizeUpper(auditorium.value) : dorm.auditorium_location,
      state: 'closed',
      phase: 'Closed',
      closed_timer: finalTime,
      updated_at: new Date().toISOString()
    };
  }

  async function commitFinalTime(options = {}) {
    if (submitting || !isInstructor()) return false;

    const modal = document.getElementById('dorm-edit-modal');
    const form = document.getElementById('dorm-edit-form');
    const input = document.getElementById('edit-closed-timer');
    const dormId = activeEditDormId();
    const dorm = dormId ? dormById(dormId) : null;

    if (!modal || modal.classList.contains('hidden') || !form || !input || !dorm) return false;
    if (String(dorm.state || '').toLowerCase() !== 'closed') return false;

    const finalTime = normalizeFinalTime(input.value, dorm.closed_timer || '00:00');
    if (!/^\d{1,5}:\d{2}$/.test(finalTime)) {
      setMessage('Final Time must use MM:SS format, such as 60:00.', true);
      return true;
    }

    input.value = finalTime;
    const payload = readEditPayload(dorm, finalTime);
    const submit = form.querySelector('button[type="submit"]');
    const originalText = submit ? submit.textContent : '';

    submitting = true;
    if (submit) {
      submit.disabled = true;
      submit.textContent = 'SAVING FINAL TIME...';
    }

    try {
      const result = await window.dataSdk.update(payload);
      if (!result?.isOk) {
        setMessage(result?.error || 'Failed to save Final Time.', true);
        return true;
      }

      const saved = { ...payload, ...(result.data || {}) };
      saved.closed_timer = finalTime;
      saved.state = 'closed';
      saved.phase = 'Closed';
      syncLocalRecord(saved);
      setMessage(`Final Time saved as ${finalTime}.`, false);
      showCardConfirmation(dormId, finalTime);
      forceRefresh();

      if (options.closeModal !== false && typeof closeDormEditModal === 'function') {
        window.setTimeout(() => closeDormEditModal(), 260);
      }
      return true;
    } catch (error) {
      console.error('GATE Final Time save failed:', error);
      setMessage('Failed to save Final Time.', true);
      return true;
    } finally {
      submitting = false;
      if (submit) {
        submit.disabled = false;
        submit.textContent = originalText || 'SAVE CHANGES';
      }
    }
  }

  function handleSubmit(event) {
    if (event.target?.id !== 'dorm-edit-form') return;
    const dorm = dormById(activeEditDormId());
    if (!dorm || String(dorm.state || '').toLowerCase() !== 'closed') return;
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    commitFinalTime({ closeModal: true });
  }

  function handleKeydown(event) {
    if (event.target?.id !== 'edit-closed-timer' || event.key !== 'Enter') return;
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    commitFinalTime({ closeModal: true });
  }

  function handleBlur(event) {
    if (event.target?.id !== 'edit-closed-timer') return;
    const dorm = dormById(activeEditDormId());
    event.target.value = normalizeFinalTime(event.target.value, dorm?.closed_timer || '00:00');
  }

  function start() {
    if (installed) return;
    installed = true;
    document.addEventListener('submit', handleSubmit, true);
    document.addEventListener('keydown', handleKeydown, true);
    document.addEventListener('blur', handleBlur, true);
    window.GateProcessingFinalTimeCommit = Object.freeze({ commit: commitFinalTime, refresh: forceRefresh });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
