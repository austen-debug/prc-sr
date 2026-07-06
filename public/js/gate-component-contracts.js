// PRC GATE Component Contracts
// Stable render helpers for core UI components. Does not call APIs or alter data.
(function () {
  function n(value) {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function esc(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function clean(value, fallback = '—') {
    const text = String(value ?? '').trim();
    return text ? text : fallback;
  }

  function isFemaleDorm(dorm) {
    const sex = String(dorm?.sex || '').trim().toLowerCase();
    return sex === 'female' || sex === 'f';
  }

  function isBandDorm(dorm) {
    return dorm?.band === true || dorm?.band === 'true';
  }

  function isSpaceForceDorm(dorm) {
    return dorm && (
      dorm.space_force === true ||
      dorm.space_force === 'true' ||
      dorm.is_space_force === true ||
      dorm.is_space_force === 'true'
    );
  }

  function effectiveDormFlags(dorm) {
    const female = isFemaleDorm(dorm);
    const spaceForce = isSpaceForceDorm(dorm);
    const band = !spaceForce && isBandDorm(dorm);
    return { female, band, spaceForce, hasBanner: band || spaceForce };
  }

  function dormStatusLabel(dorm) {
    if (!dorm) return '';
    if (dorm.state === 'closed') return 'CLOSED';
    if (dorm.state === 'empty') return 'EMPTY';
    return String(dorm.phase || 'OPEN').trim() || 'OPEN';
  }

  function dormLoad(dorm) {
    const current = n(dorm?.current_load ?? dorm?.loaded);
    const max = n(dorm?.max_load);
    const width = max > 0 ? Math.min((current / max) * 100, 100) : 0;
    return { current, max, width, isFull: max > 0 && current === max, isOver: max > 0 && current > max };
  }

  function dormTimerHtml(dorm) {
    const state = String(dorm?.state || 'empty').toLowerCase();

    if (state === 'open' && dorm?.opened_at) {
      const timer = typeof window.getElapsedTimer === 'function'
        ? window.getElapsedTimer(dorm.opened_at)
        : { text: '00:00' };
      return `<div class="gate-dorm-timer timer-display" data-opened="${esc(dorm.opened_at)}" data-dorm-id="${esc(dorm.__backendId)}">${esc(timer.text)}</div>`;
    }

    if (state === 'closed' && dorm?.closed_timer) {
      return `<div class="gate-dorm-timer text-muted">${esc(dorm.closed_timer)}</div>`;
    }

    return '<div class="gate-dorm-timer gate-empty-timer">00:00</div>';
  }

  function dormBannerHtml(dorm, flags = effectiveDormFlags(dorm)) {
    if (flags.spaceForce) return '<div class="gate-dorm-top-banner banner-space-force">Space Force</div>';
    if (flags.band) return '<div class="gate-dorm-top-banner banner-band">Band</div>';
    return '';
  }

  function dormCard(dorm, options = {}) {
    const load = dormLoad(dorm);
    const state = String(dorm?.state || 'empty').toLowerCase();
    const status = dormStatusLabel(dorm);
    const info = [esc(dorm?.sdq), esc(dorm?.section), esc(dorm?.inter_sec)].filter(Boolean).join(' · ');
    const flagsState = effectiveDormFlags(dorm);
    const component = flagsState.spaceForce ? 'space-force' : 'air-force';
    const flags = [
      flagsState.female ? 'border-female' : '',
      flagsState.band ? 'border-band' : '',
      flagsState.spaceForce ? 'border-space-force' : '',
      flagsState.hasBanner ? 'gate-dorm-has-banner' : '',
      state === 'closed' ? 'dorm-closed' : '',
      load.isOver ? 'is-over' : (load.isFull ? 'is-full' : '')
    ].filter(Boolean).join(' ');

    const airman = options.hideAirman ? '' : esc(dorm?.assigned_airman || '');
    const auditorium = options.showAuditorium && dorm?.auditorium_location
      ? `<div class="gate-auditorium-location">${esc(dorm.auditorium_location)}</div>`
      : '';
    const banner = dormBannerHtml(dorm, flagsState);

    return `
      <div class="dorm-card tactical-glass-card gate-dorm-card gate-component-dorm-card gate-dorm-state-${esc(state)} ${flags}" data-component="dorm-card" data-dorm-id="${esc(dorm?.__backendId || '')}" data-state="${esc(state)}" data-component-type="${esc(component)}" data-female-dorm="${flagsState.female ? 'true' : 'false'}" data-band-dorm="${flagsState.band ? 'true' : 'false'}" data-space-force="${flagsState.spaceForce ? 'true' : 'false'}" data-has-banner="${flagsState.hasBanner ? 'true' : 'false'}">
        ${banner}
        <div class="gate-dorm-name">${esc(dorm?.dorm_name || '')}</div>
        <div class="gate-dorm-airman">${airman}</div>
        ${auditorium}
        <div class="gate-dorm-info">${info || '&nbsp;'}</div>
        <div class="gate-dorm-status-wrap">
          <div class="gate-dorm-status" data-state="${esc(state)}">${esc(status)}</div>
        </div>
        ${dormTimerHtml(dorm)}
        <div class="gate-dorm-load">${load.current} / ${load.max}</div>
        <div class="gate-dorm-progress" aria-hidden="true">
          <div class="gate-dorm-progress-fill" style="width:${load.width.toFixed(1)}%;"></div>
        </div>
      </div>
    `;
  }

  function statusMetric({ id = '', label = '', value = '0' } = {}) {
    const idAttr = id ? ` id="${esc(id)}"` : '';
    return `
      <div class="gate-squadron-metric gate-component-status-metric" data-component="status-metric">
        <div class="gate-squadron-metric-label">${esc(label)}</div>
        <div${idAttr} class="gate-squadron-metric-value">${esc(value)}</div>
      </div>
    `;
  }

  function navButton({ page = '', label = '', active = false } = {}) {
    const activeClass = active ? 'active active-page-state current-page' : '';
    const current = active ? 'page' : 'false';
    return `<button type="button" class="nav-btn nav-link-item gate-component-nav-button ${activeClass}" data-component="nav-button" data-page="${esc(page)}" aria-current="${current}" onclick="showPage('${esc(page)}')">${esc(label || page)}</button>`;
  }

  function archiveRecordCard(record) {
    const id = esc(record?.__backendId || '');
    const date = new Date(record?.archived_at || record?.created_at || record?.updated_at || '');
    const dateText = Number.isNaN(date.getTime())
      ? 'No archive timestamp'
      : date.toLocaleString([], { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    return `
      <button type="button" class="gate-archive-record-card gate-component-archive-record" data-component="archive-record" data-archive-id="${id}" title="Open archived week group">
        <span>
          <span class="gate-archive-record-title">${esc(record?.week_group || 'Archived Week Group')}</span>
          <span class="gate-archive-record-meta">Archived ${esc(dateText)}</span>
        </span>
        <span class="gate-archive-record-stats" aria-label="Archive statistics">
          <span class="gate-archive-stat-pill">${n(record?.dorm_count)} Dorms</span>
          <span class="gate-archive-stat-pill">${n(record?.bus_count)} Buses</span>
          <span class="gate-archive-stat-pill">${n(record?.total_arrived)} Arrived</span>
          <span class="gate-archive-stat-pill">${n(record?.female_total)} Female</span>
          <span class="gate-archive-stat-pill">${n(record?.nat_total)} NAT</span>
        </span>
      </button>
    `;
  }

  function processingDormModalContract() {
    const modal = document.getElementById('dorm-modal');
    if (!modal) return;
    modal.dataset.component = 'processing-dorm-modal';
    modal.querySelector('.modal-content')?.setAttribute('data-component', 'processing-dorm-modal-shell');
    modal.querySelector('#modal-phase-buttons')?.setAttribute('data-component', 'processing-phase-controls');
    modal.querySelector('#modal-load-section')?.setAttribute('data-component', 'processing-load-controls');
    modal.querySelector('#modal-action-section')?.setAttribute('data-component', 'processing-action-controls');
  }

  window.GateComponents = Object.freeze({
    n,
    esc,
    clean,
    isFemaleDorm,
    isBandDorm,
    isSpaceForceDorm,
    effectiveDormFlags,
    dormStatusLabel,
    dormLoad,
    dormBannerHtml,
    dormCard,
    statusMetric,
    navButton,
    archiveRecordCard,
    processingDormModalContract
  });
})();
