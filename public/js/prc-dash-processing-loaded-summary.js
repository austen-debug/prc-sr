// GATE processing loaded-versus-arrived summary
// Shows how many arrived trainees have been assigned to dorms through Processing modals.
(function () {
  'use strict';

  const SUMMARY_ID = 'processing-loaded-arrived-summary';
  const MAX_INSTALL_ATTEMPTS = 24;
  let installAttempts = 0;
  let installTimer = null;
  let hooksRegistered = false;

  function n(value) {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function records() {
    try { return Array.isArray(allData) ? allData : []; } catch (_) { return []; }
  }

  function activeWg() {
    try { return typeof getActiveWG === 'function' ? getActiveWG() : ''; } catch (_) { return ''; }
  }

  function recordsByType(type, weekGroup) {
    return records().filter(record => record && record.type === type && (!weekGroup || record.week_group === weekGroup));
  }

  function getDorms(providedDorms) {
    if (Array.isArray(providedDorms)) return providedDorms;
    return recordsByType('dorm', activeWg());
  }

  function getArrivedBuses() {
    return recordsByType('bus', activeWg()).filter(bus => bus.status === 'arrived');
  }

  function calculateCounts(providedDorms) {
    const dorms = getDorms(providedDorms);
    const arrivedBuses = getArrivedBuses();
    const loaded = dorms.reduce((sum, dorm) => sum + n(dorm.current_load), 0);
    const arrived = arrivedBuses.reduce((sum, bus) => sum + n(bus.otw_count), 0);
    const remaining = Math.max(arrived - loaded, 0);
    return { arrived, loaded, remaining };
  }

  function ensureSummaryElement() {
    const page = document.getElementById('page-processing');
    if (!page) return null;

    let summary = document.getElementById(SUMMARY_ID);
    if (summary) return summary;

    summary = document.createElement('div');
    summary.id = SUMMARY_ID;
    summary.className = 'px-4 pb-3 flex-shrink-0';
    summary.dataset.owner = 'gate-processing-loaded-summary';
    summary.innerHTML = `
      <div class="surface border rounded-lg p-4 grid gap-3 md:grid-cols-3" style="border-color:var(--border);">
        <div>
          <div class="text-xs uppercase tracking-wider font-bold text-muted">Arrived</div>
          <div id="processing-arrived-count" class="text-2xl font-black font-tabular">0</div>
        </div>
        <div>
          <div class="text-xs uppercase tracking-wider font-bold text-muted">Loaded</div>
          <div id="processing-loaded-count" class="text-2xl font-black font-tabular">0 / 0</div>
        </div>
        <div>
          <div class="text-xs uppercase tracking-wider font-bold text-muted">Awaiting Dorm Assignment</div>
          <div id="processing-remaining-count" class="text-2xl font-black font-tabular">0</div>
        </div>
        <div class="md:col-span-3 text-xs text-muted">
          Compares bus-arrived trainees against trainees assigned to dorms through Processing page dorm load modals.
        </div>
      </div>
    `;

    const header = page.querySelector('.px-4.py-3.flex-shrink-0');
    if (header && header.nextSibling) page.insertBefore(summary, header.nextSibling);
    else if (header) page.appendChild(summary);
    else page.prepend(summary);

    return summary;
  }

  function renderSummary(providedDorms) {
    const summary = ensureSummaryElement();
    if (!summary) return;

    const { arrived, loaded, remaining } = calculateCounts(providedDorms);
    const arrivedEl = document.getElementById('processing-arrived-count');
    const loadedEl = document.getElementById('processing-loaded-count');
    const remainingEl = document.getElementById('processing-remaining-count');

    if (arrivedEl) arrivedEl.textContent = arrived;
    if (loadedEl) loadedEl.textContent = `${loaded} / ${arrived}`;
    if (remainingEl) remainingEl.textContent = remaining;
  }

  function installRenderHook() {
    if (typeof renderProcessingPage !== 'function' || renderProcessingPage.__loadedArrivedSummaryHooked) return false;

    const originalRenderProcessingPage = renderProcessingPage;
    const patchedRenderProcessingPage = function patchedRenderProcessingPage(dorms) {
      originalRenderProcessingPage.apply(this, arguments);
      renderSummary(dorms);
    };

    patchedRenderProcessingPage.__loadedArrivedSummaryHooked = true;
    window.renderProcessingPage = patchedRenderProcessingPage;
    try { renderProcessingPage = patchedRenderProcessingPage; } catch (_) {}
    renderSummary();
    return true;
  }

  function clearInstallTimer() {
    if (!installTimer) return;
    clearInterval(installTimer);
    installTimer = null;
  }

  function attemptInstall() {
    installAttempts += 1;
    if (installRenderHook() || installAttempts >= MAX_INSTALL_ATTEMPTS) clearInstallTimer();
    renderSummary();
  }

  function registerHooksOnce() {
    if (hooksRegistered || typeof window.registerGateHook !== 'function') return;
    window.registerGateHook('afterRenderAll', () => renderSummary());
    window.registerGateHook('afterDataChanged', () => renderSummary());
    window.registerGateHook('afterPageChange', () => renderSummary());
    window.registerGateHook('afterModalOpen', () => renderSummary());
    hooksRegistered = true;
  }

  function startProcessingLoadedSummary() {
    attemptInstall();
    registerHooksOnce();
    if (!installTimer && installAttempts < MAX_INSTALL_ATTEMPTS && typeof renderProcessingPage !== 'function') {
      installTimer = setInterval(attemptInstall, 250);
    }

    window.GateProcessingLoadedSummary = Object.freeze({
      isPassiveCompatibilityLayer: true,
      render: renderSummary,
      install: installRenderHook
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startProcessingLoadedSummary, { once: true });
  } else {
    startProcessingLoadedSummary();
  }

  window.addEventListener('load', startProcessingLoadedSummary, { once: true });
})();
