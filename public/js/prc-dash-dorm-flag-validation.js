// GATE dorm designation validation
// Identity-bound support for dorm flag rendering and Space Force edit preservation.
(function () {
  'use strict';

  let started = false;
  let sdkPatched = false;
  let editOpenPatched = false;
  let hooksRegistered = false;
  let passScheduled = false;

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

  function getAllDataSafe() {
    try { return Array.isArray(allData) ? allData : []; } catch (_) { return []; }
  }

  function getActiveWeekGroupSafe() {
    try { return typeof getActiveWG === 'function' ? getActiveWG() : ''; } catch (_) { return ''; }
  }

  function activeDorms() {
    const wg = getActiveWeekGroupSafe();
    const dorms = getAllDataSafe().filter(record => record && record.type === 'dorm' && record.week_group === wg);
    return recordDisplay()?.sortDorms ? recordDisplay().sortDorms(dorms) : dorms;
  }

  function effectiveFlags(dorm) {
    const normalized = recordDisplay()?.normalizeDormFlags?.(dorm);
    const female = String(dorm?.sex || '').trim().toLowerCase() === 'female' || String(dorm?.sex || '').trim().toLowerCase() === 'f';
    if (normalized) return { female, band: normalized.band, spaceForce: normalized.spaceForce, hasBanner: normalized.band || normalized.spaceForce };
    const spaceForce = dorm && (dorm.space_force === true || dorm.space_force === 'true' || dorm.is_space_force === true || dorm.is_space_force === 'true');
    const band = !spaceForce && dorm && (dorm.band === true || dorm.band === 'true');
    return { female, band, spaceForce, hasBanner: band || spaceForce };
  }

  function flagHtml(flags) {
    const chips = [];
    if (flags.band) chips.push('<span class="gate-dorm-flag-chip flag-band">Band</span>');
    if (flags.spaceForce) chips.push('<span class="gate-dorm-flag-chip flag-space-force">Space Force</span>');
    return chips.length ? `<div class="gate-dorm-flags">${chips.join('')}</div>` : '';
  }

  function bannerHtml(flags) {
    if (flags.spaceForce) return '<div class="gate-dorm-top-banner banner-space-force">Space Force</div>';
    if (flags.band) return '<div class="gate-dorm-top-banner banner-band">Band</div>';
    return '';
  }

  function cardDormId(card) {
    return String(card?.dataset?.dormId || '').trim();
  }

  function dormById(id, dorms = activeDorms()) {
    if (!id) return null;
    return dorms.find(dorm => String(dorm.__backendId || '') === String(id)) || null;
  }

  function applyCardClasses(card, flags) {
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
    const flags = effectiveFlags(dorm);
    applyCardClasses(card, flags);

    const isBoardCard = Boolean(card.closest('#page-board, #page-squadron'));
    const signature = `${dorm.__backendId || ''}|${isBoardCard ? 'banner' : 'chip'}|${flags.female}|${flags.band}|${flags.spaceForce}`;
    const shouldShowIndicator = flags.band || flags.spaceForce;
    const existingFlags = card.querySelector('.gate-dorm-flags');
    const existingBanner = card.querySelector('.gate-dorm-top-banner');

    if (card.dataset.dormFlagSig === signature) {
      if (isBoardCard && (existingBanner || !shouldShowIndicator)) return;
      if (!isBoardCard && (existingFlags || !shouldShowIndicator)) return;
    }

    card.dataset.dormFlagSig = signature;
    existingFlags?.remove();
    existingBanner?.remove();

    if (!shouldShowIndicator) return;
    if (isBoardCard) {
      const banner = bannerHtml(flags);
      if (banner) card.insertAdjacentHTML('afterbegin', banner);
      return;
    }

    const html = flagHtml(flags);
    if (!html) return;
    const info = card.querySelector('.gate-dorm-info') || card.querySelector('.text-xs.text-muted.font-bold.uppercase') || card.querySelector('.text-xl.font-black.font-tabular');
    if (info) info.insertAdjacentHTML('afterend', html);
    else card.insertAdjacentHTML('beforeend', html);
  }

  function validateCards() {
    const dorms = activeDorms();
    document.querySelectorAll('#page-board .dorm-card[data-dorm-id], #page-squadron .dorm-card[data-dorm-id], #proc-dorm-grid .proc-card[data-dorm-id]').forEach(card => {
      const dorm = dormById(cardDormId(card), dorms);
      if (dorm) setFlags(card, dorm);
    });
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

  function activeEditDormId() {
    try { return String(editDormId || ''); } catch (_) { return ''; }
  }

  function activeModalDormId() {
    try { return String(modalDormId || ''); } catch (_) { return ''; }
  }

  function syncEditSpaceForceField(id = activeEditDormId()) {
    const modal = document.getElementById('dorm-edit-modal');
    const input = document.getElementById('edit-space-force');
    if (!modal || modal.classList.contains('hidden') || !input || input.dataset.userTouched === 'true') return;
    const dorm = dormById(id, getAllDataSafe());
    const flags = effectiveFlags(dorm);
    input.checked = flags.spaceForce;
    if (input.checked) {
      const bandInput = document.getElementById('edit-band');
      if (bandInput) bandInput.checked = false;
    }
  }

  function patchEditOpen() {
    if (editOpenPatched || typeof openDormEditModal !== 'function') return;
    const originalOpen = openDormEditModal;
    const patchedOpen = function gateIdentityBoundOpenDormEditModal(event, id) {
      const result = originalOpen.apply(this, arguments);
      ensureEditSpaceForceField();
      const input = document.getElementById('edit-space-force');
      if (input) input.dataset.userTouched = 'false';
      syncEditSpaceForceField(id);
      return result;
    };
    patchedOpen.__gateDormFlagIdentityBound = true;
    window.openDormEditModal = patchedOpen;
    try { openDormEditModal = patchedOpen; } catch (_) {}
    editOpenPatched = true;
  }

  function patchDataSdkUpdate() {
    if (sdkPatched || !window.dataSdk || typeof window.dataSdk.update !== 'function') return;
    const originalUpdate = window.dataSdk.update.bind(window.dataSdk);
    window.dataSdk.update = function gateIdentityBoundDormFlagUpdate(payload) {
      const editModal = document.getElementById('dorm-edit-modal');
      const editedId = activeEditDormId();
      if (
        payload &&
        payload.type === 'dorm' &&
        payload.__backendId &&
        editedId &&
        String(payload.__backendId) === editedId &&
        editModal &&
        !editModal.classList.contains('hidden')
      ) {
        const sfInput = document.getElementById('edit-space-force');
        const bandInput = document.getElementById('edit-band');
        const spaceForce = Boolean(sfInput?.checked);
        const band = !spaceForce && Boolean(bandInput?.checked);
        payload = Object.assign({}, payload, {
          band: band ? 'true' : 'false',
          space_force: spaceForce ? 'true' : 'false',
          is_space_force: spaceForce ? 'true' : 'false'
        });
      }
      return originalUpdate(payload);
    };
    sdkPatched = true;
  }

  function updateDormModalInfo() {
    const modal = document.getElementById('dorm-modal');
    const info = document.getElementById('modal-dorm-info');
    if (!modal || modal.classList.contains('hidden') || !info) return;
    const dorm = dormById(activeModalDormId());
    if (!dorm) return;

    const flags = effectiveFlags(dorm);
    const text = `${[esc(dorm.sdq), esc(dorm.section), esc(dorm.inter_sec)].filter(Boolean).join(' · ')} | ${flags.female ? '♀ Female' : '♂ Male'}${flags.band ? ' | Band' : ''}${flags.spaceForce ? ' | Space Force' : ''} | Max: ${n(dorm.max_load)}`;
    if (info.dataset.flagSig !== text) {
      info.innerHTML = text;
      info.dataset.flagSig = text;
    }
  }

  function enforceImpossibleFlagCombination(event) {
    const target = event.target;
    if (!target || !target.classList) return;

    if (target.classList.contains('batch-space-force') && target.checked) {
      const index = Number(target.dataset.row);
      const bandInput = document.querySelector(`.batch-band[data-row="${index}"]`);
      if (bandInput) bandInput.checked = false;
      try { if (Array.isArray(batchRows) && Number.isFinite(index) && batchRows[index]) batchRows[index].band = false; } catch (_) {}
    }

    if (target.classList.contains('batch-band') && target.checked) {
      const index = Number(target.dataset.row);
      const sfInput = document.querySelector(`.batch-space-force[data-row="${index}"]`);
      if (sfInput) sfInput.checked = false;
      try { if (Array.isArray(batchRows) && Number.isFinite(index) && batchRows[index]) batchRows[index].space_force = false; } catch (_) {}
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
    validateCards();
    updateDormModalInfo();
  }

  function schedulePass() {
    if (passScheduled) return;
    passScheduled = true;
    requestAnimationFrame(runPass);
  }

  function registerHooks() {
    if (hooksRegistered || typeof window.registerGateHook !== 'function') return;
    window.registerGateHook('afterRenderAll', schedulePass);
    window.registerGateHook('afterDataChanged', schedulePass);
    window.registerGateHook('afterPageChange', schedulePass);
    window.registerGateHook('afterModalOpen', schedulePass);
    hooksRegistered = true;
  }

  function start() {
    if (started) return;
    started = true;
    document.addEventListener('change', event => {
      if (event.target?.id === 'edit-space-force') event.target.dataset.userTouched = 'true';
      enforceImpossibleFlagCombination(event);
      schedulePass();
    }, true);
    document.addEventListener('click', schedulePass, true);
    registerHooks();
    schedulePass();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();