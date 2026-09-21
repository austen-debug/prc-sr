/** Presentation-only relocation: retain the original buttons, IDs and canonical listeners. */
const byId = (doc, id) => doc.getElementById(id);

function actionPanel(doc, id, heading, description, destructive = false) {
  const panel = doc.createElement('div');
  panel.id = id;
  panel.className = 'rounded-lg border p-3 grid gap-2';
  panel.style.minWidth = '0';
  panel.style.borderColor = destructive ? 'var(--mg-red, #dc2626)' : 'var(--mg-border-glass, var(--border))';
  panel.style.background = destructive
    ? 'color-mix(in srgb, var(--mg-red, #dc2626) 6%, var(--mg-surface, transparent))'
    : 'var(--mg-surface, var(--surface))';

  const title = doc.createElement('strong');
  title.className = 'text-xs uppercase tracking-wider';
  title.textContent = heading;
  if (destructive) title.style.color = 'var(--mg-red, #dc2626)';

  const help = doc.createElement('p');
  help.id = `${id}-description`;
  help.className = 'text-xs text-muted';
  help.textContent = description;
  panel.append(title, help);
  return panel;
}

export function relocateWeekGroupActions(doc = globalThis.document) {
  if (!doc) return false;
  const page = byId(doc, 'page-input');
  const processing = byId(doc, 'page-processing');
  const weekGroupInput = byId(doc, 'wg-batch-input');
  const header = weekGroupInput?.closest('.flex-shrink-0');
  const initialize = byId(doc, 'init-wg-btn');
  const closeout = byId(doc, 'closeout-btn');
  if (!page || !processing || !header || !page.contains(header) || !initialize || !closeout) return false;

  let section = byId(doc, 'gate-week-group-actions');
  if (!section) {
    section = doc.createElement('section');
    section.id = 'gate-week-group-actions';
    section.className = 'mt-3 rounded-lg border p-3 grid gap-2';
    section.style.minWidth = '0';
    section.style.borderColor = 'var(--mg-border-glass, var(--border))';
    section.style.background = 'var(--mg-surface-soft, var(--surface-alt))';
    section.setAttribute('aria-label', 'Week Group management actions');
    section.dataset.owner = 'gate-week-group-action-placement';

    const heading = doc.createElement('strong');
    heading.className = 'text-sm';
    heading.textContent = 'WEEK GROUP MANAGEMENT';

    const controls = doc.createElement('div');
    controls.id = 'gate-week-group-action-buttons';
    controls.className = 'grid gap-3';
    controls.style.minWidth = '0';
    controls.style.gridTemplateColumns = 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))';
    controls.append(
      actionPanel(doc, 'gate-week-group-initialize-panel', 'Start a new Week Group',
        'Review the configuration and expected load before initialization.'),
      actionPanel(doc, 'gate-week-group-closeout-panel', 'Finish the active Week Group',
        'Archives and verifies a snapshot before clearing active records. Confirmation is required.', true)
    );
    section.append(heading, controls);
    header.insertBefore(section, header.firstElementChild?.nextSibling || null);
  }

  const initializePanel = byId(doc, 'gate-week-group-initialize-panel');
  const closeoutPanel = byId(doc, 'gate-week-group-closeout-panel');
  if (!initializePanel || !closeoutPanel) return false;

  const oldFooter = initialize.parentElement;
  initialize.type = 'button';
  initialize.style.width = '100%';
  initialize.style.minHeight = '48px';
  initialize.style.background = 'var(--mg-yellow, #e0a62c)';
  initialize.style.color = 'var(--mg-bg-elevated, #181e26)';
  initialize.setAttribute('aria-describedby', 'gate-week-group-initialize-panel-description');
  if (initialize.parentElement !== initializePanel) initializePanel.appendChild(initialize);

  closeout.type = 'button';
  closeout.style.width = '100%';
  closeout.style.minHeight = '44px';
  closeout.style.fontSize = '.85rem';
  closeout.setAttribute('aria-describedby', 'gate-week-group-closeout-panel-description');
  if (closeout.parentElement !== closeoutPanel) closeoutPanel.appendChild(closeout);

  const initStatus = byId(doc, 'init-status-msg');
  if (initStatus) {
    initStatus.setAttribute('role', 'status');
    initStatus.setAttribute('aria-live', 'polite');
    if (initStatus.parentElement !== initializePanel) initializePanel.appendChild(initStatus);
  }

  let archiveStatus = byId(doc, 'closeout-safety-msg');
  if (!archiveStatus) {
    archiveStatus = doc.createElement('div');
    archiveStatus.id = 'closeout-safety-msg';
    archiveStatus.className = 'text-xs font-bold text-muted';
    archiveStatus.style.minHeight = '20px';
  }
  archiveStatus.setAttribute('role', 'status');
  archiveStatus.setAttribute('aria-live', 'polite');
  if (archiveStatus.parentElement !== closeoutPanel) closeoutPanel.appendChild(archiveStatus);

  // Remove only the now-empty original Input footer, never another surface.
  if (oldFooter && oldFooter !== initializePanel && oldFooter.parentElement === page &&
      oldFooter.classList.contains('border-t') && !oldFooter.children.length &&
      !oldFooter.textContent.trim()) oldFooter.remove();
  return true;
}

function start() {
  if (!relocateWeekGroupActions()) return;
  // Page-shell refreshes can replace markup. Re-run without cloning buttons or handlers.
  for (const hook of ['afterPageChange', 'afterRenderAll', 'afterCloseout']) {
    globalThis.registerGateHook?.(hook, () => globalThis.requestAnimationFrame?.(() => relocateWeekGroupActions()));
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}

// The existing Input feature is the single bootstrap point for the feature-gated persistence adapter.
// Never load the browser runtime in Node-based module tests.
if (typeof window !== 'undefined') {
  import('../../../js/gate-persistence-runtime.js').catch(error => console.error('GATE persistence runtime unavailable:', error));
}
