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

    // Tuesday 1600 through Wednesday 0600 local.
    if (weekday === 'Tue' && hour >= 16) return true;
    if (weekday === 'Wed' && hour < 6) return true;

    // Wednesday 1600 through Thursday 0300 local.
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
          <div class="text-lg font-black">SAT Arrivals — Today</div>
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
    if (refreshButton) {
      refreshButton.addEventListener('click', () => loadSatArrivals(true));
    }

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

    if (!message || !wrapper || !body || !updated) return;

    const arrivals = payload.arrivals || [];
    const sourceMode = payload.fromCache ? 'cached' : 'fresh';

    updated.textContent = `Last updated: ${new Date(payload.lastUpdated || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (${sourceMode})`;

    if (arrivals.length === 0) {
      wrapper.classList.add('hidden');
      message.classList.remove('hidden');
      message.textContent = 'No SAT arrivals returned by AirLabs for the current schedule window.';
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
      message.textContent = manual ? 'Refreshing SAT arrivals...' : 'Loading SAT arrivals...';
    }

    try {
      const response = await fetch('/api/sat-arrivals', {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });

      const payload = await response.json();

      if (!response.ok || !payload.isOk) {
        throw new Error(payload.error || 'Unable to retrieve SAT arrivals.');
      }

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
    if (message && !document.getElementById('sat-arrivals-table-wrap')?.classList.contains('hidden')) return;
    if (message) message.textContent = 'Outside auto-refresh window. Use Refresh to load SAT arrivals manually.';
  }

  function startSatArrivalsBoard() {
    ensureSatArrivalsBoard();
    maybeAutoLoadSatArrivals();

    if (!refreshTimer) {
      refreshTimer = setInterval(maybeAutoLoadSatArrivals, AUTO_REFRESH_MS);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startSatArrivalsBoard);
  } else {
    startSatArrivalsBoard();
  }
})();
