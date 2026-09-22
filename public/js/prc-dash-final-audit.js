// Squadron Board controller + existing close-dorm timing compatibility. Status Board has its own owner.
(function () {
  'use strict';
  let installed = false;
  let closeDormPatched = false;
  let polling = false;
  let lastPoll = 0;
  let lastNoticeKey = null;
  let currentNotice = null;
  let currentInformation = null;
  let informationDirty = false;
  let informationEditRevision = 0;
  let activeWeek = '';
  let editor = false;
  let soundEnabled = false;
  let alertSound = null;
  const nodes = new Map();
  const POLL_MS = 15000;
  const byId = id => document.getElementById(id);
  const standalone = () => document.body.classList.contains('gate-squadron-standalone');
  const esc = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  function setText(element, value) { if (element && element.textContent !== String(value)) element.textContent = String(value); }
  const tooltip = (label, description) => `<button type="button" class="gate-info" data-squadron-tip="${esc(description)}" aria-label="About ${esc(label)}">ⓘ</button>`;

  function ensureDocumentIdentity() {
    document.title = standalone() ? 'Squadron Board · GATE' : 'GATE — Gateway Arrival Tracking Environment | Pfingston Reception Center';
    document.documentElement.lang = 'en';
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, viewport-fit=cover');
  }

  function markup() {
    return `<div class="gate-squadron-view">
      <header class="gate-squadron-topbar" aria-label="Squadron Board header">
        <div class="gate-squadron-top-left"><button id="squadron-information" type="button" class="gate-squadron-information" aria-label="Open Squadron information"><span aria-hidden="true">ⓘ</span><span class="gate-squadron-new" id="squadron-new" hidden>NEW</span></button></div>
        <div class="gate-squadron-heading"><div class="gate-squadron-eyebrow">PFINGSTON RECEPTION CENTER · GATE</div><h1 id="squadron-title" class="gate-squadron-title">SQUADRON BOARD</h1><div id="squadron-week-label" class="gate-squadron-week">NO ACTIVE WEEK GROUP</div></div>
        <div class="gate-squadron-actions"><span class="gate-squadron-tag">READ ONLY</span>${standalone() ? '<button id="squadron-enable-sound" type="button" class="gate-squadron-utility">ENABLE ALERTS</button><button id="squadron-logout" type="button" class="gate-squadron-utility">LOG OUT</button>' : ''}</div>
        <div id="squadron-traffic" class="gate-squadron-traffic" data-tempo="UNAVAILABLE" aria-label="Inbound traffic tempo">
          <div class="gate-squadron-traffic-title">INBOUND TRAFFIC ${tooltip('Inbound Traffic', 'Trainees on their way from the Airport to the PRC.')}</div>
          <div class="gate-squadron-tempo-options" role="group" aria-label="Rolling 60-minute bus tempo">
            <div class="gate-squadron-tempo-option" data-rate="SLOW"><span aria-hidden="true">🚐</span><strong>SLOW</strong></div>
            <div class="gate-squadron-tempo-option" data-rate="MEDIUM"><span aria-hidden="true">🚐🚐</span><strong>MEDIUM</strong></div>
            <div class="gate-squadron-tempo-option" data-rate="HEAVY"><span aria-hidden="true">🚐🚐🚐</span><strong>HEAVY</strong></div>
          </div><div id="squadron-traffic-detail" class="gate-squadron-traffic-detail">Awaiting current traffic</div>
        </div>
      </header>
      <section class="gate-squadron-metrics" aria-label="Receiving metrics">
        <article class="gate-squadron-metric"><div class="gate-squadron-metric-head">ARRIVED ${tooltip('Arrived', 'Trainees that have arrived to the PRC.')}</div><div id="squadron-metric-arrived" class="gate-squadron-value">—</div></article>
        <article class="gate-squadron-metric"><div class="gate-squadron-metric-head">EXPECTED ${tooltip('Expected', 'Number of Trainees expected to arrive this week.')}</div><div id="squadron-metric-expected" class="gate-squadron-value">—</div></article>
        <article class="gate-squadron-metric"><div class="gate-squadron-metric-head">LOCAL TIME</div><div id="squadron-metric-local" class="gate-squadron-value">--:--:--</div></article>
        <article class="gate-squadron-metric"><div class="gate-squadron-metric-head">LAST CONFIRMED ${tooltip('Last Confirmed', 'The last flight into San Antonio tonight.')}</div><div id="squadron-metric-confirmed" class="gate-squadron-value is-time">—</div></article>
      </section>
      <section class="gate-squadron-columns" aria-label="Dorm receiving status">
        ${[['empty','EMPTY','These dorms have not been opened yet.'],['open','OPEN','These dorms have all required trainees and are currently processing at the PRC.'],['closed','CLOSED','These dorms have completed PRC processing.']].map(([state,label,tip]) => `<article class="gate-squadron-column"><header class="gate-squadron-column-head"><span>${label} ${tooltip(label,tip)}</span><span id="squadron-count-${state}" class="gate-squadron-column-count">0</span></header><div id="squadron-col-${state}" class="gate-squadron-column-list"></div></article>`).join('')}
      </section>
      <div id="squadron-status" class="gate-squadron-status" role="status" aria-live="polite">Connecting to GATE…</div>
      <dialog id="squadron-info-dialog" class="gate-squadron-dialog" aria-labelledby="squadron-dialog-title">
        <div class="gate-squadron-dialog-heading"><h2 id="squadron-dialog-title">Squadron Information</h2><button id="squadron-info-close" type="button" class="gate-squadron-utility" aria-label="Close Squadron information">CLOSE</button></div>
        <div id="squadron-instructions" class="gate-squadron-instructions"><p>Loading Squadron information…</p></div>
        <form id="squadron-information-form" class="gate-squadron-editor gate-squadron-information-editor" hidden>
          <div class="gate-squadron-editor-heading"><strong>STANDING INFORMATION</strong><button id="squadron-instruction-add" type="button" class="gate-squadron-utility">ADD INSTRUCTION</button></div>
          <div id="squadron-instruction-fields" class="gate-squadron-instruction-fields"></div>
          <button id="squadron-information-save" type="submit" class="gate-squadron-publish">SAVE INFORMATION</button>
          <div id="squadron-information-status" role="status" aria-live="polite"></div>
        </form>
        <section class="gate-squadron-notice" aria-label="Published operational notice"><h3>LIVE UPDATE</h3><div id="squadron-notice-message">No additional updates published.</div><div id="squadron-notice-time" class="gate-squadron-notice-time"></div></section>
        <form id="squadron-publish-form" class="gate-squadron-editor" hidden><label for="squadron-notice-draft">Publish an operational update (no trainee PII)</label><textarea id="squadron-notice-draft" maxlength="1000" rows="4" placeholder="Enter a short update for Squadron personnel"></textarea><div class="gate-squadron-publish-actions"><button id="squadron-publish" type="submit" class="gate-squadron-publish">PUBLISH UPDATE</button><button id="squadron-clear-notice" type="button" class="gate-squadron-utility" hidden>CLEAR LIVE UPDATE</button></div><div id="squadron-publish-status" role="status" aria-live="polite"></div></form>
      </dialog>
      <div id="squadron-tooltip" class="gate-squadron-tooltip" role="tooltip" hidden></div>
    </div>`;
  }

  function ensureSquadronPage() {
    let page = byId('page-squadron');
    if (!page && !standalone()) {
      const board = byId('page-board');
      if (!board) return null;
      board.insertAdjacentHTML('afterend', '<main id="page-squadron" class="page gate-squadron-page" role="main" aria-label="Squadron Board"></main>');
      page = byId('page-squadron');
    }
    if (!page) return null;
    if (page.dataset.squadronReady !== 'true') {
      page.classList.add('gate-squadron-page');
      page.dataset.component = 'squadron-board';
      page.dataset.owner = 'gate-squadron-board-controller';
      page.innerHTML = markup();
      page.dataset.squadronReady = 'true';
      bindSquadronControls(page);
    }
    return page;
  }

  function visible(page) {
    if (standalone()) return true;
    return Boolean(page && (typeof window.getComputedStyle !== 'function' || window.getComputedStyle(page).display !== 'none'));
  }
  const time = value => {
    const date = new Date(value || '');
    return Number.isFinite(date.getTime()) ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
  };
  function updateSquadronClock() {
    const page = byId('page-squadron');
    if (visible(page)) setText(byId('squadron-metric-local'), new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
  }

  function noticeKey(board) { return `${board.week_group}:${board.notice?.revision || 0}`; }
  function stored(key) { try { return window.sessionStorage?.getItem(key) || ''; } catch { return ''; } }
  function store(key, value) { try { window.sessionStorage?.setItem(key, value); } catch (_) {} }
  function displayNotice(board) {
    const key = noticeKey(board);
    const notice = board.notice;
    const unread = standalone() && Boolean(notice?.message) && stored('gate-squadron-viewed') !== key;
    const button = byId('squadron-information');
    if (button) button.classList.toggle('has-notice', unread);
    if (byId('squadron-new')) byId('squadron-new').hidden = !unread;
    if (standalone() && lastNoticeKey !== null && key !== lastNoticeKey && unread && soundEnabled && !stored(`gate-squadron-alerted:${key}`)) {
      store(`gate-squadron-alerted:${key}`, '1');
      alertSound?.play().catch(() => setText(byId('squadron-status'), 'New update available. Audio blocked; enable alerts in your browser.'));
    }
    lastNoticeKey = key;
    currentNotice = notice;
    const clearButton = byId('squadron-clear-notice');
    if (clearButton) clearButton.hidden = !editor || !notice?.message;
    setText(byId('squadron-notice-message'), notice?.message || 'No additional updates published.');
    setText(byId('squadron-notice-time'), notice?.published_at ? `Published ${time(notice.published_at)}` : '');
  }

  function createInstructionRow(value = '') {
    const row = document.createElement('div');
    row.className = 'gate-squadron-instruction-row';
    const input = document.createElement('textarea');
    input.className = 'gate-squadron-instruction-input';
    input.rows = 2;
    input.maxLength = 500;
    input.value = value;
    input.setAttribute('aria-label', 'Squadron standing instruction');
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'gate-squadron-utility';
    remove.dataset.removeInstruction = 'true';
    remove.textContent = 'DELETE';
    remove.setAttribute('aria-label', 'Delete this Squadron instruction');
    row.append(input, remove);
    return row;
  }

  function renderInstructionEditor(instructions, revision) {
    const fields = byId('squadron-instruction-fields');
    if (!fields) return;
    fields.replaceChildren(...instructions.map(createInstructionRow));
    informationEditRevision = Number(revision || 0);
    informationDirty = false;
  }

  function displayInformation(board) {
    const information = board.information || { revision: 0, instructions: [], published_at: null };
    currentInformation = information;
    const instructions = Array.isArray(information.instructions) ? information.instructions : [];
    const holder = byId('squadron-instructions');
    const signature = JSON.stringify(instructions);
    if (holder && holder.dataset.signature !== signature) {
      const rows = instructions.length ? instructions.map(value => {
        const item = document.createElement('p');
        item.textContent = value;
        return item;
      }) : [Object.assign(document.createElement('p'), { textContent: 'No standing Squadron instructions are currently published.' })];
      holder.replaceChildren(...rows);
      holder.dataset.signature = signature;
    }
    if (!editor) return;
    const fields = byId('squadron-instruction-fields');
    if (!informationDirty && (informationEditRevision !== Number(information.revision || 0) || !fields?.children.length)) {
      renderInstructionEditor(instructions, information.revision);
    } else if (informationDirty && informationEditRevision !== Number(information.revision || 0)) {
      setText(byId('squadron-information-status'), 'Squadron information changed on the server. Refresh before saving.');
    }
  }

  function createCard(id) {
    const card = document.createElement('article');
    card.className = 'gate-squadron-dorm';
    card.dataset.cardId = id;
    card.innerHTML = '<div class="gate-squadron-dorm-top"><strong data-field="name"></strong><span data-field="load"></span></div><div class="gate-squadron-dorm-meta" data-field="meta"></div><div class="gate-squadron-dorm-tags" data-field="tags"></div>';
    return card;
  }
  function updateCard(card, dorm) {
    setText(card.querySelector('[data-field="name"]'), dorm.dorm_name || 'Dorm');
    setText(card.querySelector('[data-field="load"]'), `${dorm.current_load}/${dorm.max_load}`);
    setText(card.querySelector('[data-field="meta"]'), `${dorm.squadron || 'Squadron not listed'}${dorm.section ? ` · Sec ${dorm.section}` : ''}`);
    card.classList.toggle('is-female', dorm.sex === 'female');
    const tags = [dorm.phase, dorm.band && 'BAND', dorm.space_force && 'SPACE FORCE', dorm.load_discrepancy && 'LOAD REVIEW'].filter(Boolean);
    const signature = JSON.stringify(tags);
    const holder = card.querySelector('[data-field="tags"]');
    if (holder.dataset.signature !== signature) {
      holder.replaceChildren(...tags.map(value => { const tag = document.createElement('span'); tag.className = 'gate-squadron-tag'; tag.textContent = value; return tag; }));
      holder.dataset.signature = signature;
    }
  }
  function renderDormCards(board) {
    if (activeWeek !== board.week_group) {
      activeWeek = board.week_group;
      nodes.clear();
      for (const state of ['empty','open','closed']) byId(`squadron-col-${state}`)?.replaceChildren();
    }
    const dorms = Array.isArray(board.dorms) ? board.dorms : [];
    const wanted = new Set(dorms.map(dorm => String(dorm.card_id)));
    for (const [key,node] of nodes) if (!wanted.has(key)) { node.remove(); nodes.delete(key); }
    for (const state of ['empty','open','closed']) {
      const column = byId(`squadron-col-${state}`);
      const members = dorms.filter(dorm => dorm.state === state);
      setText(byId(`squadron-count-${state}`), members.length);
      if (!column) continue;
      for (let index = 0; index < members.length; index += 1) {
        const dorm = members[index];
        const key = String(dorm.card_id);
        let node = nodes.get(key);
        if (!node) { node = createCard(key); nodes.set(key, node); }
        updateCard(node, dorm);
        if (column.children[index] !== node) column.insertBefore(node, column.children[index] || null);
      }
    }
    for (const state of ['empty','open','closed']) {
      const column = byId(`squadron-col-${state}`);
      const count = dorms.filter(dorm => dorm.state === state).length;
      if (!column) continue;
      const blank = column.querySelector('[data-empty-state]');
      if (count && blank) blank.remove();
      if (!count && !blank) {
        const empty = document.createElement('div');
        empty.className = 'gate-squadron-empty-message';
        empty.dataset.emptyState = 'true';
        empty.textContent = 'None';
        column.appendChild(empty);
      }
    }
  }

  function renderBoard(board, canEdit) {
    editor = Boolean(canEdit && !standalone());
    if (byId('squadron-publish-form')) byId('squadron-publish-form').hidden = !editor;
    if (byId('squadron-information-form')) byId('squadron-information-form').hidden = !editor;
    setText(byId('squadron-week-label'), board.week_group ? `ACTIVE · ${board.week_group}` : 'NO ACTIVE WEEK GROUP');
    setText(byId('squadron-metric-arrived'), board.week_group ? board.metrics.arrived : '—');
    setText(byId('squadron-metric-expected'), board.week_group ? board.metrics.expected : '—');
    setText(byId('squadron-metric-confirmed'), board.metrics.last_flight || '—');
    const tempo = byId('squadron-traffic');
    if (tempo) tempo.dataset.tempo = board.week_group ? board.traffic.status : 'UNAVAILABLE';
    const count = Number(board.traffic?.dispatched_last_60_minutes || 0);
    setText(byId('squadron-traffic-detail'), board.week_group ? `${count} airport ${count === 1 ? 'bus' : 'buses'} dispatched in the last 60 minutes` : 'No active Week Group');
    renderDormCards(board);
    displayInformation(board);
    displayNotice(board);
    setText(byId('squadron-status'), `Read-only SITREP · last refresh ${time(board.generated_at)}${board.week_group ? '' : ' · no active group'}`);
    byId('squadron-status')?.classList.remove('is-error');
  }

  async function renderSquadronBoard() {
    const page = ensureSquadronPage();
    if (!visible(page) || polling) return;
    polling = true;
    lastPoll = Date.now();
    try {
      const response = await fetch('/api/squadron-board', { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } });
      if ((response.status === 401 || response.status === 403) && standalone()) {
        window.location.replace('/login/');
        return;
      }
      const data = await response.json();
      if (!response.ok || !data.isOk || !data.board) throw new Error(data.error || 'Squadron data unavailable.');
      renderBoard(data.board, data.editor);
    } catch (error) {
      const status = byId('squadron-status');
      setText(status, `Data unavailable · ${error.message || 'Unable to refresh.'} · showing last confirmed snapshot`);
      status?.classList.add('is-error');
    } finally { polling = false; }
  }

  function bindSquadronControls(page) {
    const dialog = byId('squadron-info-dialog');
    const opener = byId('squadron-information');
    opener?.addEventListener('click', () => {
      if (currentNotice && standalone()) {
        store('gate-squadron-viewed', `${activeWeek}:${currentNotice.revision}`);
        opener.classList.remove('has-notice');
        if (byId('squadron-new')) byId('squadron-new').hidden = true;
      }
      if (!dialog.open) dialog.showModal();
    });
    byId('squadron-info-close')?.addEventListener('click', () => dialog.close());
    dialog?.addEventListener('close', () => opener?.focus());
    const tip = byId('squadron-tooltip');
    const showTip = button => {
      if (!tip) return;
      tip.textContent = button.dataset.squadronTip || '';
      tip.hidden = false;
      const bounds = button.getBoundingClientRect();
      const width = tip.getBoundingClientRect().width;
      const height = tip.getBoundingClientRect().height;
      tip.style.left = `${Math.max(12, Math.min(bounds.left, window.innerWidth - width - 12))}px`;
      tip.style.top = `${bounds.bottom + height + 12 < window.innerHeight ? bounds.bottom + 8 : Math.max(8, bounds.top - height - 8)}px`;
      button.setAttribute('aria-describedby', 'squadron-tooltip');
    };
    const hideTip = button => { if (tip) tip.hidden = true; button?.removeAttribute('aria-describedby'); };
    page.querySelectorAll('[data-squadron-tip]').forEach(button => {
      button.addEventListener('mouseenter', () => showTip(button));
      button.addEventListener('mouseleave', () => hideTip(button));
      button.addEventListener('focus', () => showTip(button));
      button.addEventListener('blur', () => hideTip(button));
      button.addEventListener('click', () => tip.hidden ? showTip(button) : hideTip(button));
      button.addEventListener('keydown', event => { if (event.key === 'Escape') { hideTip(button); event.stopPropagation(); } });
    });
    page.addEventListener('keydown', event => { if (event.key === 'Escape') page.querySelectorAll('[data-squadron-tip]').forEach(hideTip); });
    byId('squadron-enable-sound')?.addEventListener('click', () => {
      alertSound = alertSound || new Audio('/assets/sr_bus_sound.mp3');
      alertSound.preload = 'auto';
      // An explicit user gesture is required. A blocked playback never suppresses the visual notice.
      alertSound.muted = true;
      alertSound.play().then(() => { alertSound.pause(); alertSound.currentTime = 0; alertSound.muted = false; soundEnabled = true; setText(byId('squadron-enable-sound'), 'ALERTS ENABLED'); }).catch(() => {
        soundEnabled = false;
        setText(byId('squadron-status'), 'Audio blocked. Browser permission is required for sound.');
      });
    });
    byId('squadron-logout')?.addEventListener('click', async () => {
      try { await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }); } catch (_) {}
      window.location.replace('/login/');
    });
    const informationForm = byId('squadron-information-form');
    const instructionFields = byId('squadron-instruction-fields');
    informationForm?.addEventListener('input', () => { informationDirty = true; });
    byId('squadron-instruction-add')?.addEventListener('click', () => {
      if (!editor || !instructionFields) return;
      if (instructionFields.children.length >= 8) {
        setText(byId('squadron-information-status'), 'A maximum of eight standing instructions is allowed.');
        return;
      }
      instructionFields.appendChild(createInstructionRow(''));
      informationDirty = true;
      instructionFields.lastElementChild?.querySelector('textarea')?.focus();
    });
    instructionFields?.addEventListener('click', event => {
      const remove = event.target.closest?.('[data-remove-instruction]');
      if (!remove || !editor) return;
      remove.closest('.gate-squadron-instruction-row')?.remove();
      informationDirty = true;
    });
    informationForm?.addEventListener('submit', async event => {
      event.preventDefault();
      if (!editor) return;
      const status = byId('squadron-information-status');
      const values = Array.from(instructionFields?.querySelectorAll('.gate-squadron-instruction-input') || []).map(input => input.value.trim()).filter(Boolean);
      if (values.length > 8 || values.some(value => value.length > 500)) {
        setText(status, 'Use no more than eight instructions, with 500 characters maximum per instruction.');
        return;
      }
      const button = byId('squadron-information-save');
      button.disabled = true;
      try {
        const response = await fetch('/api/squadron-board', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', 'X-Gate-Information': 'save' },
          body: JSON.stringify({ instructions: values, expected_revision: informationEditRevision })
        });
        const data = await response.json();
        if (!response.ok || !data.isOk || !data.information) throw new Error(data.error || 'Save failed.');
        currentInformation = data.information;
        informationDirty = false;
        informationEditRevision = data.information.revision;
        setText(status, 'Squadron information saved.');
        await renderSquadronBoard();
      } catch (error) {
        setText(status, `${error.message || 'Unable to save Squadron information.'} Refresh before retrying.`);
      } finally {
        button.disabled = false;
      }
    });

    byId('squadron-clear-notice')?.addEventListener('click', async () => {
      if (!editor || !currentNotice?.message) return;
      if (!window.confirm('Clear the current Live Update?')) return;
      const button = byId('squadron-clear-notice');
      const status = byId('squadron-publish-status');
      button.disabled = true;
      try {
        const response = await fetch('/api/squadron-board', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', 'X-Gate-Notice': 'clear' },
          body: JSON.stringify({ expected_revision: currentNotice.revision })
        });
        const data = await response.json();
        if (!response.ok || !data.isOk || !data.cleared) throw new Error(data.error || 'Clear failed.');
        setText(status, 'Live Update cleared from Squadron Board.');
        await renderSquadronBoard();
      } catch (error) {
        setText(status, `${error.message || 'Unable to clear Live Update.'} Refresh before retrying.`);
      } finally {
        button.disabled = false;
      }
    });

    byId('squadron-publish-form')?.addEventListener('submit', async event => {
      event.preventDefault();
      if (!editor) return;
      const draft = String(byId('squadron-notice-draft')?.value || '').trim();
      const status = byId('squadron-publish-status');
      if (!draft || draft.length > 1000) { setText(status, 'Enter 1–1000 characters.'); return; }
      const button = byId('squadron-publish');
      button.disabled = true;
      try {
        const response = await fetch('/api/squadron-board', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Gate-Notice': 'publish' }, body: JSON.stringify({ message: draft, expected_revision: currentNotice?.revision || 0 }) });
        const data = await response.json();
        if (!response.ok || !data.isOk) throw new Error(data.error || 'Publish failed.');
        byId('squadron-notice-draft').value = '';
        setText(status, 'Update published to Squadron Board.');
        await renderSquadronBoard();
      } catch (error) { setText(status, `${error.message || 'Unable to publish.'} Refresh before retrying.`); }
      finally { button.disabled = false; }
    });
  }

  function computeDormElapsedTimer(dorm) {
    if (!dorm || !dorm.opened_at) return dorm?.closed_timer || '00:00';
    if (typeof getElapsedTimer === 'function') {
      try { const timer = getElapsedTimer(dorm.opened_at); if (timer?.text) return timer.text; } catch (_) {}
    }
    const opened = new Date(dorm.opened_at);
    if (Number.isNaN(opened.getTime())) return dorm.closed_timer || '00:00';
    const seconds = Math.max(0, Math.floor((Date.now() - opened.getTime()) / 1000));
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }

  function patchCloseDormTiming() {
    try {
      if (closeDormPatched || typeof closeDorm !== 'function') return;
      const gateCloseDorm = async function gateCloseDorm(id) {
        if (typeof currentRole !== 'undefined' && currentRole !== 'instructor') return;
        const dorm = Array.isArray(allData) ? allData.find(record => record.__backendId === id) : null;
        if (!dorm) return;
        const finalTime = computeDormElapsedTimer(dorm);
        const result = await window.dataSdk.update({ ...dorm, state: 'closed', phase: 'Closed', closed_timer: finalTime, closed_at: new Date().toISOString() });
        if (result?.isOk && typeof createSoundEvent === 'function') await createSoundEvent('dorm_closed', { dorm_id: id, dorm_name: dorm.dorm_name || '', final_time: finalTime, action: 'close_dorm' });
        if (typeof closeDormModal === 'function') closeDormModal();
      };
      gateCloseDorm.__gateDormBoardController = true;
      window.closeDorm = gateCloseDorm;
      try { closeDorm = gateCloseDorm; } catch (_) {}
      closeDormPatched = true;
    } catch (error) { console.warn('GATE close dorm timing patch failed:', error); }
  }

  function start() {
    if (installed) return;
    installed = true;
    ensureDocumentIdentity();
    ensureSquadronPage();
    patchCloseDormTiming();
    window.GateComponents?.processingDormModalContract?.();
    window.registerGateHook?.('afterPageChange', () => { if (Date.now() - lastPoll > 500) renderSquadronBoard(); });
    window.GateDormBoardController = Object.freeze({ isCanonicalOwner: false, handoffOwner: 'gate-status-board-controller', refresh: renderSquadronBoard, renderSquadronBoard, computeDormElapsedTimer });
    window.setInterval(updateSquadronClock, 1000);
    window.setInterval(renderSquadronBoard, POLL_MS);
    updateSquadronClock();
    renderSquadronBoard();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  window.addEventListener('load', start, { once: true });
})();
