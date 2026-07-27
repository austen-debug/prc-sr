# GATE 3.0 Current Repository Audit and Runtime Index

Generated: 2026-07-27T19:20:50.164Z

Branch: `gate-3.0/phase-5-certification`  
Candidate: `2a43762608dd70eddc2624bf313c95f529d65f2b`

## Executive finding

The repository has completed major structural extraction and net-negative cleanup, but the application is **not yet a clean single-owner GATE 3.0 runtime**. The active bootstrap remains 1,610 lines and still contains duplicate route rendering, workflow functions, fallback paths, and inline-handler generation that overlap the canonical controllers.

## Current served runtime

- 8 local stylesheets and 17 local scripts are loaded by `public/index.html`.
- 29 CSS files and 40 JavaScript files remain under `public/`.
- The bootstrap defines 64 named functions.
- Active JavaScript syntax failures: 0.
- Active legacy-named assets: 2.

## Canonical boundaries present

- `GateApplicationStore`: present
- `GateRouteLifecycle`: present
- Middleware UI rewriting markers: .replace(

## Duplicate ownership still present in the bootstrap

- **statusBoard:** `renderDormColumns`, `buildBoardDormCard`, `updateTimers`, `updateAirportMetric`, `getElapsedTimer`
- **processing:** `renderProcessingPage`, `buildProcCard`, `openDormModal`, `closeDormModal`, `saveAssignedAirman`, `saveLoad`, `openDormEditModal`, `closeDormEditModal`
- **airportBus:** `getNextAirportBusId`, `renderArrivals`, `renderAirportBusLog`, `confirmBusArrival`, `openLocalBusModal`, `closeLocalBusModal`
- **input:** `initBatchGrid`, `initializeWeekGroup`, `returnToBoard`
- **archives:** `renderArchives`, `initiateCloseout`

## CI and historical-material audit

- 21 workflow files remain.
- 4 workflows reference assets removed by the transition.
- 62 Build 2 documentation files remain.
- 24 Build 2 test files remain.

## UI/UX cleanup readiness

The UI/UX pass should not begin as a cosmetic-only exercise. It must start by restoring runtime integrity and removing duplicate render ownership; otherwise visual changes may be overwritten by fallback renderers or obsolete controllers.

The machine-readable inventory is in `docs/gate-3.0/current/runtime-index.json`.
