// PRC GATE dorm flag validation
// UI/UX + dorm flag preservation only. Keeps core routing, archive math, and API paths intact.
(function () {
  let started = false;
  let stylesReady = false;
  let sdkPatched = false;
  let editOpenPatched = false;

  function n(value) {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function esc(value) {
    if (typeof escapeHtml === 'function') return escapeHtml(value);
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function getAllDataSafe() {
    try { return Array.isArray(allData) ? allData : []; } catch (_) { return []; }
  }

  function getActiveWeekGroupSafe() {
    try { return typeof getActiveWG === 'function' ? getActiveWG() : ''; } catch (_) { return ''; }
  }

  function activeDorms() {
    const wg = getActiveWeekGroupSafe();
    return getAllDataSafe().filter(record => record && record.type === 'dorm' && record.week_group === wg);
  }

  function isFemale(dorm) {
    return String(dorm?.sex || '').toLowerCase() === 'female';
  }

  function isBand(dorm) {
    return dorm && (dorm.band === true || dorm.band === 'true');
  }

  function isSpaceForce(dorm) {
    return dorm && (dorm.space_force === true || dorm.space_force === 'true' || dorm.is_space_force === true || dorm.is_space_force === 'true');
  }

  function ensureStyles() {
    if (stylesReady || document.getElementById('prc-gate-dorm-flag-validation-styles')) return;

    const style = document.createElement('style');
    style.id = 'prc-gate-dorm-flag-validation-styles';
    style.textContent = `
      .gate-dorm-flags {
        display: flex !important;
        flex-wrap: wrap !important;
        gap: 0.28rem !important;
        align-items: center !important;
        justify-content: flex-start !important;
        margin-top: 0.36rem !important;
        min-height: 1.25rem !important;
      }

      .gate-dorm-card .gate-dorm-flags {
        grid-area: info !important;
        align-self: end !important;
        margin-top: 1.38rem !important;
      }

      .proc-card .gate-dorm-flags {
        margin-top: 0.5rem !important;
      }

      .gate-dorm-flag-chip {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        min-height: 1.18rem !important;
        padding: 0.18rem 0.48rem !important;
        border-radius: 999px !important;
        border: 1px solid rgba(180, 198, 228, 0.24) !important;
        background: rgba(180, 198, 228, 0.08) !important;
        color: var(--text-soft, var(--text-muted)) !important;
        font-size: 0.58rem !important;
        font-weight: 950 !important;
        line-height: 1 !important;
        letter-spacing: 0.075em !important;
        text-transform: uppercase !important;
        white-space: nowrap !important;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.12), 0 3px 10px rgba(0,0,0,0.12) !important;
      }

      .gate-dorm-flag-chip.flag-female {
        background: rgba(239, 68, 68, 0.14) !important;
        border-color: rgba(248, 113, 113, 0.48) !important;
        color: #fecaca !important;
      }

      .gate-dorm-flag-chip.flag-band {
        background: rgba(56, 189, 248, 0.14) !important;
        border-color: rgba(56, 189, 248, 0.48) !important;
        color: #dff4ff !important;
      }

      .gate-dorm-flag-chip.flag-space-force {
        background: rgba(139, 92, 246, 0.16) !important;
        border-color: rgba(167, 139, 250, 0.52) !important;
        color: #ede9fe !important;
      }

      .border-space-force {
        border-color: rgba(167, 139, 250, 0.72) !important;
        box-shadow: var(--glass-highlight), var(--shadow-soft), 0 0 0 1px rgba(167, 139, 250, 0.30), 0 0 18px rgba(139, 92, 246, 0.22) !important;
      }

      .border-female.border-band,
      .border-female.border-space-force,
      .border-band.border-space-force,
      .border-female.border-band.border-space-force {
        border-color: rgba(255, 255, 255, 0.26) !important;
        box-shadow:
          var(--glass-highlight),
          var(--shadow-soft),
          inset 4px 0 0 rgba(248, 113, 113, 0.95),
          inset 8px 0 0 rgba(56, 189, 248, 0.86),
          inset 12px 0 0 rgba(167, 139, 250, 0.78),
          0 0 18px rgba(56, 189, 248, 0.12),
          0 0 18px rgba(248, 113, 113, 0.11) !important;
      }

      .theme-light .gate-dorm-flag-chip.flag-female { color: #7f1d1d !important; background: rgba(254, 202, 202, 0.48) !important; border-color: rgba(185, 28, 28, 0.26) !important; }
      .theme-light .gate-dorm-flag-chip.flag-band { color: #075985 !important; background: rgba(224, 242, 254, 0.72) !important; border-color: rgba(2, 132, 199, 0.26) !important; }
      .theme-light .gate-dorm-flag-chip.flag-space-force { color: #4c1d95 !important; background: rgba(237, 233, 254, 0.72) !important; border-color: rgba(109, 40, 217, 0.24) !important; }
    `;

    document.head.appendChild(style);
    stylesReady = true;
  }

  function flagHtml(dorm) {
    const chips = [];
    if (isFemale(dorm)) chips.push('<span class="gate-dorm-flag-chip flag-female">Female</span>');
    if (isBand(dorm)) chips.push('<span class="gate-dorm-flag-chip flag-band">Band</span>');
    if (isSpaceForce(dorm)) chips.push('<span class="gate-dorm-flag-chip flag-space-force">Space Force</span>');
    return chips.length ? `<div class="gate-dorm-flags">${chips.join('')}</div>` : '';
  }

  function applyCardClasses(card, dorm) {
    card.classList.toggle('border-female', isFemale(dorm));
    card.classList.toggle('border-band', isBand(dorm));
    card.classList.toggle('border-space-force', isSpaceForce(dorm));
    card.dataset.spaceForce = isSpaceForce(dorm) ? 'true' : 'false';
    card.dataset.bandDorm = isBand(dorm) ? 'true' : 'false';
    card.dataset.femaleDorm = isFemale(dorm) ? 'true' : 'false';
  }

  function setFlags(card, dorm) {
    if (!card || !dorm) return;
    applyCardClasses(card, dorm);
    const sig = `${isFemale(dorm)}|${isBand(dorm)}|${isSpaceForce(dorm)}`;
    if (card.dataset.dormFlagSig === sig && card.querySelector('.gate-dorm-flags')) return;
    card.dataset.dormFlagSig = sig;
    const existing = card.querySelector('.gate-dorm-flags');
    if (existing) existing.remove();
    const html = flagHtml(dorm);
    if (!html) return;

    const info = card.querySelector('.gate-dorm-info') || card.querySelector('.text-xs.text-muted.font-bold.uppercase') || card.querySelector('.text-xl.font-black.font-tabular');
    if (info) info.insertAdjacentHTML('afterend', html);
    else card.insertAdjacentHTML('beforeend', html);
  }

  function dormsForColumn(columnId) {
    const dorms = activeDorms();
    if (columnId.includes('empty')) return dorms.filter(d => d.state === 'empty');
    if (columnId.includes('open')) return dorms.filter(d => d.state === 'open');
    if (columnId.includes('closed')) return dorms.filter(d => d.state === 'closed');
    return dorms;
  }

  function validateBoardCards() {
    ['col-empty', 'col-open', 'col-closed', 'squadron-col-empty', 'squadron-col-open', 'squadron-col-closed'].forEach(columnId => {
      const col = document.getElementById(columnId);
      if (!col) return;
      const dorms = dormsForColumn(columnId);
      col.querySelectorAll('.dorm-card, .gate-dorm-card').forEach((card, index) => setFlags(card, dorms[index]));
    });
  }

  function validateProcessingCards() {
    const grid = document.getElementById('proc-dorm-grid');
    if (!grid) return;
    const dorms = activeDorms();
    grid.querySelectorAll('.proc-card').forEach((card, index) => setFlags(card, dorms[index]));
  }

  function ensureEditSpaceForceField() {
    const band = document.getElementById('edit-band');
    if (!band || document.getElementById('edit-space-force')) return;

    const bandLabel = band.closest('label');
    if (!bandLabel) return;
    bandLabel.insertAdjacentHTML('afterend', `
      <label id="edit-space-force-wrapper" class="flex items-center gap-2 text-sm font-bold">
        <input id="edit-space-force" type="checkbox" class="w-4 h-4">
        Space Force Dorm
      </label>
    `);
  }

  function getEditDorm() {
    let id = '';
    try { id = editDormId || ''; } catch (_) { id = ''; }
    if (id) return getAllDataSafe().find(record => record && record.type === 'dorm' && record.__backendId === id) || null;

    const name = document.getElementById('edit-dorm-name')?.value || '';
    const sdq = document.getElementById('edit-sdq')?.value || '';
    const section = document.getElementById('edit-section')?.value || '';
    const inter = document.getElementById('edit-inter-sec')?.value || '';
    return activeDorms().find(dorm => (
      String(dorm.dorm_name || '') === String(name || '') &&
      String(dorm.sdq || '') === String(sdq || '') &&
      String(dorm.section || '') === String(section || '') &&
      String(dorm.inter_sec || '') === String(inter || '')
    )) || null;
  }

  function syncEditSpaceForceField() {
    const modal = document.getElementById('dorm-edit-modal');
    const input = document.getElementById('edit-space-force');
    if (!modal || modal.classList.contains('hidden') || !input || input.dataset.userTouched === 'true') return;
    const dorm = getEditDorm();
    input.checked = isSpaceForce(dorm);
  }

  function patchEditOpen() {
    if (editOpenPatched || typeof openDormEditModal !== 'function') return;
    const originalOpen = openDormEditModal;
    const patchedOpen = function patchedOpenDormEditModal(event, id) {
      const result = originalOpen.apply(this, arguments);
      ensureEditSpaceForceField();
      const input = document.getElementById('edit-space-force');
      const dorm = getAllDataSafe().find(record => record && record.type === 'dorm' && record.__backendId === id);
      if (input) {
        input.dataset.userTouched = 'false';
        input.checked = isSpaceForce(dorm);
      }
      return result;
    };
    window.openDormEditModal = patchedOpen;
    try { openDormEditModal = patchedOpen; } catch (_) {}
    editOpenPatched = true;
  }

  function patchDataSdkUpdate() {
    if (sdkPatched || !window.dataSdk || typeof window.dataSdk.update !== 'function') return;
    const originalUpdate = window.dataSdk.update.bind(window.dataSdk);
    window.dataSdk.update = function patchedDormFlagUpdate(payload) {
      if (payload && payload.type === 'dorm') {
        const sfInput = document.getElementById('edit-space-force');
        const editModal = document.getElementById('dorm-edit-modal');
        if (sfInput && editModal && !editModal.classList.contains('hidden')) {
          payload = Object.assign({}, payload, { space_force: sfInput.checked ? 'true' : 'false' });
        }
      }
      return originalUpdate(payload);
    };
    sdkPatched = true;
  }

  function updateDormModalInfo() {
    const modal = document.getElementById('dorm-modal');
    const info = document.getElementById('modal-dorm-info');
    const name = document.getElementById('modal-dorm-name')?.textContent || '';
    if (!modal || modal.classList.contains('hidden') || !info || !name) return;
    const dorm = activeDorms().find(record => String(record.dorm_name || '') === String(name || ''));
    if (!dorm) return;
    const base = `${[esc(dorm.sdq), esc(dorm.section), esc(dorm.inter_sec)].filter(Boolean).join(' · ')} | ${isFemale(dorm) ? '♀ Female' : '♂ Male'}${isBand(dorm) ? ' | Band' : ''}${isSpaceForce(dorm) ? ' | Space Force' : ''} | Max: ${n(dorm.max_load)}`;
    if (info.dataset.flagSig !== base) {
      info.innerHTML = base;
      info.dataset.flagSig = base;
    }
  }

  function runPass() {
    ensureStyles();
    ensureEditSpaceForceField();
    patchEditOpen();
    patchDataSdkUpdate();
    syncEditSpaceForceField();
    validateBoardCards();
    validateProcessingCards();
    updateDormModalInfo();
  }

  function start() {
    if (started) return;
    started = true;
    document.addEventListener('change', event => {
      if (event.target && event.target.id === 'edit-space-force') event.target.dataset.userTouched = 'true';
    }, true);
    runPass();
    setInterval(runPass, 350);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
