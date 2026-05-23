// PRC DASH Status Board Header Cleanup
(function () {
  function buildMetricCard(kind, label, id, fallback) {
    const card = document.createElement('div');
    card.className = `metric-block prc-header-card prc-header-card--${kind}`;
    card.innerHTML = `
      <div class="prc-header-label">${label}</div>
      <div id="${id}" class="prc-header-value font-tabular">${fallback}</div>
    `;
    return card;
  }

  function parseArrivedExpected(text) {
    const numbers = String(text || '').match(/\d+/g) || [];
    return {
      arrived: numbers[0] || '0',
      expected: numbers[1] || '0'
    };
  }

  function parseLastLocal(text) {
    const raw = String(text || '');
    const lastMatch = raw.match(/LAST:\s*([^|]+)/i);
    const localMatch = raw.match(/LOCAL:\s*([^|]+)/i);

    return {
      last: lastMatch ? lastMatch[1].trim() : '—',
      local: localMatch ? localMatch[1].trim() : '—'
    };
  }

  function syncHeaderValues() {
    const oldArrived = document.getElementById('metric-arrived');
    const oldAirport = document.getElementById('metric-airport');

    const arrivedValue = document.getElementById('metric-arrived-split');
    const expectedValue = document.getElementById('metric-expected-split');
    const lastValue = document.getElementById('metric-last-split');
    const localValue = document.getElementById('metric-local-split');

    if (oldArrived && arrivedValue && expectedValue) {
      const parsed = parseArrivedExpected(oldArrived.textContent);
      arrivedValue.textContent = parsed.arrived;
      expectedValue.textContent = parsed.expected;
    }

    if (oldAirport && lastValue && localValue) {
      const parsed = parseLastLocal(oldAirport.textContent);
      lastValue.textContent = parsed.last;
      localValue.textContent = parsed.local;
    }
  }

  function restructureStatusHeader() {
    const header = document.querySelector('#page-board .board-header');
    const oldArrived = document.getElementById('metric-arrived');
    const oldAirport = document.getElementById('metric-airport');
    const activeBuses = document.getElementById('active-buses');

    if (!header || !oldArrived || !oldAirport || !activeBuses || header.classList.contains('prc-dash-header-v2')) {
      syncHeaderValues();
      return;
    }

    const activeBusBlock = activeBuses.closest('.metric-block');

    const legacy = document.createElement('div');
    legacy.id = 'prc-legacy-metrics';
    legacy.setAttribute('aria-hidden', 'true');

    const oldArrivedBlock = oldArrived.closest('.metric-block');
    const oldAirportBlock = oldAirport.closest('.metric-block');

    if (oldArrivedBlock) legacy.appendChild(oldArrivedBlock);
    if (oldAirportBlock) legacy.appendChild(oldAirportBlock);

    header.innerHTML = '';
    header.classList.add('prc-dash-header-v2');

    header.appendChild(buildMetricCard('arrived', 'Arrived', 'metric-arrived-split', '0'));
    header.appendChild(buildMetricCard('expected', 'Expected', 'metric-expected-split', '0'));
    header.appendChild(buildMetricCard('last', 'Last Arrival', 'metric-last-split', '—'));
    header.appendChild(buildMetricCard('local', 'Local Time', 'metric-local-split', '—'));

    if (activeBusBlock) {
      activeBusBlock.classList.add('prc-header-card', 'prc-header-card--buses');
      header.appendChild(activeBusBlock);
    }

    header.appendChild(legacy);
    syncHeaderValues();

    const observerConfig = { childList: true, characterData: true, subtree: true };
    new MutationObserver(syncHeaderValues).observe(oldArrived, observerConfig);
    new MutationObserver(syncHeaderValues).observe(oldAirport, observerConfig);
  }

  window.addEventListener('DOMContentLoaded', restructureStatusHeader);
  window.addEventListener('load', restructureStatusHeader);
  window.addEventListener('prcDashDataRendered', syncHeaderValues);

  setInterval(() => {
    restructureStatusHeader();
    syncHeaderValues();
  }, 1000);
})();
