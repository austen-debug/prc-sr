// PRC DASH Status Board four-card header
(function () {
  let headerReady = false;

  function getLocalTime24() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }

  function getNumberPair(text) {
    const values = String(text || '').match(/\d+/g) || [];
    return {
      first: values[0] || '0',
      second: values[1] || '0'
    };
  }

  function getLastAirportValue(text) {
    const raw = String(text || '');
    const match = raw.match(/LAST:\s*([^|]+)/i);
    return match ? match[1].trim() : (raw.trim() || '—');
  }

  function metricCard(kind, label, id, value) {
    const card = document.createElement('div');
    card.className = 'metric-block prc-metric-card-v3';
    card.dataset.kind = kind;
    card.innerHTML = `
      <div class="prc-metric-label-v3">${label}</div>
      <div id="${id}" class="prc-metric-value-v3 font-tabular">${value}</div>
    `;
    return card;
  }

  function syncHeaderValues() {
    const metricArrived = document.getElementById('metric-arrived');
    const metricAirport = document.getElementById('metric-airport');

    const arrived = document.getElementById('prc-metric-arrived-v3');
    const expected = document.getElementById('prc-metric-expected-v3');
    const last = document.getElementById('prc-metric-last-v3');
    const local = document.getElementById('prc-metric-local-v3');

    if (metricArrived && arrived && expected) {
      const pair = getNumberPair(metricArrived.textContent);
      arrived.textContent = pair.first;
      expected.textContent = pair.second;
    }

    if (metricAirport && last) {
      last.textContent = getLastAirportValue(metricAirport.textContent);
    }

    if (local) {
      local.textContent = getLocalTime24();
    }
  }

  function buildHeader() {
    const header = document.querySelector('#page-board .board-header');
    const metricArrived = document.getElementById('metric-arrived');
    const metricAirport = document.getElementById('metric-airport');
    const activeBuses = document.getElementById('active-buses');

    if (!header || !metricArrived || !metricAirport || !activeBuses) {
      return;
    }

    if (header.classList.contains('prc-header-v3')) {
      headerReady = true;
      syncHeaderValues();
      return;
    }

    const arrivedBlock = metricArrived.closest('.metric-block');
    const airportBlock = metricAirport.closest('.metric-block');
    const activeBusBlock = activeBuses.closest('.metric-block');

    if (!arrivedBlock || !airportBlock || !activeBusBlock) {
      return;
    }

    const legacy = document.createElement('div');
    legacy.className = 'prc-header-legacy-v3';
    legacy.setAttribute('aria-hidden', 'true');
    legacy.appendChild(arrivedBlock);
    legacy.appendChild(airportBlock);

    const metricGrid = document.createElement('div');
    metricGrid.className = 'prc-metric-grid-v3';
    metricGrid.appendChild(metricCard('arrived', 'Arrived', 'prc-metric-arrived-v3', '0'));
    metricGrid.appendChild(metricCard('last', 'Last', 'prc-metric-last-v3', '—'));
    metricGrid.appendChild(metricCard('expected', 'Expected', 'prc-metric-expected-v3', '0'));
    metricGrid.appendChild(metricCard('local', 'Local', 'prc-metric-local-v3', getLocalTime24()));

    activeBusBlock.classList.add('prc-active-buses-v3');

    header.innerHTML = '';
    header.classList.add('prc-header-v3');
    header.appendChild(metricGrid);
    header.appendChild(activeBusBlock);
    header.appendChild(legacy);

    headerReady = true;
    syncHeaderValues();
  }

  function start() {
    buildHeader();
    setInterval(() => {
      buildHeader();
      if (headerReady) syncHeaderValues();
    }, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
