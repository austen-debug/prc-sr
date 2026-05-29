// PRC DASH final UI/functionality safety patch
// Loaded last. Keeps display-only patches from competing and prevents stale fullscreen state from hiding navigation.
(function () {
  let styleReady = false;

  function n(value) {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function escapeText(value) {
    if (typeof escapeHtml === 'function') return escapeHtml(value);
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function formatTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  function ensureFinalStyles() {
    if (styleReady || document.getElementById('prc-final-audit-styles')) return;

    const style = document.createElement('style');
    style.id = 'prc-final-audit-styles';
    style.textContent = `
      .app-nav { display: flex; }
      .fullscreen-board .app-nav { display: none !important; }

      .prc-active-buses-v3 #active-buses {
        display: flex !important;
        flex-wrap: wrap !important;
        gap: 0.72rem !important;
        align-items: stretch !important;
        align-content: flex-start !important;
      }

      .prc-active-buses-v3 #active-buses .bus-badge.prc-bus-card,
      #page-board #active-buses .bus-badge.prc-bus-card {
        width: 148px !important;
        min-width: 148px !important;
        min-height: 146px !important;
        padding: 0.76rem 0.84rem !important;
        border-radius: 1.05rem !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: flex-start !important;
        justify-content: center !important;
        gap: 0.2rem !important;
        text-align: left !important;
        white-space: normal !important;
        line-height: 1.04 !important;
      }

      #page-board #active-buses .prc-bus-card-title {
        display: block !important;
        font-size: 1.08rem !important;
        font-weight: 950 !important;
        letter-spacing: 0.045em !important;
        line-height: 1 !important;
        color: var(--text) !important;
        text-transform: uppercase;
      }

      #page-board #active-buses .prc-bus-card-line {
        display: block !important;
        font-size: 0.84rem !important;
        font-weight: 900 !important;
        letter-spacing: 0.035em !important;
        line-height: 1.08 !important;
        color: var(--text-soft, var(--text-muted)) !important;
        text-transform: uppercase;
      }

      #page-board #active-buses .prc-bus-card-dept {
        display: block !important;
        width: 100% !important;
        margin-top: 0.28rem !important;
        padding-top: 0.28rem !important;
        border-top: 1px solid rgba(255,255,255,0.18) !important;
        font-size: 0.72rem !important;
        font-weight: 950 !important;
        letter-spacing: 0.065em !important;
        color: var(--text-muted) !important;
        text-transform: uppercase;
      }

      .theme-light #page-board #active-buses .prc-bus-card-title { color: #0f172a !important; }
      .theme-light #page-board #active-buses .prc-bus-card-line { color: #334155 !important; }
      .theme-light #page-board #active-buses .prc-bus-card-dept { border-top-color: rgba(100,116,139,0.24) !important; }

      @media (max-width: 768px) {
        .prc-active-buses-v3 #active-buses .bus-badge.prc-bus-card,
        #page-board #active-buses .bus-badge.prc-bus-card {
          width: 136px !important;
          min-width: 136px !important;
          min-height: 136px !important;
          padding: 0.66rem 0.72rem !important;
        }
      }
    `;

    document.head.appendChild(style);
    styleReady = true;
  }

  function getBusFromButton(button) {
    try {
      if (typeof allData === 'undefined' || !Array.isArray(allData)) return null;
      const onclick = button.getAttribute('onclick') || '';
      const match = onclick.match(/confirmBusArrival\('([^']+)'\)/);
      const id = match ? match[1] : '';
      if (!id) return null;
      return allData.find(record => record && record.__backendId === id && record.type === 'bus') || null;
    } catch (error) {
      return null;
    }
  }

  function busTitle(bus) {
    if (bus.bus_type === 'local') {
      return `LOCAL – ${String(bus.destination || bus.originating_destination || 'LOCAL').trim()}`;
    }
    return `BUS #${String(bus.bus_id || '').trim()}`;
  }

  function normalizeActiveBusCards() {
    ensureFinalStyles();

    const container = document.getElementById('active-buses');
    if (!container) return;

    container.querySelectorAll('.bus-badge').forEach(button => {
      const bus = getBusFromButton(button);
      if (!bus) return;

      const title = busTitle(bus);
      const otw = n(bus.otw_count);
      const females = n(bus.female_count);
      const nat = n(bus.nat_count);
      const sf = n(bus.space_force_count);
      const departed = formatTime(bus.departed_at || bus.created_at);

      // Match the older formatter's signature so it treats this final display as current
      // and does not overwrite the Space Force/departure lines on the next pass.
      const legacySignature = `${title}|${otw}|${females}|${nat}`;
      const fullSignature = `${legacySignature}|${sf}|${departed}`;

      if (button.dataset.prcFinalBusSig === fullSignature && button.querySelector('.prc-bus-card-dept')) return;

      button.classList.add('prc-bus-card');
      button.dataset.prcBusCardSig = legacySignature;
      button.dataset.prcFinalBusSig = fullSignature;
      button.title = `Confirm arrival: ${title} – ${otw} OTW | ${females} FEMALE | ${nat} NAT | ${sf} SPACE FORCE | DEPT ${departed}`;
      button.setAttribute('aria-label', button.title);
      button.innerHTML = `
        <span class="prc-bus-card-title">${escapeText(title)}</span>
        <span class="prc-bus-card-line">${otw} OTW</span>
        <span class="prc-bus-card-line">${females} FEMALE</span>
        <span class="prc-bus-card-line">${nat} NAT</span>
        <span class="prc-bus-card-line">${sf} SPACE FORCE</span>
        <span class="prc-bus-card-dept">DEPT: ${escapeText(departed)}</span>
      `;
    });
  }

  function keepNavigationRecoverable() {
    const nav = document.querySelector('.app-nav');
    if (!nav) return;

    // If the browser is not actually in fullscreen, the board shell should not keep
    // the app-nav hidden. This protects against stale fullscreen-board state after TV use.
    if (!document.fullscreenElement && document.body.classList.contains('fullscreen-board')) {
      document.body.classList.remove('fullscreen-board');
      const btn = document.getElementById('fullscreen-btn');
      if (btn) btn.textContent = 'FULL SCREEN';
    }
  }

  function runFinalAuditPass() {
    try { keepNavigationRecoverable(); } catch (error) { console.warn('PRC DASH nav recovery check failed:', error); }
    try { normalizeActiveBusCards(); } catch (error) { console.warn('PRC DASH final active bus card pass failed:', error); }
  }

  function startFinalAuditPatch() {
    runFinalAuditPass();
    setInterval(runFinalAuditPass, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startFinalAuditPatch);
  } else {
    startFinalAuditPatch();
  }
})();
