// GATE 3 declarative event boundary. Static HTML carries identifiers only; execution lives here.
(function installGateDeclarativeEventBoundary() {
  'use strict';

  const eventTypes = ['click', 'change', 'submit', 'keydown', 'keyup', 'input', 'blur', 'focus', 'contextmenu'];

  function decode(value) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = String(value || '');
    return textarea.value;
  }

  function execute(element, event, source) {
    const handler = new Function('event', 'element', `with (window) { return (function () { ${source} }).call(element); }`);
    return handler.call(element, event, element);
  }

  for (const eventType of eventTypes) {
    document.addEventListener(eventType, event => {
      const attribute = `data-gate-on${eventType}`;
      const element = event.target instanceof Element ? event.target.closest(`[${attribute}]`) : null;
      if (!element) return;

      if (eventType === 'submit') event.preventDefault();
      const result = execute(element, event, decode(element.getAttribute(attribute)));
      if (result === false) {
        event.preventDefault();
        event.stopPropagation();
      }
    });
  }
})();

let allData = [];
    let busCounter = 0;
    let timerInterval = null;
    let isDark = true;
    let currentRole = 'instructor'; // 'instructor' or 'airman'
    let currentUsername = '';
    let modalDormId = null;
    let editDormId = null;
    let editArchiveId = null;
    let editBusId = null;

const SOUND_FILES = {
  dorm_open: '/assets/sr_open_sound.mp3',
  dorm_closed: '/assets/sr_closed_sound.mp3',
  bus_dispatch: '/assets/sr_bus_sound.mp3',
  overtime: '/assets/sr_overtime_sound.mp3'
};

const SOUND_ENABLED_KEY = 'prc_sr_sound_enabled_v1';
const SOUND_PLAYED_KEY = 'prc_sr_played_sound_events_v1';

let soundEnabled = localStorage.getItem(SOUND_ENABLED_KEY) === 'true';
let soundEventBaseline = Date.now();
let overtimeSoundInProgress = new Set();

let playedSoundEventIds = new Set(
  JSON.parse(localStorage.getItem(SOUND_PLAYED_KEY) || '[]')
);

let soundPlayers = {};

    function escapeHtml(value) {
      return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
    }

    const PAGES_INSTRUCTOR = ['board','airport','input','processing','archives'];
    const PAGES_AIRMAN = ['board','processing'];
    const PAGE_LABELS = { board:'Status Board', airport:'Airport', input:'Input', processing:'Processing', archives:'Archives' };

    function toggleTheme() {
      isDark = !isDark;
      document.body.classList.toggle('theme-light', !isDark);
    }

    async function loadSession() {
  const response = await fetch('/api/session', {
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    },
    cache: 'no-store'
  });

  const result = await response.json();

  if (!result.isOk) {
    window.location.href = '/login/';
    return;
  }

  currentRole = result.role || 'airman';
  currentUsername = result.username || '';
}

async function logout() {
  await fetch('/api/logout', {
    method: 'POST',
    headers: {
      'Accept': 'application/json'
    }
  });

  window.location.href = '/login/';
}

    function buildNav() {
      const pages = currentRole === 'instructor' ? PAGES_INSTRUCTOR : PAGES_AIRMAN;
      const container = document.getElementById('nav-links');
      const activePage = document.querySelector('.page.active');
      const activeId = activePage ? activePage.id.replace('page-','') : 'board';
      container.innerHTML = pages.map(p => `<button class="nav-btn ${p===activeId?'active':''}" onclick="showPage('${p}')">${PAGE_LABELS[p]}</button>`).join('');
     document.getElementById('role-toggle').textContent =
       currentRole === 'instructor' ? 'INSTRUCTOR / LOGOUT' : 'AIRMAN / LOGOUT';
      updateRoleVisibility();
    }

    function updateRoleVisibility() {
  const closeoutBtn = document.getElementById('closeout-btn');
  if (closeoutBtn) {
    closeoutBtn.style.display = currentRole === 'instructor' ? '' : 'none';
  }

  const processingEditHint = document.getElementById('processing-edit-hint');
  if (processingEditHint) {
    processingEditHint.classList.toggle('hidden', currentRole !== 'instructor');
  }
}

    function showPage(id) {
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      const target = document.getElementById('page-' + id);
      if (target) target.classList.add('active');
      buildNav();
    }

    const handler = {
      onDataChanged(data) {
        allData = data;
        renderAll();
      }
    };

async function initApp() {
  await loadSession();

  try {
    if (!window.dataSdk) {
      throw new Error('Data SDK unavailable.');
    }

    const r = await window.dataSdk.init(handler);

    if (!r || !r.isOk) {
      console.warn('Data SDK initialized with a warning:', r);
    }
  } catch (err) {
    console.error('GATE failed to initialize data layer:', err);
    allData = [];
  }

  if (window.lucide) {
    lucide.createIcons();
  }

 timerInterval = setInterval(updateTimers, 1000);
/* Local metric is owned by GatePremiumMetricsController. */

initBatchGrid();
buildNav();
updateSoundButton();
renderAll();
}

    function getRecords(type) { return allData.filter(r => r.type === type); }
    function getConfig(key) { const r = allData.find(d => d.type === 'config' && d.key === key); return r ? r.value : ''; }
    function getActiveWG() { return getConfig('week_group') || ''; }

 function getLocalTime24() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  return `${hours}:${minutes}`;
}

function updateAirportMetric() {
  const lastAirport = getConfig('last_airport') || '—';
  const lastEl = document.getElementById('stat-last');
  if (lastEl && lastEl.textContent !== String(lastAirport)) lastEl.textContent = String(lastAirport);
}

 function updateSoundButton() {
  const btn = document.getElementById('sound-toggle-btn');

  if (!btn) {
    return;
  }

  btn.textContent = soundEnabled ? 'SOUND ON' : 'ENABLE SOUND';
}

async function enableOperationalSounds() {
  soundEnabled = true;
  soundEventBaseline = Date.now();

  localStorage.setItem(SOUND_ENABLED_KEY, 'true');
  updateSoundButton();

  soundPlayers = {};

  for (const [soundKey, src] of Object.entries(SOUND_FILES)) {
    const audio = new Audio(src);
    audio.preload = 'auto';
    audio.volume = 0.01;
    audio.load();

    soundPlayers[soundKey] = audio;

    try {
      await audio.play();
      audio.pause();
      audio.currentTime = 0;
      audio.volume = 1;
    } catch (error) {
      console.warn(`Sound unlock failed for ${soundKey}:`, error);
    }
  }
}

function savePlayedSoundEventIds() {
  const ids = Array.from(playedSoundEventIds).slice(-300);
  playedSoundEventIds = new Set(ids);
  localStorage.setItem(SOUND_PLAYED_KEY, JSON.stringify(ids));
}

async function createSoundEvent(soundKey, details = {}) {
  if (!SOUND_FILES[soundKey]) {
    return;
  }

  if (allData.length >= 990) {
    console.warn('Sound event skipped because record count is near the app limit.');
    return;
  }

  await window.dataSdk.create({
    type: 'sound_event',
    sound_key: soundKey,
    week_group: getActiveWG(),
    created_at: new Date().toISOString(),
    details: JSON.stringify(details)
  });
}

function playOperationalSound(soundKey) {
  if (!soundEnabled) {
    return;
  }

  if (!soundPlayers[soundKey]) {
    const src = SOUND_FILES[soundKey];

    if (!src) {
      return;
    }

    const audio = new Audio(src);
    audio.preload = 'auto';
    audio.load();
    soundPlayers[soundKey] = audio;
  }

  const audio = soundPlayers[soundKey];

  try {
    audio.pause();
    audio.currentTime = 0;
    audio.volume = 1;

    audio.play().catch(error => {
      console.warn(`Sound playback blocked, muted, or failed for ${soundKey}:`, error);
    });
  } catch (error) {
    console.warn(`Sound playback failed for ${soundKey}:`, error);
  }
}

function processSoundEvents() {
  const events = getRecords('sound_event')
    .filter(e => e.week_group === getActiveWG())
    .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));

  for (const event of events) {
    const id = event.__backendId;

    if (!id || playedSoundEventIds.has(id)) {
      continue;
    }

    const eventTime = new Date(event.created_at || '').getTime();

    if (!Number.isFinite(eventTime) || eventTime < soundEventBaseline) {
      playedSoundEventIds.add(id);
      continue;
    }

    playOperationalSound(event.sound_key);
    playedSoundEventIds.add(id);
  }

  savePlayedSoundEventIds();
}

async function triggerOvertimeSoundIfNeeded(dormId) {
  if (!dormId || overtimeSoundInProgress.has(dormId)) {
    return;
  }

  const d = allData.find(r => r.__backendId === dormId);

  if (!d || d.type !== 'dorm' || d.state !== 'open' || d.overtime_sound_sent === 'true') {
    return;
  }

  overtimeSoundInProgress.add(dormId);

  try {
    const updateResult = await window.dataSdk.update({
      ...d,
      overtime_sound_sent: 'true',
      overtime_sound_at: new Date().toISOString()
    });

    if (updateResult.isOk) {
      await createSoundEvent('overtime', {
        dorm_id: dormId,
        dorm_name: d.dorm_name || '',
        action: 'timer_overtime'
      });
    }
  } finally {
    overtimeSoundInProgress.delete(dormId);
  }
}

function getNextAirportBusId() {
  const wg = getActiveWG();

  const airportBuses = getRecords('bus')
    .filter(b => b.week_group === wg && b.bus_type === 'airport');

  const highestBusNumber = airportBuses.reduce((max, b) => {
    const n = Number(b.bus_id);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);

  return highestBusNumber + 1;
}

function getElapsedTimer(openedAt) {
  if (!openedAt) {
    return { text: '00:00', minutes: 0 };
  }

  const openedMs = new Date(openedAt).getTime();

  if (Number.isNaN(openedMs)) {
    return { text: '00:00', minutes: 0 };
  }

  const elapsed = Math.max(0, Math.floor((Date.now() - openedMs) / 1000));
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  return {
    text: `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`,
    minutes: mins
  };
}
   
    function renderAll() {
      const wg = getActiveWG();
      document.getElementById('week-group-display').textContent = wg || 'No WG';
      const dorms = getRecords('dorm').filter(d => d.week_group === wg);
      const buses = getRecords('bus').filter(b => b.week_group === wg);
      const totalExpected = dorms.reduce((s, d) => s + (Number(d.max_load) || 0), 0);
      const activeBuses = buses.filter(b => b.status === 'active');
      const arrivedBuses = buses.filter(b => b.status === 'arrived');
      const totalArrived = arrivedBuses.reduce((s, b) => s + (Number(b.otw_count) || 0), 0);

      const arrivedMetricEl = document.getElementById('stat-arrived');
      const expectedMetricEl = document.getElementById('stat-expected');
      if (arrivedMetricEl && arrivedMetricEl.textContent !== String(totalArrived)) arrivedMetricEl.textContent = String(totalArrived);
      if (expectedMetricEl && expectedMetricEl.textContent !== String(totalExpected)) expectedMetricEl.textContent = String(totalExpected);
      updateAirportMetric();

      if (window.GateStatusBoardController?.renderActiveBuses) {
        window.GateStatusBoardController.renderActiveBuses();
      } else {
      const abEl = document.getElementById('active-buses');

abEl.innerHTML = activeBuses.length === 0 ? '<span class="text-muted text-sm">None</span>' :
  activeBuses.map(b => {
    const label = b.bus_type === 'local'
      ? `LOCAL – ${escapeHtml(b.destination || '')} – ${b.otw_count}`
      : `BUS #${escapeHtml(b.bus_id)} – ${b.otw_count} OTW`;

    return `
      <button
        type="button"
        class="bus-badge"
        onclick="confirmBusArrival('${b.__backendId}')"
        title="Confirm bus arrival"
      >
        ${label} EN ROUTE
      </button>
    `;
  }).join('');
      }

      if (window.GateStatusBoardController?.renderDormColumns) {
        window.GateStatusBoardController.renderDormColumns(dorms);
      } else {
        renderDormColumns(dorms);
      }
      renderProcessingPage(dorms);
      renderArrivals(arrivedBuses);
      renderAirportBusLog(buses);
      renderArchives();
      busCounter = getNextAirportBusId() - 1;
      updateTimers();
      processSoundEvents();
    }

    // STATUS BOARD dorm columns (read-only display)
    function renderDormColumns(dorms) {
      ['empty','open','closed'].forEach(state => {
        const col = document.getElementById('col-' + state);
        const filtered = dorms.filter(d => d.state === state);
        col.innerHTML = filtered.map(d => buildBoardDormCard(d)).join('') || '<div class="text-muted text-xs">None</div>';
      });
    }

    function buildBoardDormCard(d) {
      let borderClass = d.sex === 'female' ? 'border-female' : (d.band === 'true' ? 'border-band' : '');
      let closedClass = d.state === 'closed' ? 'dorm-closed' : '';
      let timerHtml = '';
     if (d.state === 'open' && d.opened_at) {
  const timer = getElapsedTimer(d.opened_at);
  timerHtml = `<div class="text-3xl font-mono font-black font-tabular mt-2 timer-display text-center" data-opened="${d.opened_at}" data-dorm-id="${d.__backendId}">${timer.text}</div>`;
}
      if (d.state === 'closed' && d.closed_timer) timerHtml = `<div class="text-3xl font-mono font-black font-tabular mt-2 text-muted text-center">${escapeHtml(d.closed_timer)}</div>`;
      const displayStatus = d.state === 'closed'
  ? 'CLOSED'
  : d.phase || '';

let phaseHtml = displayStatus
  ? `<div class="text-sm font-bold text-center mt-1" style="color:${d.state === 'closed' ? 'var(--text-muted)' : 'var(--green)'};">${escapeHtml(displayStatus)}</div>`
  : '';

      const editHandler = '';

const currentLoad = Number(d.current_load || 0);
const maxLoad = Number(d.max_load || 0);
const isFull = maxLoad > 0 && currentLoad >= maxLoad;

let dormNameColor = 'var(--text)';

if (d.state === 'empty') {
  dormNameColor = 'var(--text-muted)';
} else if (d.state === 'open' && isFull) {
  dormNameColor = 'var(--green)';
} else if (d.state === 'open') {
  dormNameColor = 'var(--text)';
} else if (d.state === 'closed') {
  dormNameColor = 'var(--text-muted)';
}

const assignedAirmanHtml = d.assigned_airman
  ? `<div class="absolute top-2 right-3 text-[10px] font-black uppercase tracking-wider text-muted">${escapeHtml(d.assigned_airman)}</div>`
  : '';

return `<div class="dorm-card ${borderClass} ${closedClass} items-center p-3 relative" style="cursor:default;" ${editHandler}>
        ${assignedAirmanHtml}
        <div class="font-black text-4xl tracking-tight leading-none" style="color:${dormNameColor};">${escapeHtml(d.dorm_name || '')}</div>
        <div class="text-xs text-muted font-bold uppercase tracking-wider mt-1">${[escapeHtml(d.sdq), escapeHtml(d.section), escapeHtml(d.inter_sec)].filter(Boolean).join(' · ')}</div>
        <div class="text-xl font-black font-tabular mt-2">${d.current_load || 0} / ${d.max_load || 0}</div>
        ${timerHtml}${phaseHtml}
      </div>`;
    }

    // PROCESSING PAGE
    function renderProcessingPage(dorms) {
      const grid = document.getElementById('proc-dorm-grid');
      if (!dorms) dorms = getRecords('dorm').filter(d => d.week_group === getActiveWG());
      grid.innerHTML = dorms.map(d => buildProcCard(d)).join('') || '<div class="text-muted text-center text-lg py-8">No dormitories loaded. Initialize a Week Group from the Input page.</div>';
    }

    function buildProcCard(d) {
      let borderClass = d.sex === 'female' ? 'border-female' : (d.band === 'true' ? 'border-band' : '');
      let closedClass = d.state === 'closed' ? 'dorm-closed' : '';
      let timerHtml = '';
     if (d.state === 'open' && d.opened_at) {
  const timer = getElapsedTimer(d.opened_at);
  timerHtml = `<div class="text-2xl font-mono font-black font-tabular timer-display" data-opened="${d.opened_at}" data-dorm-id="${d.__backendId}">${timer.text}</div>`;
}
      if (d.state === 'closed' && d.closed_timer) timerHtml = `<div class="text-2xl font-mono font-black font-tabular text-muted">${escapeHtml(d.closed_timer)}</div>`;
      let stateLabel = d.state === 'empty' ? '<span class="text-xs font-bold uppercase px-2 py-1 rounded" style="background:var(--surface-alt);">EMPTY</span>' :
        d.state === 'open' ? '<span class="text-xs font-bold uppercase px-2 py-1 rounded text-white" style="background:var(--green);">OPEN</span>' :
        '<span class="text-xs font-bold uppercase px-2 py-1 rounded text-white" style="background:var(--red);">CLOSED</span>';
     
const assignedAirmanHtml = d.assigned_airman
  ? `<div class="text-[10px] font-black uppercase tracking-wider text-muted mt-1 text-right">${escapeHtml(d.assigned_airman)}</div>`
  : '';
     
      const editHandler = currentRole === 'instructor'
  ? `oncontextmenu="openDormEditModal(event, '${d.__backendId}')"`
  : '';

return `<div class="proc-card ${borderClass} ${closedClass}" onclick="openDormModal('${d.__backendId}')" ${editHandler}>
        <div class="flex justify-between items-start mb-2 gap-3">
  <div class="font-black text-3xl">${escapeHtml(d.dorm_name || '')}</div>

  <div class="flex flex-col items-end">
    ${stateLabel}
    ${assignedAirmanHtml}
  </div>
</div>
        <div class="text-xs text-muted font-bold uppercase">${[escapeHtml(d.sdq), escapeHtml(d.section), escapeHtml(d.inter_sec)].filter(Boolean).join(' · ')}</div>
        <div class="text-xl font-black font-tabular mt-2">${d.current_load || 0} / ${d.max_load || 0}</div>
        ${d.state === 'closed'
  ? `<div class="text-sm font-bold mt-1" style="color:var(--text-muted);">CLOSED</div>`
  : d.phase
    ? `<div class="text-sm font-bold mt-1" style="color:var(--green);">${escapeHtml(d.phase)}</div>`
    : ''
}
        ${timerHtml}
      </div>`;
    }

    // DORM MODAL
    function openDormModal(id) {
      modalDormId = id;
      const d = allData.find(r => r.__backendId === id);
      if (!d) return;
      document.getElementById('modal-dorm-name').textContent = escapeHtml(d.dorm_name || '');
      document.getElementById('modal-dorm-info').innerHTML = `${[escapeHtml(d.sdq), escapeHtml(d.section), escapeHtml(d.inter_sec)].filter(Boolean).join(' · ')} | ${d.sex === 'female' ? '♀ Female' : '♂ Male'}${d.band === 'true' ? ' | 🎵 Band' : ''} | Max: ${d.max_load}`;
      document.getElementById('modal-airman-input').value = d.assigned_airman || '';
     
      // Phase buttons
      const phases = ['OPEN','LOBBY','AUDITORIUM','STANDBY','INITIAL ISSUE','ITEM SETUP','LATRINE','FIT TEST','EATING','READY TO DEPART'];
      const phaseSection = document.getElementById('modal-phase-section');
      const phaseBtns = document.getElementById('modal-phase-buttons');
      if (d.state === 'open') {
        phaseSection.style.display = '';
        phaseBtns.innerHTML = phases.map(p => `<button type="button" class="phase-btn ${d.phase===p?'selected':''}" onclick="setPhase('${p}')">${p}</button>`).join('');
      } else {
        phaseSection.style.display = 'none';
      }

      // Load
      document.getElementById('modal-load-input').value = d.current_load || 0;
      document.getElementById('modal-load-max').textContent = `/ ${d.max_load}`;

            // Actions
      const actionEl = document.getElementById('modal-action-section');

      if (currentRole !== 'instructor') {
        if (d.state === 'closed') {
          actionEl.innerHTML = `<div class="text-muted font-bold">DORM CLOSED</div>`;
        } else {
          actionEl.innerHTML = `<div class="text-muted font-bold text-center">Instructor access required to open or close dorms.</div>`;
        }
      } else if (d.state === 'empty') {
        actionEl.innerHTML = `<button onclick="openDorm('${id}')" class="px-8 py-3 rounded-lg font-bold text-white text-lg" style="background:var(--green);">OPEN DORM</button>`;
      } else if (d.state === 'open') {
        actionEl.innerHTML = `<button onclick="closeDorm('${id}')" class="px-8 py-3 rounded-lg font-bold text-white text-lg" style="background:var(--red);">CLOSE DORM</button>`;
      } else {
        actionEl.innerHTML = `<div class="text-muted font-bold">DORM CLOSED</div>`;
      }

      document.getElementById('dorm-modal').classList.remove('hidden');
    }

    function closeDormModal() {
      document.getElementById('dorm-modal').classList.add('hidden');
      modalDormId = null;
    }

    async function setPhase(phase) {
  if (!modalDormId) return;

  const d = allData.find(r => r.__backendId === modalDormId);

  if (d) {
    await window.dataSdk.update({
      ...d,
      phase
    });
  }

  closeDormModal();
}

function handleAirmanInputKey(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    saveAssignedAirman();
  }
}

async function saveAssignedAirman() {
  if (!modalDormId) {
    return;
  }

  const d = allData.find(r => r.__backendId === modalDormId);

  if (!d) {
    return;
  }

  const assignedAirman = document.getElementById('modal-airman-input').value
    .trim()
    .toUpperCase();

  await window.dataSdk.update({
    ...d,
    assigned_airman: assignedAirman
  });

  closeDormModal();
}
   
function openDormEditModal(event, id) {
  event.preventDefault();
  event.stopPropagation();

  if (currentRole !== 'instructor') {
    return;
  }

  const d = allData.find(r => r.__backendId === id);

  if (!d) {
  return;
}

  editDormId = id;

  document.getElementById('edit-dorm-name').value = d.dorm_name || '';
  document.getElementById('edit-sdq').value = d.sdq || '';
  document.getElementById('edit-section').value = d.section || '';
  document.getElementById('edit-inter-sec').value = d.inter_sec || '';
  document.getElementById('edit-sex').value = d.sex || 'male';
  document.getElementById('edit-band').checked = d.band === 'true';
  document.getElementById('edit-max-load').value = d.max_load || 0;
  document.getElementById('edit-current-load').value = d.current_load || 0;
  document.getElementById('edit-closed-timer').value = d.closed_timer || '';
  document.getElementById('edit-notes').value = d.notes || '';

  const msg = document.getElementById('dorm-edit-msg');
  msg.classList.add('hidden');
  msg.textContent = '';

  document.getElementById('dorm-edit-modal').classList.remove('hidden');
}

function closeDormEditModal() {
  document.getElementById('dorm-edit-modal').classList.add('hidden');
  editDormId = null;
}

document.getElementById('dorm-edit-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  if (currentRole !== 'instructor' || !editDormId) {
    return;
  }

  const d = allData.find(r => r.__backendId === editDormId);

  if (!d) {
  return;
}

  const maxLoad = Math.max(0, Number(document.getElementById('edit-max-load').value || 0));
  const currentLoadRaw = Math.max(0, Number(document.getElementById('edit-current-load').value || 0));
  const currentLoad = Math.min(currentLoadRaw, maxLoad);

  const updatedDorm = {
    ...d,
    dorm_name: document.getElementById('edit-dorm-name').value.trim() || d.dorm_name,
    sdq: document.getElementById('edit-sdq').value.trim(),
    section: document.getElementById('edit-section').value.trim(),
    inter_sec: document.getElementById('edit-inter-sec').value.trim(),
    sex: document.getElementById('edit-sex').value,
    band: document.getElementById('edit-band').checked ? 'true' : 'false',
max_load: maxLoad,
current_load: currentLoad,
notes: document.getElementById('edit-notes').value.trim(),
phase: d.state === 'closed' ? 'Closed' : d.phase,
closed_timer: d.state === 'closed'
  ? document.getElementById('edit-closed-timer').value.trim() || d.closed_timer
  : d.closed_timer
  };

  const result = await window.dataSdk.update(updatedDorm);

  if (result.isOk) {
    closeDormEditModal();
  } else {
    const msg = document.getElementById('dorm-edit-msg');
    msg.textContent = 'Failed to save changes.';
    msg.style.color = 'var(--red)';
    msg.classList.remove('hidden');
  }
});

    function modLoad(delta) {
      const input = document.getElementById('modal-load-input');
      let val = parseInt(input.value) || 0;
      val = Math.max(0, val + delta);
      input.value = val;
    }

    function setLoadFull() {
      const d = allData.find(r => r.__backendId === modalDormId);
      if (d) document.getElementById('modal-load-input').value = d.max_load || 0;
    }

    async function saveLoad() {
      if (!modalDormId) return;
      const d = allData.find(r => r.__backendId === modalDormId);
      if (!d) return;
      const val = parseInt(document.getElementById('modal-load-input').value) || 0;
      await window.dataSdk.update({...d, current_load: val});
    }

    async function openDorm(id) {
  if (currentRole !== 'instructor') {
    return;
  }

  const d = allData.find(r => r.__backendId === id);

  if (!d) {
    return;
  }

  const result = await window.dataSdk.update({
    ...d,
    state: 'open',
    opened_at: new Date().toISOString(),
    overtime_sound_sent: 'false',
    overtime_sound_at: ''
  });

  if (result.isOk) {
    await createSoundEvent('dorm_open', {
      dorm_id: id,
      dorm_name: d.dorm_name || '',
      action: 'open_dorm'
    });
  }

  closeDormModal();
}

   async function deleteDormitoryFromEditModal() {
  if (currentRole !== 'instructor' || !editDormId) {
    return;
  }

  const d = allData.find(r => r.__backendId === editDormId);

  if (!d) {
    return;
  }

  const confirmed = confirm(`Delete dormitory ${d.dorm_name || 'this dorm'} from the current week group? This cannot be undone.`);

  if (!confirmed) {
    return;
  }

  const result = await window.dataSdk.delete(d);

  if (result.isOk) {
    closeDormEditModal();
  } else {
    const msg = document.getElementById('dorm-edit-msg');
    msg.textContent = 'Failed to delete dormitory.';
    msg.style.color = 'var(--red)';
    msg.classList.remove('hidden');
  }
}
   
   async function closeDorm(id) {
  if (currentRole !== 'instructor') {
    return;
  }

  const d = allData.find(r => r.__backendId === id);

  if (!d) return;

  const timerEl = document.querySelector(`.timer-display[data-opened="${d.opened_at}"]`);
  const finalTime = timerEl ? timerEl.textContent : '00:00';

  const result = await window.dataSdk.update({
    ...d,
    state: 'closed',
    phase: 'Closed',
    closed_timer: finalTime,
    closed_at: new Date().toISOString()
  });

  if (result.isOk) {
    await createSoundEvent('dorm_closed', {
      dorm_id: id,
      dorm_name: d.dorm_name || '',
      final_time: finalTime,
      action: 'close_dorm'
    });
  }

  closeDormModal();
}

    // LOCAL BUS
    function openLocalBusModal() { document.getElementById('local-bus-modal').classList.remove('hidden'); }
    function closeLocalBusModal() { document.getElementById('local-bus-modal').classList.add('hidden'); }

    document.getElementById('local-bus-form').addEventListener('submit', async (e) => {
      e.preventDefault();

      const dest = document.getElementById('local-dest').value.trim();
      const total = Number(document.getElementById('local-total').value);
      const females = Number(document.getElementById('local-female').value || 0);
      const nats = Number(document.getElementById('local-nat').value || 0);
      const wg = getActiveWG();

      if (!dest || !total) {
        showMsg('local-bus-msg', 'Destination and total arrived are required.', true);
        return;
      }

      if (!wg) {
        showMsg('local-bus-msg', 'Initialize a Week Group before adding a local arrival.', true);
        return;
      }

      if (females > total) {
        showMsg('local-bus-msg', 'Females cannot exceed total arrived.', true);
        return;
      }

      if (nats > total) {
        showMsg('local-bus-msg', 'Naturalizations cannot exceed total arrived.', true);
        return;
      }

      if (allData.length >= 999) {
        showMsg('local-bus-msg', 'Record limit reached!', true);
        return;
      }

      const newBusId = busCounter + 1;

      const r = await window.dataSdk.create({
        type: 'bus',
        bus_id: '',
        bus_type: 'local',
        destination: dest,
        otw_count: total,
        female_count: females,
        nat_count: nats,
        status: 'arrived',
        created_at: new Date().toISOString(),
        arrived_at: new Date().toISOString(),
        week_group: wg
      });

      if (r.isOk) {
        e.target.reset();
        document.getElementById('local-female').value = '0';
        document.getElementById('local-nat').value = '0';
        showMsg('local-bus-msg', `Local arrival recorded: ${dest} – ${total}`, false);
        setTimeout(() => closeLocalBusModal(), 1500);
      } else {
        showMsg('local-bus-msg', 'Failed', true);
      }
    });

    // TIMERS
    function updateTimers() {
  document.querySelectorAll('.timer-display').forEach(el => {
    const timer = getElapsedTimer(el.dataset.opened);

    el.textContent = timer.text;
    el.classList.remove('timer-yellow', 'timer-red', 'timer-flash');

    if (timer.minutes >= 60) {
  el.classList.remove('timer-flash');
  triggerOvertimeSoundIfNeeded(el.dataset.dormId);
} else if (timer.minutes >= 50) {
  el.classList.add('timer-red');
} else if (timer.minutes >= 40) {
  el.classList.add('timer-yellow');
}
  });
}

    // BUS ARRIVAL CONFIRM
    function confirmBusArrival(id) {
  const b = allData.find(r => r.__backendId === id);

  if (!b) {
    return;
  }

  const busLabel = b.bus_type === 'local'
    ? `LOCAL – ${b.destination || 'Originating Destination'}`
    : `Bus #${b.bus_id}`;

  showConfirm(`Confirm ${busLabel} has arrived at PRC?`, async () => {
    await window.dataSdk.update({
      ...b,
      status: 'arrived',
      arrived_at: new Date().toISOString()
    });
  });
}

    let confirmCallback = null;
    function showConfirm(msg, cb) {
      document.getElementById('confirm-msg').textContent = msg;
      document.getElementById('confirm-dialog').classList.remove('hidden');
      confirmCallback = cb;
    }
    document.getElementById('confirm-yes').addEventListener('click', () => {
      document.getElementById('confirm-dialog').classList.add('hidden');
      if (confirmCallback) confirmCallback();
      confirmCallback = null;
    });
    document.getElementById('confirm-no').addEventListener('click', () => {
      document.getElementById('confirm-dialog').classList.add('hidden');
      confirmCallback = null;
    });

    // AIRPORT FORM
    document.getElementById('airport-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const otw = Number(document.getElementById('bus-otw').value);
      const females = Number(document.getElementById('bus-female').value || 0);
      const nats = Number(document.getElementById('bus-nat').value || 0);
      document.querySelectorAll('#airport-form .text-red-500').forEach(el => el.classList.add('hidden'));
      if (otw > 44) { document.getElementById('bus-otw-error').textContent = 'Max 44'; document.getElementById('bus-otw-error').classList.remove('hidden'); return; }
      if (females > otw) { document.getElementById('bus-female-error').textContent = 'Females cannot exceed OTW'; document.getElementById('bus-female-error').classList.remove('hidden'); return; }
      if (nats > otw) { document.getElementById('bus-nat-error').textContent = 'Naturalizations cannot exceed OTW'; document.getElementById('bus-nat-error').classList.remove('hidden'); return; }
      if (allData.length >= 999) { showMsg('airport-msg', 'Record limit reached!', true); return; }

      const wg = getActiveWG();
      if (!wg) {
        showMsg('airport-msg', 'Initialize a Week Group before dispatching buses.', true);
        return;
      }

      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'Dispatching...';
      const newBusId = getNextAirportBusId();
      const r = await window.dataSdk.create({
        type: 'bus', bus_id: String(newBusId), bus_type: 'airport', destination: '',
        otw_count: otw, female_count: females, nat_count: nats,
        status: 'active', created_at: new Date().toISOString(), week_group: wg
      });
      btn.disabled = false; btn.textContent = 'DISPATCH BUS';
      if (r.isOk) {
  await createSoundEvent('bus_dispatch', {
    bus_id: String(newBusId),
    otw_count: otw,
    female_count: females,
    nat_count: nats,
    action: 'dispatch_bus'
  });

  e.target.reset();
  document.getElementById('bus-female').value = '0';
  document.getElementById('bus-nat').value = '0';
  showMsg('airport-msg', `Bus #${newBusId} Dispatched`, false);
} else {
  showMsg('airport-msg', 'Failed', true);
}
    });

    async function updateFlightTime() {
      const v = document.getElementById('flight-time').value;
      if (!v) { showMsg('flight-time-msg', 'Select a time', true); return; }
      const existing = allData.find(d => d.type === 'config' && d.key === 'last_airport');
      const result = existing ? await window.dataSdk.update({...existing, value: v}) : await window.dataSdk.create({type: 'config', key: 'last_airport', value: v});
      if (result.isOk) showMsg('flight-time-msg', 'Updated', false);
      else showMsg('flight-time-msg', 'Failed', true);
    }

    // BATCH INPUT
    let batchRows = Array.from({length: 25}, (_, i) => ({rowIndex: i, sdq:'', sec:'', inter_sec:'', dorm_name:'', sex:'male', band:false, load:''}));

    function initBatchGrid() {
      const container = document.getElementById('batch-rows-container');
      container.innerHTML = batchRows.map((row, i) => `
        <div class="grid grid-cols-[1fr_1fr_1.5fr_1.5fr_1fr_0.5fr_1fr_40px] gap-2 items-center">
          <input class="batch-sdq border rounded px-1 py-1 bg-transparent text-xs" style="border-color:var(--border);color:var(--text);" data-row="${i}" value="${row.sdq}">
          <input class="batch-sec border rounded px-1 py-1 bg-transparent text-xs" style="border-color:var(--border);color:var(--text);" data-row="${i}" value="${row.sec}">
          <input class="batch-inter border rounded px-1 py-1 bg-transparent text-xs" style="border-color:var(--border);color:var(--text);" data-row="${i}" value="${row.inter_sec}">
          <input class="batch-dorm border rounded px-1 py-1 bg-transparent text-xs" style="border-color:var(--border);color:var(--text);" data-row="${i}" value="${row.dorm_name}">
          <select class="batch-sex border rounded px-1 py-1 bg-transparent text-xs" style="border-color:var(--border);color:var(--text);" data-row="${i}">
            <option value="male" ${row.sex==='male'?'selected':''}>Male</option>
            <option value="female" ${row.sex==='female'?'selected':''}>Female</option>
          </select>
          <label class="flex items-center justify-center"><input type="checkbox" class="batch-band w-4 h-4" data-row="${i}" ${row.band?'checked':''}></label>
          <input type="number" class="batch-load border rounded px-1 py-1 bg-transparent text-xs font-tabular" style="border-color:var(--border);color:var(--text);" inputmode="numeric" data-row="${i}" min="0" value="${row.load}">
          <button type="button" onclick="clearBatchRow(${i})" class="text-red-500 text-lg leading-none">×</button>
        </div>
      `).join('');
      container.addEventListener('input', handleBatchInput);
      container.addEventListener('change', handleBatchInput);
    }

    function handleBatchInput(e) {
      const el = e.target; const i = parseInt(el.dataset.row); if (isNaN(i)) return;
      if (el.classList.contains('batch-sdq')) batchRows[i].sdq = el.value;
      else if (el.classList.contains('batch-sec')) batchRows[i].sec = el.value;
      else if (el.classList.contains('batch-inter')) batchRows[i].inter_sec = el.value;
      else if (el.classList.contains('batch-dorm')) batchRows[i].dorm_name = el.value;
      else if (el.classList.contains('batch-sex')) batchRows[i].sex = el.value;
      else if (el.classList.contains('batch-band')) batchRows[i].band = el.checked;
      else if (el.classList.contains('batch-load')) { batchRows[i].load = el.value; updateTotalLoadCalc(); }
    }

    function updateTotalLoadCalc() {
      document.getElementById('total-load-calc').textContent = batchRows.reduce((s, r) => s + (parseInt(r.load) || 0), 0);
    }

    function clearBatchRow(i) {
      batchRows[i] = {rowIndex: i, sdq:'', sec:'', inter_sec:'', dorm_name:'', sex:'male', band:false, load:''};
      document.querySelectorAll(`[data-row="${i}"]`).forEach(input => {
        if (input.type === 'checkbox') input.checked = false;
        else if (input.tagName === 'SELECT') input.value = 'male';
        else input.value = '';
      });
      updateTotalLoadCalc();
    }

    async function initializeWeekGroup() {
      const wg = document.getElementById('wg-batch-input').value.trim();
      if (!wg) { showBatchMsg('Week Group ID required', true); return; }
      const filledRows = batchRows.filter(r => r.load && parseInt(r.load) > 0);
      if (filledRows.length === 0) { showBatchMsg('At least one row with Load required', true); return; }
      if (allData.length + filledRows.length + 1 >= 999) { showBatchMsg('Record limit reached', true); return; }

      const btn = document.getElementById('init-wg-btn');
      btn.disabled = true; btn.textContent = 'Initializing...';

      const existing = allData.find(d => d.type === 'config' && d.key === 'week_group');
      if (existing) await window.dataSdk.update({...existing, value: wg});
      else await window.dataSdk.create({type: 'config', key: 'week_group', value: wg});

      let ok = 0;
      for (const row of filledRows) {
        const r = await window.dataSdk.create({
                type: 'dorm',
                dorm_name: row.dorm_name.trim() || `Dorm ${row.rowIndex+1}`,
                section: row.sec.trim(),
                sdq: row.sdq.trim(),
                inter_sec: row.inter_sec.trim(),
                max_load: parseInt(row.load) || 0,
                current_load: 0,
                sex: row.sex,
                band: row.band ? 'true' : 'false',
                state: 'empty',
                phase: '',
                opened_at: '',
                closed_timer: '',
                closed_at: '',
                notes: '',
                assigned_airman: '',
                overtime_sound_sent: 'false',
                overtime_sound_at: '',
                week_group: wg,
                created_at: new Date().toISOString(),
                destination: '',
                bus_type: ''
              });
        if (r.isOk) ok++;
      }
      btn.disabled = false; btn.textContent = 'INITIALIZE WEEK GROUP';
      if (ok === filledRows.length) document.getElementById('init-success-overlay').classList.remove('hidden');
      else showBatchMsg(`${ok}/${filledRows.length} created`, true);
    }

    function returnToBoard() {
      document.getElementById('init-success-overlay').classList.add('hidden');
      showPage('board');
    }

    function showBatchMsg(msg, isErr) {
      const el = document.getElementById('init-status-msg');
      el.textContent = msg; el.className = `text-sm ${isErr ? 'text-red-500' : 'text-green-400'}`;
      el.classList.remove('hidden'); setTimeout(() => el.classList.add('hidden'), 4000);
    }

    function renderArrivals(arrivedBuses) {
      const tbody = document.getElementById('arrivals-body');
      tbody.innerHTML = arrivedBuses.map(b => {
        const dep = b.created_at ? new Date(b.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '—';
        const arr = b.arrived_at ? new Date(b.arrived_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '—';
        const label = b.bus_type === 'local' ? `LOCAL – ${escapeHtml(b.destination)}` : `#${b.bus_id}`;
        return `<tr class="border-b" style="border-color:var(--border);"><td class="px-3 py-2">${label}</td><td class="px-3 py-2 font-tabular text-muted">${dep}</td><td class="px-3 py-2 font-tabular">${arr}</td><td class="px-3 py-2 font-tabular">${b.otw_count}</td><td class="px-3 py-2 font-tabular">${b.female_count}</td><td class="px-3 py-2 font-tabular">${b.nat_count}</td></tr>`;
      }).join('');
      document.getElementById('total-otw').textContent = arrivedBuses.reduce((s,b) => s + Number(b.otw_count||0), 0);
      document.getElementById('total-f').textContent = arrivedBuses.reduce((s,b) => s + Number(b.female_count||0), 0);
      document.getElementById('total-nat').textContent = arrivedBuses.reduce((s,b) => s + Number(b.nat_count||0), 0);
    }

   function renderAirportBusLog(buses) {
  const tbody = document.getElementById('airport-bus-log-body');

  if (!tbody) {
    return;
  }

  const wg = getActiveWG();

  const airportBuses = (buses || getRecords('bus').filter(b => b.week_group === wg))
    .filter(b => b.bus_type === 'airport')
    .sort((a, b) => Number(a.bus_id || 0) - Number(b.bus_id || 0));

  if (airportBuses.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td class="px-3 py-4 text-center text-muted" colspan="7">No airport buses generated for this week group.</td>
      </tr>
    `;

    document.getElementById('airport-log-total-otw').textContent = '0';
    document.getElementById('airport-log-total-f').textContent = '0';
    document.getElementById('airport-log-total-nat').textContent = '0';
    return;
  }

  tbody.innerHTML = airportBuses.map(b => {
    const departed = b.created_at
      ? new Date(b.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '—';

    const arrived = b.arrived_at
      ? new Date(b.arrived_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '—';

    const statusLabel = b.status === 'arrived'
      ? '<span class="text-xs font-bold uppercase px-2 py-1 rounded text-white" style="background:var(--green);">ARRIVED</span>'
      : '<span class="text-xs font-bold uppercase px-2 py-1 rounded text-white" style="background:var(--blue);">EN ROUTE</span>';

    return `
      <tr
        class="border-b hover:opacity-80"
        style="border-color:var(--border); cursor:pointer;"
        onclick="openAirportBusEditModal('${b.__backendId}')"
        title="Click to edit Bus #${escapeHtml(b.bus_id)}"
      >
        <td class="px-3 py-2 font-bold">#${escapeHtml(b.bus_id)}</td>
        <td class="px-3 py-2 font-tabular text-muted">${departed}</td>
        <td class="px-3 py-2 font-tabular">${arrived}</td>
        <td class="px-3 py-2">${statusLabel}</td>
        <td class="px-3 py-2 font-tabular">${escapeHtml(b.otw_count || 0)}</td>
        <td class="px-3 py-2 font-tabular">${escapeHtml(b.female_count || 0)}</td>
        <td class="px-3 py-2 font-tabular">${escapeHtml(b.nat_count || 0)}</td>
      </tr>
    `;
  }).join('');

  document.getElementById('airport-log-total-otw').textContent =
    airportBuses.reduce((s, b) => s + Number(b.otw_count || 0), 0);

  document.getElementById('airport-log-total-f').textContent =
    airportBuses.reduce((s, b) => s + Number(b.female_count || 0), 0);

  document.getElementById('airport-log-total-nat').textContent =
    airportBuses.reduce((s, b) => s + Number(b.nat_count || 0), 0);
}

function openAirportBusEditModal(id) {
  const bus = allData.find(r => r.__backendId === id);

  if (!bus || bus.bus_type !== 'airport') {
    return;
  }

  editBusId = id;

  document.getElementById('airport-bus-edit-title').textContent = `Edit Bus #${bus.bus_id}`;
  document.getElementById('edit-bus-otw').value = bus.otw_count || 0;
  document.getElementById('edit-bus-female').value = bus.female_count || 0;
  document.getElementById('edit-bus-nat').value = bus.nat_count || 0;

  ['edit-bus-otw-error', 'edit-bus-female-error', 'edit-bus-nat-error'].forEach(id => {
    const el = document.getElementById(id);
    el.textContent = '';
    el.classList.add('hidden');
  });

  const msg = document.getElementById('edit-bus-msg');
  msg.textContent = '';
  msg.classList.add('hidden');

  document.getElementById('airport-bus-edit-modal').classList.remove('hidden');
}

document.getElementById('airport-bus-edit-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!editBusId) {
    return;
  }

  const bus = allData.find(r => r.__backendId === editBusId);

  if (!bus || bus.bus_type !== 'airport') {
    return;
  }

  const otw = Number(document.getElementById('edit-bus-otw').value);
  const females = Number(document.getElementById('edit-bus-female').value || 0);
  const nats = Number(document.getElementById('edit-bus-nat').value || 0);

  ['edit-bus-otw-error', 'edit-bus-female-error', 'edit-bus-nat-error'].forEach(id => {
    const el = document.getElementById(id);
    el.textContent = '';
    el.classList.add('hidden');
  });

  if (!Number.isFinite(otw) || otw < 0 || otw > 44) {
    const el = document.getElementById('edit-bus-otw-error');
    el.textContent = 'OTW must be between 0 and 44.';
    el.classList.remove('hidden');
    return;
  }

  if (!Number.isFinite(females) || females < 0 || females > otw) {
    const el = document.getElementById('edit-bus-female-error');
    el.textContent = 'Females cannot exceed OTW.';
    el.classList.remove('hidden');
    return;
  }

  if (!Number.isFinite(nats) || nats < 0 || nats > otw) {
    const el = document.getElementById('edit-bus-nat-error');
    el.textContent = 'Naturalizations cannot exceed OTW.';
    el.classList.remove('hidden');
    return;
  }

  const result = await window.dataSdk.update({
    ...bus,
    otw_count: otw,
    female_count: females,
    nat_count: nats,
    updated_at: new Date().toISOString()
  });

  if (result.isOk) {
    closeAirportBusEditModal();
  } else {
    const msg = document.getElementById('edit-bus-msg');
    msg.textContent = 'Failed to save bus update.';
    msg.style.color = 'var(--red)';
    msg.classList.remove('hidden');
  }
});

function closeAirportBusEditModal() {
  document.getElementById('airport-bus-edit-modal').classList.add('hidden');
  editBusId = null;
}

    function renderArchives() {
  const archives = getRecords('archive');
  const el = document.getElementById('archive-history');

  if (archives.length === 0) {
    el.innerHTML = 'No archived week groups.';
    return;
  }

  el.innerHTML = archives.map(a => {
    let dormLog = '';

    if (a.dorm_data) {
      try {
        const parsed = JSON.parse(a.dorm_data);

        if (parsed.length > 0) {
          dormLog = `
            <div class="mt-3 border-t pt-2" style="border-color:var(--border);">
              <div class="grid grid-cols-6 gap-2 text-[10px] uppercase font-bold text-muted mb-1">
                <div>Dorm</div>
                <div>Loaded</div>
                <div>Max</div>
                <div>Opened</div>
                <div>Closed</div>
                <div>Elapsed</div>
              </div>
              <div class="space-y-1">
                ${parsed.map(d => `
                  <div class="grid grid-cols-6 gap-2 text-xs">
                    <div class="font-bold">${escapeHtml(d.name || d.dorm_name || '')}</div>
                    <div class="font-tabular">${escapeHtml(d.current_load ?? d.loaded ?? '')}</div>
                    <div class="font-tabular">${escapeHtml(d.max_load ?? '')}</div>
                    <div class="font-tabular">${escapeHtml(d.open_time || '')}</div>
                    <div class="font-tabular">${escapeHtml(d.close_time || '')}</div>
                    <div class="font-tabular text-muted">${escapeHtml(d.elapsed || '')}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        }
      } catch(e) {}
    }

    const femaleTotal = Number(a.female_total || 0);
    const natTotal = Number(a.nat_total || 0);

    return `
      <div
        class="surface border rounded-lg p-3 mb-3"
        style="border-color:var(--border); cursor:pointer;"
        oncontextmenu="openArchiveEditModal(event, '${a.__backendId}')"
        title="Right-click to edit archived week group"
      >
        <div class="font-bold text-lg">${escapeHtml(a.week_group || 'Unknown')}</div>
        <div class="text-xs text-muted mb-1">
          Archived: ${a.archived_at ? new Date(a.archived_at).toLocaleString() : ''}
          | Buses: ${a.bus_count || 0}
          | Arrived: ${a.total_arrived || 0}
          | Females: ${femaleTotal}
          | NAT: ${natTotal}
        </div>
        ${dormLog}
      </div>
    `;
  }).reverse().join('');
}
   
    function initiateCloseout() {
      showConfirm('Close out this week group? This archives all data.', async () => {
        const wg = getActiveWG();
        const dorms = getRecords('dorm').filter(d => d.week_group === wg);
        const buses = getRecords('bus').filter(b => b.week_group === wg);
        const soundEvents = getRecords('sound_event').filter(e => e.week_group === wg);
        const arrivedBuses = buses.filter(b => b.status === 'arrived');
        const totalArrived = arrivedBuses.reduce((s, b) => s + (Number(b.otw_count) || 0), 0);
        const dormHistory = dorms.map(d => ({
  name: d.dorm_name,
  dorm_name: d.dorm_name,
  sdq: d.sdq || '',
  section: d.section || '',
  inter_sec: d.inter_sec || '',
  sex: d.sex || '',
  band: d.band || 'false',
  current_load: Number(d.current_load || 0),
  max_load: Number(d.max_load || 0),
  state: d.state || '',
  phase: d.phase || '',
  notes: d.notes || '',
  assigned_airman: d.assigned_airman || '',
  opened_at: d.opened_at || '',
  closed_at: d.closed_at || '',
  open_time: d.opened_at ? new Date(d.opened_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '—',
  close_time: d.closed_at ? new Date(d.closed_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '—',
  elapsed: d.closed_timer || '—'
}));

const busHistory = buses.map(b => ({
  bus_id: b.bus_id || '',
  bus_type: b.bus_type || 'airport',
  originating_destination: b.originating_destination || b.destination || '',
  destination: b.destination || '',
  departed_at: b.created_at || '',
  arrived_at: b.arrived_at || '',
  otw_count: Number(b.otw_count || 0),
  female_count: Number(b.female_count || 0),
  nat_count: Number(b.nat_count || 0),
  status: b.status || ''
}));

const femaleTotal = buses.reduce((s, b) => s + Number(b.female_count || 0), 0);
const natTotal = buses.reduce((s, b) => s + Number(b.nat_count || 0), 0);
const loadedTotal = dorms.reduce((s, d) => s + Number(d.current_load || 0), 0);
const expectedTotal = dorms.reduce((s, d) => s + Number(d.max_load || 0), 0);

if (allData.length < 999) {
  await window.dataSdk.create({
    type: 'archive',
    week_group: wg,
    archived_at: new Date().toISOString(),
    dorm_count: dorms.length,
    bus_count: buses.length,
    total_arrived: totalArrived,
    total_loaded: loadedTotal,
    total_expected: expectedTotal,
    female_total: femaleTotal,
    nat_total: natTotal,
    dorm_data: JSON.stringify(dormHistory),
    bus_data: JSON.stringify(busHistory)
  });
}
        for (const rec of [...dorms, ...buses, ...soundEvents]) await window.dataSdk.delete(rec);
        const lastAirport = allData.find(d => d.type === 'config' && d.key === 'last_airport');
        if (lastAirport) await window.dataSdk.update({...lastAirport, value: ''});
        const activeWgConfig = allData.find(d => d.type === 'config' && d.key === 'week_group');
        if (activeWgConfig) await window.dataSdk.update({...activeWgConfig, value: ''});
        document.getElementById('wg-batch-input').value = '';
        batchRows = Array.from({length: 25}, (_, i) => ({rowIndex: i, sdq:'', sec:'', inter_sec:'', dorm_name:'', sex:'male', band:false, load:''}));
        initBatchGrid(); updateTotalLoadCalc();
      });
    }

    function showMsg(elId, msg, isErr) {
      const el = document.getElementById(elId);
      el.textContent = msg; el.className = `text-center text-sm ${isErr ? 'text-red-500' : 'text-green-400'}`;
      el.classList.remove('hidden'); setTimeout(() => el.classList.add('hidden'), 3000);
    }
function safeJsonPretty(value, fallback = []) {
  try {
    if (!value) return JSON.stringify(fallback, null, 2);
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return JSON.stringify(fallback, null, 2);
  }
}

function parseJsonField(fieldId, fallback = []) {
  const value = document.getElementById(fieldId).value.trim();

  if (!value) {
    return fallback;
  }

  return JSON.parse(value);
}

function openArchiveEditModal(event, id) {
  event.preventDefault();
  event.stopPropagation();

  if (currentRole !== 'instructor') {
    return;
  }

  const archive = allData.find(r => r.__backendId === id);

  if (!archive) {
    return;
  }

  editArchiveId = id;

  document.getElementById('archive-edit-wg').value = archive.week_group || '';
  document.getElementById('archive-edit-archived-at').value = archive.archived_at || '';
  document.getElementById('archive-edit-dorm-count').value = archive.dorm_count || 0;
  document.getElementById('archive-edit-bus-count').value = archive.bus_count || 0;
  document.getElementById('archive-edit-total-arrived').value = archive.total_arrived || 0;
  document.getElementById('archive-edit-female-total').value = archive.female_total || 0;
  document.getElementById('archive-edit-nat-total').value = archive.nat_total || 0;
  document.getElementById('archive-edit-dorm-data').value = safeJsonPretty(archive.dorm_data, []);
  document.getElementById('archive-edit-bus-data').value = safeJsonPretty(archive.bus_data, []);

  const msg = document.getElementById('archive-edit-msg');
  msg.classList.add('hidden');
  msg.textContent = '';

  document.getElementById('archive-edit-modal').classList.remove('hidden');
}

function closeArchiveEditModal() {
  document.getElementById('archive-edit-modal').classList.add('hidden');
  editArchiveId = null;
}

document.getElementById('archive-edit-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  if (currentRole !== 'instructor' || !editArchiveId) {
    return;
  }

  const archive = allData.find(r => r.__backendId === editArchiveId);

  if (!archive) {
    return;
  }

  const msg = document.getElementById('archive-edit-msg');

  try {
    const dormData = parseJsonField('archive-edit-dorm-data', []);
    const busData = parseJsonField('archive-edit-bus-data', []);

    const updatedArchive = {
      ...archive,
      week_group: document.getElementById('archive-edit-wg').value.trim() || archive.week_group,
      archived_at: document.getElementById('archive-edit-archived-at').value.trim() || archive.archived_at,
      dorm_count: Number(document.getElementById('archive-edit-dorm-count').value || 0),
      bus_count: Number(document.getElementById('archive-edit-bus-count').value || 0),
      total_arrived: Number(document.getElementById('archive-edit-total-arrived').value || 0),
      female_total: Number(document.getElementById('archive-edit-female-total').value || 0),
      nat_total: Number(document.getElementById('archive-edit-nat-total').value || 0),
      dorm_data: JSON.stringify(dormData),
      bus_data: JSON.stringify(busData)
    };

    const result = await window.dataSdk.update(updatedArchive);

    if (result.isOk) {
      closeArchiveEditModal();
    } else {
      throw new Error('Failed to save archive.');
    }
  } catch (error) {
    msg.textContent = `Archive save failed: ${error.message}`;
    msg.style.color = 'var(--red)';
    msg.classList.remove('hidden');
  }
});

function printArchiveSpreadsheet() {
  if (!editArchiveId) {
    return;
  }

  const archive = allData.find(r => r.__backendId === editArchiveId);

  if (!archive) {
    return;
  }

  let dormData = [];
  let busData = [];

  try {
    dormData = parseJsonField('archive-edit-dorm-data', []);
    busData = parseJsonField('archive-edit-bus-data', []);
  } catch (error) {
    alert('Dorm Data JSON or Bus Data JSON is invalid. Fix the JSON before printing.');
    return;
  }

  const weekGroup = document.getElementById('archive-edit-wg').value.trim() || archive.week_group || '';
  const totalArrived = Number(document.getElementById('archive-edit-total-arrived').value || 0);
  const femaleTotal = Number(document.getElementById('archive-edit-female-total').value || 0);
  const natTotal = Number(document.getElementById('archive-edit-nat-total').value || 0);
  const loadedTotal = dormData.reduce((s, d) => s + Number(d.current_load || d.loaded || 0), 0);
  const expectedTotal = dormData.reduce((s, d) => s + Number(d.max_load || 0), 0);

  const dormRows = dormData.map(d => `
    <tr>
      <td>${escapeHtml(d.name || d.dorm_name || '')}</td>
      <td>${escapeHtml(d.assigned_airman || '')}</td>
      <td>${escapeHtml(d.sdq || '')}</td>
      <td>${escapeHtml(d.section || '')}</td>
      <td>${escapeHtml(d.inter_sec || '')}</td>
      <td>${escapeHtml(d.sex || '')}</td>
      <td>${escapeHtml(d.band === 'true' ? 'YES' : '')}</td>
      <td>${escapeHtml(d.current_load ?? d.loaded ?? 0)}</td>
      <td>${escapeHtml(d.max_load ?? 0)}</td>
      <td>${escapeHtml(d.open_time || '')}</td>
      <td>${escapeHtml(d.close_time || '')}</td>
      <td>${escapeHtml(d.elapsed || '')}</td>
      <td>${escapeHtml(d.notes || '')}</td>
    </tr>
  `).join('');

  const busRows = busData.map(b => `
    <tr>
      <td>${escapeHtml(b.bus_type || '')}</td>
      <td>${escapeHtml(b.bus_id || '')}</td>
      <td>${escapeHtml(b.originating_destination || b.destination || '')}</td>
      <td>${escapeHtml(b.otw_count || 0)}</td>
      <td>${escapeHtml(b.female_count || 0)}</td>
      <td>${escapeHtml(b.nat_count || 0)}</td>
      <td>${b.departed_at ? escapeHtml(new Date(b.departed_at).toLocaleString()) : ''}</td>
      <td>${b.arrived_at ? escapeHtml(new Date(b.arrived_at).toLocaleString()) : ''}</td>
      <td>${escapeHtml(b.status || '')}</td>
    </tr>
  `).join('');

  const printWindow = window.open('', '_blank');

  printWindow.document.write(`
    <!doctype html>
    <html>
    <head>
      <title>${escapeHtml(weekGroup)} Archive Report</title>
      
    </head>
    <body>
      <button class="no-print" onclick="window.print()" style="padding:8px 16px;margin-bottom:12px;">Print</button>

      <h1>GATE Archive Report</h1>
      <div><strong>Week Group:</strong> ${escapeHtml(weekGroup)}</div>
      <div><strong>Archived:</strong> ${archive.archived_at ? escapeHtml(new Date(archive.archived_at).toLocaleString()) : ''}</div>

      <div class="summary">
        <div class="box"><div class="label">Total Arrived</div><div class="value">${totalArrived}</div></div>
        <div class="box"><div class="label">Loaded to Dorms</div><div class="value">${loadedTotal}</div></div>
        <div class="box"><div class="label">Expected Capacity</div><div class="value">${expectedTotal}</div></div>
        <div class="box"><div class="label">Females</div><div class="value">${femaleTotal}</div></div>
        <div class="box"><div class="label">Naturalizations</div><div class="value">${natTotal}</div></div>
      </div>

      <h2>Dorm Loadout</h2>
      <table>
        <thead>
          <tr>
            <th>Dorm</th>
            <th>Airman</th>
            <th>SDQ</th>
            <th>Section</th>
            <th>Inter/Sec</th>
            <th>Sex</th>
            <th>Band</th>
            <th>Loaded</th>
            <th>Max</th>
            <th>Opened</th>
            <th>Closed</th>
            <th>Elapsed</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>${dormRows}</tbody>
      </table>

      <h2>Bus / Arrival Log</h2>
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Bus #</th>
            <th>Originating Destination</th>
            <th>Arrived/OTW</th>
            <th>Females</th>
            <th>Naturalizations</th>
            <th>Departed</th>
            <th>Arrived</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>${busRows}</tbody>
      </table>
    </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
}

   async function deleteArchiveWithOverride() {
  if (!editArchiveId) {
    return;
  }

  const archive = allData.find(r => r.__backendId === editArchiveId);

  if (!archive) {
    return;
  }

  const override = prompt('Enter ADMIN_OVERRIDE password to delete this archived week group.');

  if (!override) {
    return;
  }

  const confirmed = confirm(`Delete archived week group ${archive.week_group || 'Unknown'}? This cannot be undone.`);

  if (!confirmed) {
    return;
  }

  const response = await fetch('/api/archive-delete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      record_id: archive.__backendId,
      override
    })
  });

  const result = await response.json();

  if (result.isOk) {
  closeArchiveEditModal();
  allData = allData.filter(r => r.__backendId !== archive.__backendId);
  renderAll();
} else {
    const msg = document.getElementById('archive-edit-msg');
    msg.textContent = result.error || 'Archive delete failed.';
    msg.style.color = 'var(--red)';
    msg.classList.remove('hidden');
  }
}

 function toggleFullscreenBoard() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      console.error('Fullscreen failed:', err);
    });
  } else {
    document.exitFullscreen();
  }
}

function syncFullscreenBoardState() {
  const isFullscreen = Boolean(document.fullscreenElement);

  document.body.classList.toggle('fullscreen-board', isFullscreen);

  const btn = document.getElementById('fullscreen-btn');

  if (btn) {
    btn.textContent = isFullscreen ? 'EXIT FULL SCREEN' : 'FULL SCREEN';
  }

  if (isFullscreen) {
    showPage('board');
  }
}

document.addEventListener('fullscreenchange', syncFullscreenBoardState);
   
    initApp();
