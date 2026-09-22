# GATE UI Layer Catalog

> **Historical architecture snapshot.** This document is retained for continuity and prior-decision evidence. It is not the current runtime authority after the 22 Sep 2026 full-repository audit.

## Current authority

Use these files for the live UI/runtime contract:

- `functions/_middleware.js` — served asset order and route-time source transforms.
- `docs/ACTIVE_RUNTIME_STACK.md` — human-readable active runtime and owner register.
- `docs/build-2/ACTIVE_RUNTIME_BUDGET.json` — machine-readable asset ceiling.
- `docs/FULL_REPO_AUDIT_2026-09-22.md` — repository-wide disposition and consolidation ledger.

The current production UI uses one canonical stylesheet, `public/css/military-glass-terminal.css`, and 23 direct scripts/modules. Older multi-stylesheet and patch-controller lists below were retired and must not be restored merely because they appear in historical phase documentation.

## Current ownership summary

- `GateHooks` — lifecycle hooks and the shared `window.allData` bridge. The same source file also contains the Port Clear operational feature; that feature is active and must not be mistaken for dead hook infrastructure.
- `GateAppShell` — role-aware route state, desktop/mobile/tablet shell behavior, History API navigation, drawer state, and global confirmation Escape handling.
- `GatePermissionGuard` — client-side action visibility/protection; server authorization remains authoritative.
- `GateStatusBoardController` — Status Board dorm/active-bus presentation and canonical timer rendering.
- `GatePremiumMetricsController` — live Status Board metrics and Local clock.
- `GateProcessingController` — Processing cards, loaded/arrived summary, dorm modal/edit workflow, load clamping, final-time/reopen workflow, and Processing modal Escape behavior.
- `GateBusWorkflowController` — airport/local bus create/edit/arrival workflow, Space Force bus fields, bus-log SF column, and bus-modal Escape behavior.
- `GateInputPageController` — Input page, receiving windows, batch rows, initialization preflight, and Week Group initialization.
- `GateArchiveController` — archive/closeout presentation, read-only historical workspace, current/archive report generation, and archive-modal Escape behavior.
- `GateTimerSoundController` — timer/sound-event processing and overtime eligibility.
- `GateSoundSystem` — operational sound assets, sound enablement, error cues, and sound-event creation.
- `GateDormReopenController` — retained compatibility handoff for the edit-modal reopen button while canonical mutation remains in `GateProcessingController`.
- `GateStatusBoardShadow` — hidden Phase 3A read-only observer only.

## Retired compatibility owners

The repository audit folded the following active compatibility layers into their canonical owners and removed them from the production runtime:

- `prc-dash-runtime-fixes.js`
- `prc-dash-space-force.js`
- `gate-tablet-shell-classifier.js`
- `gate-render-stability-fix.js`
- `prc-dash-processing-loaded-summary.js`

Earlier Phase 14 and Phase 7 reports document additional retired patch files. Git history preserves those implementations; they are not runtime authorities.

## Maintenance rule

Before adding UI/runtime code, extend the existing owner whenever possible. Do not introduce a new `fix`, `patch`, `corrective`, `restore`, `finalizer`, `cleanup`, or `stability` layer to compensate for behavior that belongs in an existing controller.

If historical documentation conflicts with the current runtime authority files listed above, the current runtime authority wins.
