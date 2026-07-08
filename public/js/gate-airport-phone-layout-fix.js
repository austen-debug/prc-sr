// GATE Airport phone layout hardening
// Forces Generate Airport Bus into a vertical mobile card after all compatibility fields are injected.
(function () {
  'use strict';

  let scheduled = false;
  let observerStarted = false;

  function isPhone() {
    return window.matchMedia('(max-width: 767px)').matches;
  }

  function setImportant(element, property, value) {
    if (!element || !element.style) return;
    element.style.setProperty(property, value, 'important');
  }

  function setBlockBox(element) {
    setImportant(element, 'display', 'block');
    setImportant(element, 'width', '100%');
    setImportant(element, 'max-width', '100%');
    setImportant(element, 'min-width', '0');
    setImportant(element, 'box-sizing', 'border-box');
    setImportant(element, 'float', 'none');
    setImportant(element, 'clear', 'both');
    setImportant(element, 'grid-column', 'auto');
    setImportant(element, 'grid-row', 'auto');
    setImportant(element, 'margin-left', '0');
    setImportant(element, 'margin-right', '0');
  }

  function forceAirportPhoneLayout() {
    if (!isPhone()) return;

    const page = document.getElementById('page-airport');
    const form = document.getElementById('airport-form');
    if (!page || !form) return;

    page.classList.add('gate-airport-phone-layout-forced');
    setImportant(page, 'overflow-x', 'hidden');
    setImportant(page, 'overflow-y', 'auto');
    setImportant(page, 'max-width', '100vw');

    const wrap = page.querySelector('.max-w-3xl');
    if (wrap) {
      setBlockBox(wrap);
      setImportant(wrap, 'max-width', 'none');
      setImportant(wrap, 'margin-left', '0');
      setImportant(wrap, 'margin-right', '0');
    }

    setBlockBox(form);
    setImportant(form, 'display', 'block');
    setImportant(form, 'overflow-x', 'hidden');
    setImportant(form, 'overflow-y', 'visible');
    setImportant(form, 'padding', '1rem');
    setImportant(form, 'border-radius', '18px');
    setImportant(form, 'grid-template-columns', 'none');
    setImportant(form, 'grid-auto-flow', 'row');
    setImportant(form, 'grid-auto-columns', 'auto');
    setImportant(form, 'column-gap', '0');
    setImportant(form, 'row-gap', '0');

    Array.from(form.children).forEach((child, index) => {
      setBlockBox(child);
      setImportant(child, 'margin-top', '0');
      setImportant(child, 'margin-bottom', child.id === 'airport-msg' ? '0.1rem' : '0.86rem');
      setImportant(child, 'position', 'static');
      setImportant(child, 'transform', 'none');
      child.dataset.gateAirportPhoneOrder = String(index + 1);

      if (child.tagName === 'H3') {
        setImportant(child, 'font-size', '1.05rem');
        setImportant(child, 'line-height', '1.1');
        setImportant(child, 'letter-spacing', '0.12em');
        setImportant(child, 'overflow-wrap', 'anywhere');
      }
    });

    form.querySelectorAll('label').forEach(label => {
      setBlockBox(label);
      setImportant(label, 'margin-bottom', '0.28rem');
      setImportant(label, 'font-size', '0.78rem');
      setImportant(label, 'line-height', '1.12');
      setImportant(label, 'white-space', 'normal');
      setImportant(label, 'overflow-wrap', 'anywhere');
    });

    form.querySelectorAll('input').forEach(input => {
      setBlockBox(input);
      setImportant(input, 'min-height', '48px');
      setImportant(input, 'font-size', '16px');
      setImportant(input, 'position', 'static');
      setImportant(input, 'transform', 'none');
    });

    const submit = form.querySelector('button[type="submit"]');
    if (submit) {
      setBlockBox(submit);
      setImportant(submit, 'min-height', '48px');
      setImportant(submit, 'height', 'auto');
      setImportant(submit, 'align-self', 'stretch');
      setImportant(submit, 'margin-top', '0.25rem');
      setImportant(submit, 'margin-bottom', '0.25rem');
    }

    const msg = document.getElementById('airport-msg');
    if (msg) {
      setBlockBox(msg);
      setImportant(msg, 'min-height', '1rem');
      setImportant(msg, 'text-align', 'center');
      setImportant(msg, 'white-space', 'normal');
    }

    const logSurface = page.querySelector('.surface:has(#airport-bus-log-body)');
    if (logSurface) {
      setImportant(logSurface, 'overflow-x', 'auto');
      setImportant(logSurface, 'overflow-y', 'hidden');
      setImportant(logSurface, '-webkit-overflow-scrolling', 'touch');
    }

    const table = logSurface ? logSurface.querySelector('table') : null;
    if (table) {
      setImportant(table, 'width', 'max-content');
      setImportant(table, 'min-width', '760px');
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      forceAirportPhoneLayout();
    });
  }

  function startObserver() {
    if (observerStarted || !document.body) return;
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });
    observerStarted = true;
  }

  function start() {
    forceAirportPhoneLayout();
    startObserver();
    window.addEventListener('resize', schedule, true);
    window.addEventListener('orientationchange', schedule, true);
    window.registerGateHook?.('afterPageChange', schedule);
    window.registerGateHook?.('afterRenderAll', schedule);
    window.registerGateHook?.('afterDataChanged', schedule);
    window.setTimeout(schedule, 50);
    window.setTimeout(schedule, 250);
    window.setTimeout(schedule, 750);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  window.addEventListener('load', start, { once: true });
})();
