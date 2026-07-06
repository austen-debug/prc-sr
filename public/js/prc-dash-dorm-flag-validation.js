// PRC GATE dorm flag validation
// Behavior-only layer for dorm flag rendering and Space Force edit preservation.
// Board card styles are owned by /css/gate-clean-ui-pass.css; Processing chip styles are owned by /css/prc-dash-dorm-cards.css.
(function () {
  let started = false;
  let sdkPatched = false;
  let editOpenPatched = false;
  let passScheduled = false;

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
    const sex = String(dorm?.sex || '').trim().toLowerCase();
    return sex === 'female' || sex === 'f';
  }

  function isBand(dorm) {
    return dorm && (dorm.band === true || dorm.band === 'true');
  }

  function isSpaceForce(dorm) {
    return dorm && (dorm.space_force === true || dorm.space_force === 'true' || dorm.is_space_force === true || dorm.is_space_force === 'true');
  }

  function effectiveFlags(dorm) {
    const female = isFemale(dorm);
    const spaceForce = isSpaceForce(dorm);
    const band = !spaceForce && isBand(dorm);
    return { female, band, spaceForce, hasBanner: band || spaceForce };
  }

  function flagHtml(dorm) {
    const flags = effectiveFlags(dorm);
    const chips = [];
    if (flags.band) chips.push('<span class="gate-dorm-flag-chip flag-band">Band</span>');
    if (flags.spaceForce) chips.push('<span class="gate-dorm-flag-chip flag-space-force">Space Force</span>');
    return chips.length ? `<div class="gate-dorm-flags">${chips.join('')}</div>` : '';
  }

  function bannerHtml(dorm) {
    const flags = effectiveFlags(dorm);
    if (flags.spaceForce) return '<div class="gate-dorm-top-banner banner-space-force">Space Force</div>';
    if (flags.band) return '<div class="gate-dorm-top-banner banner-band">Band</div>';
    return '';
  }

  function applyCardClasses(card, dorm) {
    const flags = effectiveFlags(dorm);
    card.classList.toggle('border-female', flags.female);
    card.classList.toggle('border-band', flags.band);
    card.classList.toggle('border-space-force', flags.spaceForce);
    card.classList.toggle('gate-dorm-has-banner', flags.hasBanner);
    card.dataset.spaceForce = flags.spaceForce ? 'true' : 'false';
    card.dataset.bandDorm = flags.band ? 'true' : 'false';
    card.dataset.femaleDorm = flags.female ? 'true' : 'false';
    card.dataset.hasBanner = flags.hasBanner ? 'true' : 'false';
  }

  function setFlags(card, dorm) {
    if (!card || !dorm) return;
    applyCardClasses(card, dorm);

    const flags = effectiveFlags(dorm);
    const isBoardCard = Boolean(card.closest('#page-board, #page-squadron'));
    const sig = `${isBoardCard ? 'banner' : 'chip'}|${flags.female}|${flags.band}|${flags.spaceForce}`;
    const hasBoardBanner = Boolean(card.querySelector('.gate-dorm-top-banner'));
    const hasProcFlags = Boolean(card.querySelector('.gate-dorm-flags'));
    const shouldShowIndicator = flags.band || flags.spaceForce;

    if (
      card.dataset.dormFlagSig === sig &&
      ((isBoardCard && (hasBoardBanner || !shouldShowIndicator)) || (!isBoardCard && (hasProcFlags || !shouldShowIndicator)))
    ) return;

    card.dataset.dormFlagSig = sig;

    const existingFlags = card.querySelector('.gate-dorm-flags');
    if (existingFlags) existingFlags.remove();

    const existingBanner = card.querySelector('.gate-dorm-top-banner');
    if (existingBanner) existingBanner.remove();

    if (!shouldShowIndicator) return;

    if (isBoardCard) {
      const banner = bannerHtml(dorm);
      if (banner) card.insertAdjacentHTML('afterbegin', banner);
      return;
    }

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

  function getDormFromCard(card, fallback) {
    const onclick = card?.getAttribute?.('onclick') || '';
    const contextmenu = card?.getAttribute?.('oncontextmenu') || '';
    const idMatch = onclick.match(/openDormModal\('([^']+)'\)/) || contextmenu.match(/openDormEditModal\([^,]+,\s*'([^']+)'\)/);
    const id = idMatch ? idMatch[1] : '';
    if (id) {
      const match = activeDorms().find(dorm => dorm.__backendId === id);
      if (match) return match;
    }
    return fallback || null;
  }

  function validateProcessingCards() {
    const grid = document.getElementById('proc-dorm-grid');
    if (!grid) return;
    const dorms = activeDorms();
    grid.querySelectorAll('.proc-card').forEach((card, index) => setFlags(card, getDormFromCard(card, dorms[index])));
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
    if (input.checked) {
      const bandInput = document.getElementById('edit-band');
      if (bandInput) bandInput.checked = false;
    }
  }

  function patchEditOpen() {
    if (editOpenPatched || typeof openDormEditModal !== 'function') return;
    const originalOpen = openDormEditModal;
    const patchedOpen = function patchedOpenDormEditModal(event, id) {
      const result = originalOpen.apply(this, arguments);
      ensureEditSpaceForceField();
      const input = document.getElementById('edit-space-force');
      const bandInput = document.getElementById('edit-band');
      const dorm = getAllDataSafe().find(record => record && record.type === 'dorm' && record.__backendId === id);
      if (input) {
        input.dataset.userTouched = 'false';
        input.checked = isSpaceForce(dorm);
      }
      if (bandInput && input?.checked) bandInput.checked = false;
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
        const bandInput = document.getElementById('edit-band');
        const editModal = document.getElementById('dorm-edit-modal');
        if (sfInput && editModal && !editModal.classList.contains('hidden')) {
          payload = Object.assign({}, payload, {
            space_force: sfInput.checked ? 'true' : 'false',
            band: sfInput.checked ? 'false' : (bandInput && bandInput.checked ? 'true' : payload.band)
          });
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
    const flags = effectiveFlags(dorm);
    const base = `${[esc(dorm.sdq), esc(dorm.section), esc(dorm.inter_sec)].filter(Boolean).join(' · ')} | ${flags.female ? '♀ Female' : '♂ Male'}${flags.band ? ' | Band' : ''}${flags.spaceForce ? ' | Space Force' : ''} | Max: ${n(dorm.max_load)}`;
    if (info.dataset.flagSig !== base) {
      info.innerHTML = base;
      info.dataset.flagSig = base;
    }
  }

  function enforceImpossibleFlagCombination(event) {
    const target = event.target;
    if (!target || !target.classList) return;

    if (target.classList.contains('batch-space-force') && target.checked) {
      const row = target.closest('[data-row]') || target.closest('div');
      const index = Number(target.dataset.row);
      const bandInput = row?.querySelector?.('.batch-band');
      if (bandInput) bandInput.checked = false;
      if (Array.isArray(batchRows) && Number.isFinite(index) && batchRows[index]) batchRows[index].band = false;
    }

    if (target.classList.contains('batch-band') && target.checked) {
      const row = target.closest('[data-row]') || target.closest('div');
      const index = Number(target.dataset.row);
      const sfInput = row?.querySelector?.('.batch-space-force');
      if (sfInput) sfInput.checked = false;
      if (Array.isArray(batchRows) && Number.isFinite(index) && batchRows[index]) batchRows[index].space_force = false;
    }

    if (target.id === 'edit-space-force' && target.checked) {
      const bandInput = document.getElementById('edit-band');
      if (bandInput) bandInput.checked = false;
    }

    if (target.id === 'edit-band' && target.checked) {
      const sfInput = document.getElementById('edit-space-force');
      if (sfInput) sfInput.checked = false;
    }
  }

  function runPass() {
    passScheduled = false;
    ensureEditSpaceForceField();
    patchEditOpen();
    patchDataSdkUpdate();
    syncEditSpaceForceField();
    validateBoardCards();
    validateProcessingCards();
    updateDormModalInfo();
  }

  function schedulePass() {
    if (passScheduled) return;
    passScheduled = true;
    requestAnimationFrame(runPass);
  }

  function observeRenderTargets() {
    const observer = new MutationObserver(schedulePass);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'onclick', 'oncontextmenu']
    });
  }

  function start() {
    if (started) return;
    started = true;
    document.addEventListener('change', event => {
      if (event.target && event.target.id === 'edit-space-force') event.target.dataset.userTouched = 'true';
      enforceImpossibleFlagCombination(event);
      schedulePass();
    }, true);
    document.addEventListener('click', schedulePass, true);
    observeRenderTargets();
    schedulePass();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
