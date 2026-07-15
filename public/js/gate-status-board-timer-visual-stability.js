// GATE Status Board timer visual stability guard
// Converts legacy flashing overtime timers to a steady alert state and prevents timer transitions.
(function () {
  'use strict';

  let installed = false;
  let observer = null;

  function installStyles() {
    if (document.getElementById('gate-status-board-timer-visual-stability')) return;

    const style = document.createElement('style');
    style.id = 'gate-status-board-timer-visual-stability';
    style.dataset.owner = 'gate-status-board-timer-visual-stability';
    style.textContent = `
      #page-board .timer-display {
        min-width: 6.35ch !important;
        font-variant-numeric: tabular-nums !important;
        animation: none !important;
        transition: none !important;
        opacity: 1 !important;
        will-change: auto !important;
        backface-visibility: visible !important;
      }

      #page-board .timer-display.timer-flash {
        color: var(--red) !important;
        animation: none !important;
        transition: none !important;
        opacity: 1 !important;
      }

      #page-board .gate-dorm-card,
      #page-board .dorm-card {
        animation: none !important;
        transition: none !important;
        will-change: auto !important;
      }
    `;

    document.head.appendChild(style);
  }

  function normalizeTimer(timer) {
    if (!(timer instanceof Element) || !timer.matches('.timer-display')) return;

    if (timer.classList.contains('timer-flash')) {
      timer.classList.remove('timer-flash');
      timer.classList.add('timer-red');
    }
  }

  function normalizeBoardTimers(root = document) {
    root.querySelectorAll?.('#page-board .timer-display').forEach(normalizeTimer);
  }

  function observeBoard() {
    const board = document.getElementById('page-board');
    if (!board || observer) return;

    observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes') {
          normalizeTimer(mutation.target);
          continue;
        }

        for (const node of mutation.addedNodes) {
          if (!(node instanceof Element)) continue;
          normalizeTimer(node);
          node.querySelectorAll?.('.timer-display').forEach(normalizeTimer);
        }
      }
    });

    observer.observe(board, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }

  function install() {
    installStyles();
    normalizeBoardTimers();
    observeBoard();

    if (installed) return;
    installed = true;

    window.registerGateHook?.('afterRenderAll', normalizeBoardTimers);
    window.registerGateHook?.('afterDataChanged', normalizeBoardTimers);
    window.registerGateHook?.('afterPageChange', normalizeBoardTimers);

    window.GateStatusBoardTimerVisualStability = Object.freeze({
      normalize: normalizeBoardTimers,
      isVisualOnly: true
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
  window.addEventListener('load', install, { once: true });
})();
