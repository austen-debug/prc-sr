# GATE 3.0 Current Repository Audit and Runtime Index

Generated: 27 July 2026

Branch: `gate-3.0/phase-5-certification`

## Executive finding

The repository has completed major structural extraction and net-negative cleanup, but the application is **not yet a clean, single-owner, deployment-ready GATE 3.0 runtime**.

The active bootstrap remains approximately 1,610 lines and still contains duplicate Status Board, Processing, Airport/bus, Input, timer, modal, and archive behavior that overlaps the canonical route controllers. It also retains conditional fallback renderers and dynamic inline-handler generation.

A second critical issue is present: `gate-application-bootstrap.js` expects `GateApplicationStore` and `GateRouteLifecycle`, but `public/index.html` does not currently load either foundation file.

## Current served runtime

- `public/index.html` contains 596 lines of structural markup.
- 8 local stylesheets and 17 local scripts are loaded.
- 29 CSS files and 40 JavaScript files remain under `public/`.
- The bootstrap defines 64 named functions.
- Direct `node --check` validation found no syntax failures in the active local scripts.
- Two active assets retain legacy naming: `gate-index-legacy-shell.css` and `prc-dash-space-force.js`.

## Canonical boundaries present

- `GateApplicationStore`: file present, **not loaded by `index.html`**.
- `GateRouteLifecycle`: file present, **not loaded by `index.html`**.
- Middleware is reduced to session verification, security headers, API pass-through, and static delivery.
- The remaining middleware `.replace()` calls are base64url encoding operations, not UI rewriting.

## Duplicate ownership still present in the bootstrap

- **Status Board:** `renderDormColumns`, `buildBoardDormCard`, `updateTimers`, `updateAirportMetric`, `getElapsedTimer`
- **Processing:** `renderProcessingPage`, `buildProcCard`, `openDormModal`, `closeDormModal`, `saveAssignedAirman`, `saveLoad`, `openDormEditModal`, `closeDormEditModal`
- **Airport/bus:** `getNextAirportBusId`, `renderArrivals`, `renderAirportBusLog`, `confirmBusArrival`, `openLocalBusModal`, `closeLocalBusModal`
- **Input:** `initBatchGrid`, `initializeWeekGroup`, `returnToBoard`
- **Archives:** `renderArchives`, `initiateCloseout`

`renderApplication()` still conditionally delegates to canonical controllers while retaining direct fallback DOM rendering. That means visual changes can still be overwritten by a second implementation.

## Interaction ownership

`public/index.html` itself no longer contains inline event attributes, but active JavaScript still generates `onclick` and `oncontextmenu` attributes in dynamic markup. Interaction ownership is therefore still fragmented and must be consolidated before accessibility and interaction cleanup can be considered final.

## Design-system state

The former corrective stylesheets were merged into permanent files and deleted. The active style stack is now:

1. `gate-index-legacy-shell.css`
2. `gate-base-tokens.css`
3. `gate-layout-pages.css`
4. `gate-components.css`
5. `gate-utilities-access.css`
6. `gate-premium-metrics.css`
7. `gate-app-shell.css`
8. `gate-application-structure.css`

This is materially cleaner than the prior runtime, but `gate-components.css` and `gate-layout-pages.css` now contain large merged rule sets that require deduplication and visual normalization during the UI/UX pass.

## CI and historical-material audit

- 21 workflow files remain.
- 4 workflows reference assets removed by the transition.
- 62 Build 2 documentation files remain.
- 24 Build 2 test files remain.
- Build 2 Phase 3A evidence, review, shadow-retirement, and audit-remediation workflows are still running against retired architecture.
- Runtime Record Integrity is failing under pre-transition assumptions even though direct active-script syntax checks pass.

These failures must be separated into:

- valid current-runtime tests that should be retained and updated;
- obsolete Build 2 tests/workflows that should be removed or archived as non-executable evidence.

## Verified progress

- Inline style and script blocks were extracted from `index.html`.
- Middleware UI rewriting was removed.
- Corrective CSS files were merged and deleted.
- Multiple obsolete delegate scripts were deleted.
- The hidden Status Board shadow runtime was deleted.
- `GateApplicationStore` and `GateRouteLifecycle` were created.
- Archive compatibility-global patching was removed.
- The branch is net-negative by thousands of lines relative to `main`.

## Current transition determination

The transition is **not complete**.

The repository has reached a partially consolidated GATE 3.0 structure, but it still contains duplicate executable ownership, missing foundation script loads, stale Build 2 CI, legacy-named active assets, and merged CSS that has not yet been normalized.

## UI/UX cleanup readiness

A cosmetic-only pass should not begin yet. The first portion of the UI/UX pass must include runtime stabilization because fallback renderers and duplicate controllers can overwrite visual changes.

Required order:

1. Load `GateApplicationStore` and `GateRouteLifecycle` before the bootstrap.
2. Remove duplicate route rendering and mutation ownership from the bootstrap.
3. Remove fallback render paths.
4. Replace generated inline event handlers with delegated controller events.
5. Retire or rewrite stale Build 2 workflows and tests.
6. Then perform route-by-route visual, responsive, accessibility, and interaction cleanup.

Machine-readable files:

- `docs/gate-3.0/current/runtime-index.json`
- `docs/gate-3.0/current/runtime-blockers.json`
