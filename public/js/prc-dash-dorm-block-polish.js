// PRC GATE dorm block polish
// Final UI-only layout layer for Status Board, Processing Page, and Squadron Board dorm cards.
(function () {
  let started = false;

  function ensureStyles() {
    if (document.getElementById('prc-gate-dorm-block-polish-styles')) return;

    const style = document.createElement('style');
    style.id = 'prc-gate-dorm-block-polish-styles';
    style.textContent = `
      :root {
        --gate-dorm-card-min: clamp(176px, 16.8vh, 238px);
        --gate-dorm-card-pad-y: clamp(0.92rem, 1.05vw, 1.25rem);
        --gate-dorm-card-pad-x: clamp(1rem, 1.22vw, 1.42rem);
      }

      #page-board .gate-dorm-card,
      #page-squadron .gate-dorm-card {
        min-width: 0 !important;
        min-height: var(--gate-dorm-card-min) !important;
        padding: var(--gate-dorm-card-pad-y) var(--gate-dorm-card-pad-x) !important;
        row-gap: 0.38rem !important;
        column-gap: 0.82rem !important;
        box-sizing: border-box !important;
      }

      #page-board .gate-dorm-card {
        grid-template-columns: minmax(0, 1fr) minmax(5.25rem, max-content) !important;
        grid-template-rows: auto auto auto minmax(2.22rem, 1fr) auto 5px !important;
        grid-template-areas:
          "name airman"
          "info info"
          "flags location"
          "status status"
          "timer load"
          "progress progress" !important;
      }

      #page-squadron .gate-dorm-card {
        grid-template-columns: minmax(0, 1fr) minmax(4.75rem, max-content) !important;
        grid-template-rows: auto auto auto minmax(2.22rem, 1fr) auto 5px !important;
        grid-template-areas:
          "name airman"
          "info info"
          "flags flags"
          "status status"
          "timer load"
          "progress progress" !important;
      }

      #page-board .gate-dorm-name,
      #page-squadron .gate-dorm-name,
      #page-board .dorm-id-text,
      #page-squadron .dorm-id-text {
        min-width: 0 !important;
        width: 100% !important;
        max-width: 100% !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        font-size: clamp(1.82rem, 2.44vw, 3.05rem) !important;
        letter-spacing: -0.052em !important;
        line-height: 0.96 !important;
        padding-right: 0.25rem !important;
      }

      #page-board .gate-dorm-airman,
      #page-squadron .gate-dorm-airman {
        max-width: min(9.5rem, 30vw) !important;
        font-size: clamp(0.62rem, 0.66vw, 0.76rem) !important;
        letter-spacing: 0.065em !important;
        line-height: 1.05 !important;
      }

      #page-board .gate-dorm-info,
      #page-squadron .gate-dorm-info {
        min-width: 0 !important;
        font-size: clamp(0.66rem, 0.74vw, 0.86rem) !important;
        letter-spacing: 0.072em !important;
        line-height: 1.08 !important;
      }

      #page-board .gate-dorm-flags,
      #page-squadron .gate-dorm-flags {
        grid-area: flags !important;
        min-width: 0 !important;
        max-width: 100% !important;
        overflow: hidden !important;
        align-self: start !important;
        justify-self: start !important;
        margin: 0 !important;
      }

      #page-board .gate-auditorium-location {
        grid-area: location !important;
        justify-self: end !important;
        align-self: start !important;
        max-width: min(9.75rem, 100%) !important;
        margin: 0 !important;
      }

      #page-squadron .gate-auditorium-location {
        display: none !important;
      }

      #page-board .gate-dorm-status-wrap,
      #page-squadron .gate-dorm-status-wrap {
        padding: 0.42rem 0 0.36rem !important;
        min-width: 0 !important;
      }

      #page-board .gate-dorm-status,
      #page-squadron .gate-dorm-status {
        max-width: 100% !important;
        min-height: 1.62rem !important;
        padding: 0.28rem 0.74rem !important;
        font-size: clamp(0.64rem, 0.66vw, 0.78rem) !important;
        letter-spacing: 0.095em !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }

      #page-board .gate-dorm-timer,
      #page-squadron .gate-dorm-timer {
        min-width: 0 !important;
        font-size: clamp(1.68rem, 2.58vw, 3.08rem) !important;
        letter-spacing: -0.045em !important;
        line-height: 0.98 !important;
      }

      #page-board .gate-dorm-load,
      #page-squadron .gate-dorm-load {
        min-width: 0 !important;
        font-size: clamp(1.12rem, 1.52vw, 1.96rem) !important;
        letter-spacing: -0.035em !important;
        line-height: 0.98 !important;
      }

      #page-board .gate-dorm-progress,
      #page-squadron .gate-dorm-progress {
        margin-top: 0.18rem !important;
      }

      #page-processing #proc-dorm-grid {
        align-items: stretch !important;
      }

      #page-processing .proc-card {
        display: flex !important;
        flex-direction: column !important;
        min-width: 0 !important;
        min-height: clamp(164px, 14.6vw, 226px) !important;
        padding: clamp(0.86rem, 1vw, 1.12rem) !important;
        gap: 0.28rem !important;
        overflow: hidden !important;
        box-sizing: border-box !important;
      }

      #page-processing .proc-card > .flex.justify-between.items-start {
        min-width: 0 !important;
        margin-bottom: 0.1rem !important;
        gap: 0.74rem !important;
      }

      #page-processing .proc-card > .flex.justify-between.items-start > .font-black.text-3xl {
        min-width: 0 !important;
        max-width: 100% !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
        font-size: clamp(1.5rem, 1.72vw, 2.05rem) !important;
        letter-spacing: -0.046em !important;
        line-height: 0.98 !important;
      }

      #page-processing .proc-card > .flex.justify-between.items-start > .flex.flex-col.items-end {
        flex: 0 0 auto !important;
        max-width: 42% !important;
        min-width: 4.5rem !important;
      }

      #page-processing .proc-card > .text-xs.text-muted.font-bold.uppercase {
        min-width: 0 !important;
        max-width: 100% !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
        font-size: clamp(0.64rem, 0.72vw, 0.78rem) !important;
        letter-spacing: 0.07em !important;
        line-height: 1.08 !important;
      }

      #page-processing .proc-card .gate-dorm-flags {
        display: flex !important;
        flex-wrap: wrap !important;
        gap: 0.28rem !important;
        margin: 0.28rem 0 0 !important;
        min-height: 1.18rem !important;
      }

      #page-processing .proc-card .gate-auditorium-location {
        display: inline-flex !important;
        width: fit-content !important;
        max-width: 100% !important;
        margin: 0.24rem 0 0 !important;
      }

      #page-processing .proc-card > .text-xl.font-black.font-tabular {
        margin-top: 0.28rem !important;
        font-size: clamp(1.16rem, 1.45vw, 1.62rem) !important;
        letter-spacing: -0.026em !important;
        line-height: 1 !important;
      }

      #page-processing .proc-card .text-sm.font-bold.mt-1 {
        width: fit-content !important;
        max-width: 100% !important;
        margin-top: 0.32rem !important;
      }

      #page-processing .proc-card .timer-display {
        margin-top: auto !important;
        font-size: clamp(1.54rem, 1.95vw, 2.18rem) !important;
        letter-spacing: -0.042em !important;
        line-height: 1 !important;
      }

      .gate-dorm-flag-chip,
      .gate-auditorium-location {
        max-width: 100% !important;
      }

      @media (max-width: 1200px) {
        #page-board .gate-dorm-card,
        #page-squadron .gate-dorm-card {
          min-height: clamp(168px, 18vh, 226px) !important;
          padding: 0.9rem 1rem !important;
        }

        #page-board .gate-dorm-card {
          grid-template-columns: minmax(0, 1fr) minmax(4.75rem, max-content) !important;
        }
      }

      @media (max-width: 760px) {
        #page-board .gate-dorm-card,
        #page-squadron .gate-dorm-card {
          grid-template-columns: minmax(0, 1fr) !important;
          grid-template-rows: auto auto auto auto auto auto 5px !important;
          grid-template-areas:
            "name"
            "airman"
            "info"
            "flags"
            "status"
            "timer"
            "progress" !important;
        }

        #page-board .gate-auditorium-location {
          grid-area: flags !important;
          justify-self: start !important;
          margin-top: 1.34rem !important;
          max-width: 100% !important;
        }

        #page-board .gate-dorm-airman,
        #page-squadron .gate-dorm-airman {
          justify-self: start !important;
          text-align: left !important;
          max-width: 100% !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function start() {
    if (started) return;
    started = true;
    ensureStyles();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
