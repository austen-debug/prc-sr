// PRC DASH SAT arrivals board
(function () {
  const AUTO_REFRESH_MS = 20 * 60 * 1000;
  let refreshTimer = null;
  let isLoading = false;

  function escapeHtmlLocal(value) {
    if (typeof escapeHtml === 'function') return escapeHtml(value);
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function statusClass(status) {
    const normalized = String(status || '').toLowerCase();
    if (normalized.includes('cancel')) return 'sat-status sat-status-canceled';
    if (normalized.includes('delay')) return 'sat-status sat-status-delayed';
    if (normalized.includes('arrived') || normalized.includes('landed') || normalized.includes('on time')) return 'sat-status sat-status-good';
    if (normalized.includes('en route') || normalized.includes('active')) return 'sat-status sat-status-blue';
    return 'sat-status sat-status-muted';
  }

  function nowCentralParts() {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    const parts = formatter.formatToParts(new Date());
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return {
      weekday: values.weekday,
      hour: Number(values.hour),
      minute: Number(values.minute)
    };
  }

  function isAutoRefreshWindow() {
    const { weekday, hour } = nowCentralParts();

    if (weekday === 'Tue' && hour >= 16) return true;
    if (weekday === 'Wed' && hour < 6) return true;
    if (weekday === 'Wed' && hour >= 16) return true;
    if (weekday === 'Thu' && hour < 3) return true;

    return false;
  }

  function autoRefreshLabel() {
    return isAutoRefreshWindow()
      ? 'Auto refresh active: every 20 minutes'
      : 'Manual refresh only outside Tuesday/Wednesday arrival windows';
  }

  function ensureSatArrivalsBoard() {
    const airportPage = document.getElementById('page-airport');
    if (!airportPage) return null;

    let board = document.getElementById('sat-arrivals-board');
    if (board) return board;

    board = document.createElement('div');
    board.id = 'sat-arrivals-board';
    board.className = 'sat-arrivals-board surface border rounded-lg p-4 mt-4 mx-4 mb-4';
    board.style.borderColor = 'var(--border)';
    board.innerHTML = `
      <div class="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div>
          <div class="text-xs uppercase tracking-wider font-black text-muted">San Antonio Arrivals</div>
          <div class="text-lg font-black">SAT Arrivals — Next 24 Hours</div>
          <div id="sat-arrivals-window" class="text-xs font-bold text-muted mt-1">Window: now through next 24 hours</div>
          <div id="sat-arrivals-mode" class="text-xs font-bold text-muted mt-1">${autoRefreshLabel()}</div>
        </div>
        <div class="flex items-center gap-2">
          <div id="sat-arrivals-updated" class="text-xs font-bold text-muted">Last updated: —</div>
          <button id="sat-arrivals-refresh" type="button" class="px-3 py-2 rounded font-bold text-white text-xs" style="background:var(--blue);">Refresh</button>
        </div>
      </div>
      <div id="sat-arrivals-message" class="text-sm text-muted py-3">SAT arrivals are available by manual refresh.</div>
      <div class="overflow-auto hidden" id="sat-arrivals-table-wrap">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b" style="border-color:var(--border);">
              <th class="px-3 py-2 text-left">Flight</th>
              <th class="px-3 py-2 text-left">Origin</th>
              <th class="px-3 py-2 text-left">Scheduled</th>
              <th class="px-3 py-2 text-left">Estimated</th>
              <th class="px-3 py-2 text-left">Gate</th>
              <th class="px-3 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody id="sat-arrivals-body"></tbody>
        </table>
      </div>
    `;

    airportPage.appendChild(board);

    const refreshButton = document.getElementById('sat-arrivals-refresh');
    if (refreshButton) refreshButton.addEventListener('click', () => loadSatArrivals(true));

    return board;
  }

  function updateModeText() {
    const mode = document.getElementById('sat-arrivals-mode');
    if (mode) mode.textContent = autoRefreshLabel();
  }

  function renderArrivals(payload) {
    const message = document.getElementById('sat-arrivals-message');
    const wrapper = document.getElementById('sat-arrivals-table-wrap');
    const body = document.getElementById('sat-arrivals-body');
    const updated = document.getElementById('sat-arrivals-updated');
    const windowLabel = document.getElementById('sat-arrivals-window');

    if (!message || !wrapper || !body || !updated) return;

    const arrivals = payload.arrivals || [];
    const sourceMode = payload.fromCache ? 'cached' : 'fresh';

    updated.textContent = `Last updated: ${new Date(payload.lastUpdated || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (${sourceMode})`;

    if (windowLabel) {
      windowLabel.textContent = payload.windowLabel ? `Window: ${payload.windowLabel}` : 'Window: now through next 24 hours';
    }

    if (arrivals.length === 0) {
      wrapper.classList.add('hidden');
      message.classList.remove('hidden');
      message.textContent = 'No SAT arrivals are scheduled in the next 24 hours.';
      return;
    }

    body.innerHTML = arrivals.map(arrival => `
      <tr class="border-b" style="border-color:var(--border);">
        <td class="px-3 py-2 font-black">${escapeHtmlLocal(arrival.flight || '—')}</td>
        <td class="px-3 py-2">${escapeHtmlLocal(arrival.origin || '—')}</td>
        <td class="px-3 py-2 font-tabular">${escapeHtmlLocal(arrival.scheduled || '—')}</td>
        <td class="px-3 py-2 font-tabular">${escapeHtmlLocal(arrival.estimated || '—')}</td>
        <td class="px-3 py-2">${escapeHtmlLocal([arrival.terminal, arrival.gate].filter(Boolean).join(' / ') || arrival.gate || '—')}</td>
        <td class="px-3 py-2"><span class="${statusClass(arrival.status)}">${escapeHtmlLocal(arrival.status || 'UNKNOWN')}</span></td>
      </tr>
    `).join('');

    message.classList.add('hidden');
    wrapper.classList.remove('hidden');
  }

  async function loadSatArrivals(manual = false) {
    if (isLoading) return;

    ensureSatArrivalsBoard();
    updateModeText();

    const message = document.getElementById('sat-arrivals-message');
    const refreshButton = document.getElementById('sat-arrivals-refresh');

    isLoading = true;

    if (refreshButton) {
      refreshButton.disabled = true;
      refreshButton.textContent = 'Refreshing...';
    }

    if (message) {
      message.classList.remove('hidden');
      message.textContent = manual ? 'Refreshing SAT arrivals for the next 24 hours...' : 'Loading SAT arrivals for the next 24 hours...';
    }

    try {
      const response = await fetch('/api/sat-arrivals', {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });

      const payload = await response.json();

      if (!response.ok || !payload.isOk) throw new Error(payload.error || 'Unable to retrieve SAT arrivals.');

      renderArrivals(payload);
    } catch (error) {
      const wrapper = document.getElementById('sat-arrivals-table-wrap');
      if (wrapper) wrapper.classList.add('hidden');
      if (message) {
        message.classList.remove('hidden');
        message.textContent = error.message || 'Unable to retrieve SAT arrivals.';
      }
    } finally {
      isLoading = false;
      if (refreshButton) {
        refreshButton.disabled = false;
        refreshButton.textContent = 'Refresh';
      }
    }
  }

  function maybeAutoLoadSatArrivals() {
    ensureSatArrivalsBoard();
    updateModeText();

    if (isAutoRefreshWindow()) {
      loadSatArrivals(false);
      return;
    }

    const message = document.getElementById('sat-arrivals-message');
    const tableWrap = document.getElementById('sat-arrivals-table-wrap');
    if (message && tableWrap && !tableWrap.classList.contains('hidden')) return;
    if (message) message.textContent = 'Outside auto-refresh window. Use Refresh to load SAT arrivals for the next 24 hours.';
  }

  function startSatArrivalsBoard() {
    ensureSatArrivalsBoard();
    maybeAutoLoadSatArrivals();

    if (!refreshTimer) refreshTimer = setInterval(maybeAutoLoadSatArrivals, AUTO_REFRESH_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startSatArrivalsBoard);
  } else {
    startSatArrivalsBoard();
  }
})();

// PRC DASH Status Board header split
(function () {
  let headerPatched = false;
  let observersCreated = false;

  function ensureHeaderStylesheet() {
    if (document.querySelector('link[href="/css/prc-dash-board-header.css"]')) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/css/prc-dash-board-header.css';
    document.head.appendChild(link);
  }

  function buildMetric(kind, label, id, fallback) {
    const card = document.createElement('div');
    card.className = 'metric-block prc-metric-card-v3';
    card.dataset.kind = kind;
    card.innerHTML = `
      <div class="prc-metric-label-v3">${label}</div>
      <div id="${id}" class="prc-metric-value-v3 font-tabular">${fallback}</div>
    `;
    return card;
  }

  function parseArrivedExpected(text) {
    const value = String(text || '');
    const arrivedMatch = value.match(/ARRIVED:\s*(\d+)/i);
    const expectedMatch = value.match(/EXPECTED:\s*(\d+)/i);
    const slashMatch = value.match(/(\d+)\s*\/\s*(\d+)/);
    const numbers = value.match(/\d+/g) || [];

    return {
      arrived: arrivedMatch?.[1] || slashMatch?.[1] || numbers[0] || '0',
      expected: expectedMatch?.[1] || slashMatch?.[2] || numbers[1] || '0'
    };
  }

  function parseLastLocal(text) {
    const value = String(text || '');
    const lastMatch = value.match(/LAST:\s*([^|]+)/i);
    const localMatch = value.match(/LOCAL:\s*([^|]+)/i);
    const timeMatches = value.match(/\b\d{1,2}:\d{2}\b/g) || [];

    return {
      last: (lastMatch?.[1] || timeMatches[0] || '—').trim(),
      local: (localMatch?.[1] || timeMatches[1] || '—').trim()
    };
  }

  function syncHeaderValues() {
    const metricArrived = document.getElementById('metric-arrived');
    const metricAirport = document.getElementById('metric-airport');

    const arrivedEl = document.getElementById('metric-arrived-v3');
    const expectedEl = document.getElementById('metric-expected-v3');
    const lastEl = document.getElementById('metric-last-v3');
    const localEl = document.getElementById('metric-local-v3');

    if (metricArrived && arrivedEl && expectedEl) {
      const values = parseArrivedExpected(metricArrived.textContent);
      arrivedEl.textContent = values.arrived;
      expectedEl.textContent = values.expected;
    }

    if (metricAirport && lastEl && localEl) {
      const values = parseLastLocal(metricAirport.textContent);
      lastEl.textContent = values.last;
      localEl.textContent = values.local;
    }
  }

  function createObservers() {
    if (observersCreated) return;

    const metricArrived = document.getElementById('metric-arrived');
    const metricAirport = document.getElementById('metric-airport');
    const config = { childList: true, characterData: true, subtree: true };

    if (metricArrived) new MutationObserver(syncHeaderValues).observe(metricArrived, config);
    if (metricAirport) new MutationObserver(syncHeaderValues).observe(metricAirport, config);

    observersCreated = true;
  }

  function patchStatusBoardHeader() {
    ensureHeaderStylesheet();

    const header = document.querySelector('#page-board .board-header');
    const metricArrived = document.getElementById('metric-arrived');
    const metricAirport = document.getElementById('metric-airport');
    const activeBuses = document.getElementById('active-buses');

    if (!header || !metricArrived || !metricAirport || !activeBuses) {
      syncHeaderValues();
      return;
    }

    if (!headerPatched && !header.classList.contains('prc-header-v3')) {
      const arrivedBlock = metricArrived.closest('.metric-block');
      const airportBlock = metricAirport.closest('.metric-block');
      const activeBusBlock = activeBuses.closest('.metric-block');

      const legacy = document.createElement('div');
      legacy.className = 'prc-header-legacy-v3';
      legacy.setAttribute('aria-hidden', 'true');

      if (arrivedBlock) legacy.appendChild(arrivedBlock);
      if (airportBlock) legacy.appendChild(airportBlock);

      const metricGrid = document.createElement('div');
      metricGrid.className = 'prc-metric-grid-v3';
      metricGrid.appendChild(buildMetric('arrived', 'Arrived', 'metric-arrived-v3', '0'));
      metricGrid.appendChild(buildMetric('last', 'Last', 'metric-last-v3', '—'));
      metricGrid.appendChild(buildMetric('expected', 'Expected', 'metric-expected-v3', '0'));
      metricGrid.appendChild(buildMetric('local', 'Local', 'metric-local-v3', '—'));

      header.innerHTML = '';
      header.classList.add('prc-header-v3');
      header.appendChild(metricGrid);

      if (activeBusBlock) {
        activeBusBlock.classList.add('prc-active-buses-v3');
        header.appendChild(activeBusBlock);
      }

      header.appendChild(legacy);
      headerPatched = true;
      createObservers();
    }

    syncHeaderValues();
  }

  function startHeaderPatch() {
    patchStatusBoardHeader();
    setInterval(patchStatusBoardHeader, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startHeaderPatch);
  } else {
    startHeaderPatch();
  }
})();

// PRC DASH active bus card formatter
(function () {
  let observerReady = false;
  let scheduled = false;

  function ensureActiveBusCardStyles() {
    if (document.getElementById('prc-active-bus-card-styles')) return;

    const style = document.createElement('style');
    style.id = 'prc-active-bus-card-styles';
    style.textContent = `
      .prc-active-buses-v3 #active-buses {
        display: flex !important;
        flex-wrap: wrap !important;
        gap: 0.72rem !important;
        align-items: stretch !important;
        align-content: flex-start !important;
      }

      .prc-active-buses-v3 #active-buses .bus-badge.prc-bus-card {
        width: 142px !important;
        min-width: 142px !important;
        min-height: 118px !important;
        padding: 0.78rem 0.82rem !important;
        border-radius: 1.05rem !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: flex-start !important;
        justify-content: center !important;
        gap: 0.26rem !important;
        text-align: left !important;
        white-space: normal !important;
        line-height: 1.02 !important;
        background:
          linear-gradient(145deg, rgba(56, 189, 248, 0.22), rgba(37, 99, 235, 0.12)),
          rgba(15, 23, 42, 0.36) !important;
        border-color: rgba(56, 189, 248, 0.48) !important;
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,0.16),
          0 8px 20px rgba(0,0,0,0.20),
          0 0 18px rgba(56,189,248,0.16) !important;
      }

      .prc-active-buses-v3 #active-buses .bus-badge.prc-bus-card:hover {
        transform: translateY(-1px) !important;
        border-color: rgba(125, 211, 252, 0.72) !important;
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,0.20),
          0 11px 24px rgba(0,0,0,0.24),
          0 0 24px rgba(56,189,248,0.28) !important;
      }

      .prc-bus-card-title {
        color: var(--text);
        font-size: 0.82rem;
        font-weight: 950;
        letter-spacing: 0.07em;
        text-transform: uppercase;
      }

      .prc-bus-card-line {
        color: var(--text-soft, var(--text-muted));
        font-size: 0.72rem;
        font-weight: 900;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }

      .theme-light .prc-active-buses-v3 #active-buses .bus-badge.prc-bus-card {
        background:
          linear-gradient(145deg, rgba(2, 132, 199, 0.13), rgba(255,255,255,0.76)),
          rgba(255,255,255,0.64) !important;
        border-color: rgba(2, 132, 199, 0.34) !important;
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,0.84),
          0 7px 16px rgba(15,23,42,0.08) !important;
      }

      .theme-light .prc-bus-card-title { color: #0f172a; }
      .theme-light .prc-bus-card-line { color: #334155; }

      @media (max-width: 640px) {
        .prc-active-buses-v3 #active-buses .bus-badge.prc-bus-card {
          width: 132px !important;
          min-width: 132px !important;
          min-height: 104px !important;
          padding: 0.66rem 0.7rem !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function escapeCardHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function findBusForButton(button) {
    if (typeof allData === 'undefined') return null;

    const onclick = button.getAttribute('onclick') || '';
    const idMatch = onclick.match(/confirmBusArrival\('([^']+)'\)/);
    const id = idMatch ? idMatch[1] : '';
    if (!id) return null;

    return allData.find(record => record.__backendId === id) || null;
  }

  function cardTitle(bus) {
    if (bus.bus_type === 'local') {
      return `LOCAL – ${String(bus.destination || bus.originating_destination || 'LOCAL').trim()}`;
    }

    return `BUS #${String(bus.bus_id || '').trim()}`;
  }

  function formatActiveBusCards() {
    ensureActiveBusCardStyles();

    const activeBusContainer = document.getElementById('active-buses');
    if (!activeBusContainer) return;

    activeBusContainer.querySelectorAll('.bus-badge').forEach(button => {
      const bus = findBusForButton(button);
      if (!bus) return;

      const title = cardTitle(bus);
      const otw = Number(bus.otw_count || 0);
      const females = Number(bus.female_count || 0);
      const nats = Number(bus.nat_count || 0);
      const signature = `${title}|${otw}|${females}|${nats}`;

      if (button.dataset.prcBusCardSig === signature && button.querySelector('.prc-bus-card-title')) return;

      button.classList.add('prc-bus-card');
      button.dataset.prcBusCardSig = signature;
      button.title = `Confirm arrival: ${title} – ${otw} OTW | ${females} FEMALE | ${nats} NAT`;
      button.setAttribute('aria-label', button.title);
      button.innerHTML = `
        <span class="prc-bus-card-title">${escapeCardHtml(title)}</span>
        <span class="prc-bus-card-line">${otw} OTW</span>
        <span class="prc-bus-card-line">${females} FEMALE</span>
        <span class="prc-bus-card-line">${nats} NAT</span>
      `;
    });
  }

  function scheduleFormat() {
    if (scheduled) return;
    scheduled = true;

    requestAnimationFrame(() => {
      scheduled = false;
      formatActiveBusCards();
    });
  }

  function createObserver() {
    if (observerReady) return;

    const activeBusContainer = document.getElementById('active-buses');
    if (!activeBusContainer) return;

    const observer = new MutationObserver(scheduleFormat);
    observer.observe(activeBusContainer, { childList: true, subtree: true, characterData: true });

    observerReady = true;
  }

  function startActiveBusCards() {
    ensureActiveBusCardStyles();
    formatActiveBusCards();
    createObserver();

    setInterval(() => {
      formatActiveBusCards();
      createObserver();
    }, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startActiveBusCards);
  } else {
    startActiveBusCards();
  }
})();
