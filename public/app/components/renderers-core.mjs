import { classNames, escapeAttribute, escapeHtml, renderActions, toId } from './render-utils.mjs';

export function renderGateButton(props = {}) {
  const variant = escapeAttribute(props.variant || 'primary');
  const label = escapeHtml(props.label || 'Button');
  const type = ['button', 'submit', 'reset'].includes(props.type) ? props.type : 'button';
  const action = escapeAttribute(props.action || 'activate');
  const disabled = props.disabled || props.loading;
  const stateText = props.loading ? '<span class="gate-button__status" aria-hidden="true">Saving</span>' : '';
  return `<button class="gate-button gate-button--${variant}" type="${type}" data-gate-component="GateButton" data-gate-action="${action}"${disabled ? ' disabled aria-disabled="true"' : ''}${props.loading ? ' aria-busy="true"' : ''}><span class="gate-button__label">${label}</span>${stateText}</button>`;
}

export function renderGateStatusPill(props = {}) {
  const state = escapeAttribute(props.state || 'processing');
  const label = escapeHtml(props.label || state);
  const live = props.live ? ' role="status" aria-live="polite"' : '';
  return `<span class="gate-status-pill" data-gate-component="GateStatusPill" data-state="${state}"${live}><span class="gate-status-pill__marker" aria-hidden="true"></span><span>${label}</span></span>`;
}

export function renderGateMetricCard(props = {}) {
  const variant = escapeAttribute(props.variant || 'standard');
  const state = escapeAttribute(props.state || 'default');
  const label = escapeHtml(props.label || 'Metric');
  const value = escapeHtml(props.value ?? '—');
  const supporting = props.supportingText ? `<p class="gate-metric-card__support">${escapeHtml(props.supportingText)}</p>` : '';
  return `<section class="gate-metric-card gate-metric-card--${variant}" data-gate-component="GateMetricCard" data-state="${state}" aria-label="${escapeAttribute(props.label || 'Metric')}"><span class="gate-metric-card__label">${label}</span><strong class="gate-metric-card__value">${value}</strong>${supporting}</section>`;
}

export function renderGateFormField(props = {}) {
  const id = toId(props.id || props.label || 'gate-field');
  const type = ['text', 'number', 'datetime-local', 'search', 'email', 'password'].includes(props.type) ? props.type : 'text';
  const label = escapeHtml(props.label || 'Field');
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const describedBy = [props.helpText ? helpId : '', props.errorText ? errorId : ''].filter(Boolean).join(' ');
  const help = props.helpText ? `<p class="gate-form-field__help" id="${helpId}">${escapeHtml(props.helpText)}</p>` : '';
  const error = props.errorText ? `<p class="gate-form-field__error" id="${errorId}" role="alert">${escapeHtml(props.errorText)}</p>` : '';
  const value = escapeAttribute(props.value ?? '');
  return `<div class="gate-form-field" data-gate-component="GateFormField" data-state="${props.errorText ? 'invalid' : escapeAttribute(props.state || 'default')}"><label for="${id}">${label}${props.required ? '<span aria-hidden="true"> *</span>' : ''}</label><input id="${id}" name="${escapeAttribute(props.name || id)}" type="${type}" value="${value}"${describedBy ? ` aria-describedby="${describedBy}"` : ''}${props.errorText ? ' aria-invalid="true"' : ''}${props.required ? ' required' : ''}${props.disabled ? ' disabled' : ''}${props.readonly ? ' readonly' : ''}>${help}${error}</div>`;
}

export function renderGateNotification(props = {}) {
  const variant = escapeAttribute(props.variant || 'info');
  const urgent = variant === 'error';
  const title = props.title ? `<strong class="gate-notification__title">${escapeHtml(props.title)}</strong>` : '';
  const dismiss = props.dismissible ? '<button class="gate-notification__dismiss" type="button" data-gate-action="dismiss" aria-label="Dismiss notification">×</button>' : '';
  const action = props.action ? renderGateButton({ ...props.action, variant: props.action.variant || 'quiet' }) : '';
  return `<section class="gate-notification" data-gate-component="GateNotification" data-variant="${variant}" role="${urgent ? 'alert' : 'status'}" aria-live="${urgent ? 'assertive' : 'polite'}">${title}<p>${escapeHtml(props.message || '')}</p>${action}${dismiss}</section>`;
}

export function renderGatePageHeader(props = {}) {
  const variant = escapeAttribute(props.variant || 'standard');
  const eyebrow = props.eyebrow ? `<p class="gate-page-header__eyebrow">${escapeHtml(props.eyebrow)}</p>` : '';
  const description = props.description ? `<p class="gate-page-header__description">${escapeHtml(props.description)}</p>` : '';
  const status = props.status ? renderGateStatusPill(props.status) : '';
  const actions = renderActions(props.actions || []);
  return `<header class="gate-page-header gate-page-header--${variant}" data-gate-component="GatePageHeader"><div class="gate-page-header__content">${eyebrow}<h1>${escapeHtml(props.title || 'Page')}</h1>${description}${status}</div>${actions ? `<div class="gate-page-header__actions">${actions}</div>` : ''}</header>`;
}

export function renderGateCommandBar(props = {}) {
  const variant = escapeAttribute(props.variant || 'page');
  const state = escapeAttribute(props.state || 'default');
  const context = props.context ? `<span class="gate-command-bar__context">${escapeHtml(props.context)}</span>` : '';
  const persistence = props.persistenceState ? renderGateStatusPill({ state: props.persistenceState, label: props.persistenceLabel || props.persistenceState, live: true }) : '';
  return `<div class="gate-command-bar gate-command-bar--${variant}" data-gate-component="GateCommandBar" data-state="${state}" role="toolbar" aria-label="${escapeAttribute(props.label || 'Page actions')}"><div class="gate-command-bar__context-group">${context}${persistence}</div><div class="gate-command-bar__actions">${renderActions(props.actions || [])}</div></div>`;
}
