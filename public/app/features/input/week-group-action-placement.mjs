/** Presentation-only relocation: retain the original buttons, IDs and their canonical listeners. */
const byId = (doc, id) => doc.getElementById(id);

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
    section.className = 'mt-3 rounded-lg border p-3 grid gap-3';
    section.style.borderColor = 'var(--border)';
    section.style.background = 'var(--surface-alt)';
    section.setAttribute('aria-label', 'Week Group management actions');
    section.dataset.owner = 'gate-week-group-action-placement';

    const heading = doc.createElement('div');
    const label = doc.createElement('strong');
    label.className = 'text-sm';
    label.textContent = 'WEEK GROUP MANAGEMENT';
    const help = doc.createElement('p');
    help.className = 'text-xs text-muted';
    help.textContent = 'Initialize after configuration; close out and archive the active Week Group when operations are complete.';
    heading.append(label, help);

    const controls = doc.createElement('div');
    controls.id = 'gate-week-group-action-buttons';
    controls.className = 'grid gap-3';
    controls.style.gridTemplateColumns = 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))';

    const messages = doc.createElement('div');
    messages.id = 'gate-week-group-action-messages';
    messages.className = 'grid gap-1';
    messages.setAttribute('aria-live', 'polite');

    section.append(heading, controls, messages);
    header.insertBefore(section, header.firstElementChild?.nextSibling || null);
  }

  const controls = byId(doc, 'gate-week-group-action-buttons');
  const messages = byId(doc, 'gate-week-group-action-messages');
  if (!controls || !messages) return false;

  const oldFooter = initialize.parentElement;
  for (const button of [initialize, closeout]) {
    button.type = 'button';
    button.style.width = '100%';
    button.style.minHeight = '44px';
    if (button.parentElement !== controls) controls.appendChild(button);
  }

  const initStatus = byId(doc, 'init-status-msg');
  if (initStatus && initStatus.parentElement !== messages) messages.appendChild(initStatus);

  let archiveStatus = byId(doc, 'closeout-safety-msg');
  if (!archiveStatus) {
    archiveStatus = doc.createElement('div');
    archiveStatus.id = 'closeout-safety-msg';
    archiveStatus.className = 'text-xs font-bold text-muted';
    archiveStatus.style.minHeight = '20px';
  }
  if (archiveStatus.parentElement !== messages) messages.appendChild(archiveStatus);

  // Only remove the original empty Input footer, never an unrelated element.
  if (oldFooter && oldFooter !== controls && oldFooter.parentElement === page &&
      oldFooter.classList.contains('border-t') && !oldFooter.children.length &&
      !oldFooter.textContent.trim()) oldFooter.remove();
  return true;
}

function start() {
  if (!relocateWeekGroupActions()) return;
  // A future page-shell rerender may recreate markup. Relocation is idempotent.
  for (const hook of ['afterPageChange', 'afterRenderAll', 'afterCloseout']) {
    globalThis.registerGateHook?.(hook, () => globalThis.requestAnimationFrame?.(() => relocateWeekGroupActions()));
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}
