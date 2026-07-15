import { classNames, escapeAttribute, escapeHtml, renderActions, toId } from './render-utils.mjs';
import { renderGateStatusPill } from './renderers-core.mjs';

function fact(label, value) {
  return `<div class="gate-fact"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value ?? '—')}</dd></div>`;
}

export function renderGateDormCard(props = {}) {
  const id = toId(props.id || props.name || 'dorm');
  const state = escapeAttribute(props.state || 'empty');
  const classes = classNames('gate-dorm-card', {
    'is-female': String(props.sex || '').toLowerCase() === 'female',
    'is-band': props.band,
    'is-space-force': props.spaceForce,
    'is-selected': props.selected,
    'is-overtime': props.overtime
  });
  const flags = [
    props.band ? renderGateStatusPill({ state: 'processing', label: 'Band' }) : '',
    props.spaceForce ? renderGateStatusPill({ state: 'processing', label: 'Space Force' }) : '',
    props.overtime ? renderGateStatusPill({ state: 'overtime', label: 'Overtime', live: true }) : ''
  ].filter(Boolean).join('');
  const timer = props.timer ? `<time class="gate-dorm-card__timer" datetime="${escapeAttribute(props.timer)}">${escapeHtml(props.timer)}</time>` : '';
  return `<article class="${classes}" data-gate-component="GateDormCard" data-record-id="${escapeAttribute(props.id || '')}" data-state="${state}" aria-labelledby="${id}-title"><header><div><h3 id="${id}-title">${escapeHtml(props.name || 'Dorm')}</h3>${renderGateStatusPill({ state: state === 'open' ? 'processing' : state === 'closed' ? 'closed' : 'stale', label: state })}</div>${timer}</header>${flags ? `<div class="gate-dorm-card__flags">${flags}</div>` : ''}<dl class="gate-fact-grid">${fact('Load', `${Number(props.load || 0)} / ${Number(props.capacity || 0)}`)}${fact('Location', props.location)}${fact('Assigned', props.assignedStaff)}</dl>${props.actions?.length ? `<footer class="gate-card-actions">${renderActions(props.actions)}</footer>` : ''}</article>`;
}

export function renderGateBusCard(props = {}) {
  const id = toId(props.id || props.label || 'bus');
  const status = escapeAttribute(props.status || 'active');
  const statusLabel = status === 'arrived' ? 'Arrived' : status === 'active' ? 'En route' : status;
  const facts = [
    ['OTW', Number(props.total || 0)],
    ['Female', Number(props.female || 0)],
    ['NAT', Number(props.naturalization || 0)],
    ['Space Force', Number(props.spaceForce || 0)],
    ['Departure', props.departureTime],
    ['Arrival', props.arrivalTime]
  ];
  return `<article class="gate-bus-card" data-gate-component="GateBusCard" data-record-id="${escapeAttribute(props.id || '')}" data-state="${status}" aria-labelledby="${id}-title"><header><h3 id="${id}-title">${escapeHtml(props.label || 'Bus')}</h3>${renderGateStatusPill({ state: status === 'arrived' ? 'arrived' : 'enroute', label: statusLabel })}</header><dl class="gate-fact-grid">${facts.map(([label, value]) => fact(label, value)).join('')}</dl>${props.actions?.length ? `<footer class="gate-card-actions">${renderActions(props.actions)}</footer>` : ''}</article>`;
}

export function renderGateDataTable(props = {}) {
  const columns = Array.isArray(props.columns) ? props.columns : [];
  const rows = Array.isArray(props.rows) ? props.rows : [];
  const caption = escapeHtml(props.caption || 'Data table');
  const headers = columns.map(column => `<th scope="col">${escapeHtml(column.label || column.key)}</th>`).join('');
  const body = rows.length
    ? rows.map(row => `<tr>${columns.map((column, index) => `${index === 0 ? '<th scope="row">' : '<td>'}${escapeHtml(row?.[column.key] ?? '—')}${index === 0 ? '</th>' : '</td>'}`).join('')}</tr>`).join('')
    : `<tr><td colspan="${Math.max(columns.length, 1)}" class="gate-data-table__empty">${escapeHtml(props.emptyMessage || 'No records')}</td></tr>`;
  return `<div class="gate-data-table-wrap" data-gate-component="GateDataTable" tabindex="0" role="region" aria-label="${escapeAttribute(props.caption || 'Data table')}"><table class="gate-data-table"><caption>${caption}</caption><thead><tr>${headers}</tr></thead><tbody>${body}</tbody></table></div>`;
}

export function renderGateDialog(props = {}) {
  const id = toId(props.id || props.title || 'gate-dialog');
  const descriptionId = props.description ? `${id}-description` : '';
  return `<dialog class="gate-dialog" data-gate-component="GateDialog" id="${id}" aria-labelledby="${id}-title"${descriptionId ? ` aria-describedby="${descriptionId}"` : ''}><div class="gate-dialog__surface"><header><h2 id="${id}-title">${escapeHtml(props.title || 'Dialog')}</h2><button class="gate-dialog__close" type="button" data-gate-action="close" aria-label="Close ${escapeAttribute(props.title || 'dialog')}">×</button></header>${props.description ? `<p id="${descriptionId}">${escapeHtml(props.description)}</p>` : ''}<div class="gate-dialog__body">${props.body || ''}</div><footer>${renderActions(props.actions || [])}</footer></div></dialog>`;
}

export function renderGateSheet(props = {}) {
  const id = toId(props.id || props.title || 'gate-sheet');
  const placement = escapeAttribute(props.placement || 'side');
  return `<section class="gate-sheet gate-sheet--${placement}" data-gate-component="GateSheet" id="${id}" role="dialog" aria-modal="true" aria-labelledby="${id}-title" hidden><div class="gate-sheet__surface"><header><h2 id="${id}-title">${escapeHtml(props.title || 'Sheet')}</h2><button class="gate-sheet__close" type="button" data-gate-action="close" aria-label="Close ${escapeAttribute(props.title || 'sheet')}">×</button></header>${props.description ? `<p>${escapeHtml(props.description)}</p>` : ''}<div class="gate-sheet__body">${props.body || ''}</div><footer>${renderActions(props.actions || [])}</footer></div></section>`;
}
