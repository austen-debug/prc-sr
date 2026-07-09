# Phase 1B — Status Board Metrics and Board Header Ownership

Status: Implemented baseline
Scope: Status Board top metric source, metric update path, duplicate metric cleanup, and documentation.

## Objective

Phase 1B consolidates the Status Board top metric row so ARRIVED, EXPECTED, LAST ARRIVAL, and LOCAL TIME have one canonical visible source and one direct update path.

This phase does not change:

- Airport bus creation
- local arrival creation
- Processing record updates
- Input initialization
- Archive closeout
- dorm card rendering
- active bus confirmation logic
- backend records API

## Why this phase was needed

The previous metric implementation had become layered:

- `public/index.html` still rendered old `metric-arrived` and `metric-airport` source blocks.
- `gate-premium-metrics-controller.js` created a new glass metric row at runtime.
- stale v3 board-header metric surfaces could still appear.
- compatibility sinks were required so old `renderAll()` and `updateAirportMetric()` did not crash.

That produced duplicate visual metrics and made the Status Board header unstable.

## Active implementation

### Middleware source refactor

`functions/_middleware.js` now applies a served-source Status Board metric refactor before the HTML is delivered.

It replaces the old source metric blocks with:

```html
<div class="board-header gate-premium-metrics-enabled" data-owner="gate-status-metrics-source" data-phase="1B">
  <div class="gate-metrics-container">
    <div class="metric-card arrived-card">
      <div class="metric-header">
        <span class="status-dot led-green" aria-hidden="true"></span>
        <span class="metric-label">ARRIVED</span>
      </div>
      <div class="metric-value" id="stat-arrived">0</div>
    </div>

    <div class="metric-card expected-card">
      <div class="metric-header">
        <span class="metric-label">EXPECTED</span>
      </div>
      <div class="metric-value" id="stat-expected">0</div>
    </div>

    <div class="metric-card last-card">
      <div class="metric-header">
        <span class="metric-label">LAST ARRIVAL</span>
      </div>
      <div class="metric-value" id="stat-last">00:00</div>
    </div>

    <div class="metric-card local-card">
      <div class="metric-header">
        <span class="metric-label">LOCAL TIME</span>
      </div>
      <div class="metric-value" id="stat-local">00:00</div>
    </div>
  </div>

  <div class="metric-block gate-active-buses-block">
    <div class="text-xs uppercase tracking-wider font-medium text-muted mb-1">Active Buses En Route</div>
    <div id="active-buses" class="flex gap-2 flex-wrap items-center"></div>
  </div>
</div>
```

### Metric update path

The served base runtime is also refactored so:

- `renderAll()` writes directly to `stat-arrived` and `stat-expected`.
- `updateAirportMetric()` writes directly to `stat-last` and `stat-local`.
- old `metric-arrived` and `metric-airport` compatibility sinks are no longer needed.

### Premium metrics controller

`public/js/gate-premium-metrics-controller.js` is now a passive sync guard only.

It no longer:

- creates metric cards
- inserts `gate-metrics-container`
- creates `gate-metric-compat-sinks`
- owns the source structure

It only:

- removes stale duplicate surfaces if old/cached code creates them
- removes old compatibility sinks if present
- syncs `stat-*` values from records as a safety layer

## Files changed

- `functions/_middleware.js`
- `public/js/gate-premium-metrics-controller.js`
- `docs/PHASE_1B_STATUS_METRICS.md`
- `docs/ACTIVE_RUNTIME_STACK.md`

## Active asset version changes

The metric assets were cache-busted to:

```html
<link rel="stylesheet" href="/css/gate-premium-metrics.css?v=premium-metrics-20260709d">
<script src="/js/gate-premium-metrics-controller.js?v=premium-metrics-20260709d" defer></script>
```

## Acceptance criteria

Must pass before Phase 1C:

1. Status Board shows exactly one top metric row.
2. ARRIVED updates from arrived bus records.
3. EXPECTED updates from dorm max-load totals.
4. LAST ARRIVAL updates from the last airport config value.
5. LOCAL TIME updates every second.
6. Active Buses En Route remains visible and functional.
7. No `metric-arrived` or `metric-airport` visible blocks appear.
8. No `prc-metric-card-v3` duplicate cards appear.
9. No hidden compatibility sink is required for the metric update path.

## Known remaining risks

- `public/index.html` remains a monolithic legacy file. Phase 1B refactors the served source path through middleware rather than replacing the whole static file because the static file is still very large and contains many unrelated workflows.
- A future full source migration should move Status Board markup and metric update logic into a real `StatusBoardPage` / `StatusMetrics` module.
- Active bus rendering is still owned by existing board/bus workflow layers and should be addressed in Phase 1C.

## Next recommended phase

Proceed to Phase 1C — Status Board dorm cards and active bus panel ownership.

Phase 1C should consolidate:

- active bus panel rendering
- Status Board dorm columns
- dorm card component ownership
- timer update boundaries for board cards
