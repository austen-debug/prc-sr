# Phase 6B — Legacy Print Runtime Cleanup

Status: Implemented
Scope: Removed the legacy print-report helper from active runtime injection so `GateArchiveController` is the only active owner for archive print/PDF and current summary print.

## Objective

Phase 6B resolves the validation blocker found before Phase 7.

The validation pass identified that `/js/prc-dash-print-report.js` was still active in middleware even though Phase 5 moved archive/current summary report ownership into `GateArchiveController`.

That created a risk of:

- duplicate `printArchiveSpreadsheet()` ownership
- duplicate `printCurrentSummaryReport()` ownership
- duplicate Current Summary button binding
- inconsistent report shells or two report windows from one click

## Active change

Removed from middleware injection:

```html
<script src="/js/prc-dash-print-report.js" defer></script>
```

The file remains in the repository for traceability but is no longer active at runtime.

## Active print owner after Phase 6B

`GateArchiveController` is now the only active runtime owner for:

- `printArchiveSpreadsheet()` compatibility handoff
- `printCurrentSummaryReport()` compatibility handoff
- archive print/PDF report shell
- current live summary report shell
- Current Summary button binding
- archive report button binding

## Files changed

```txt
functions/_middleware.js
docs/ACTIVE_RUNTIME_STACK.md
docs/PHASE_6B_PRINT_RUNTIME_CLEANUP.md
```

## What this phase does not change

Phase 6B does not change:

- report layout code inside `GateArchiveController`
- archive payload schema
- closeout behavior
- Input workflow
- Status Board rendering
- Processing workflow
- Airport/local bus workflow
- mobile UI polish

## Acceptance criteria

1. Middleware no longer injects `/js/prc-dash-print-report.js`.
2. Middleware still injects `/js/gate-archive-controller.js?v=phase-5-archive-20260709`.
3. Active runtime stack docs list `/js/prc-dash-print-report.js` as removed in Phase 6B.
4. Archive print/PDF and Current Summary print remain owned by `GateArchiveController`.

## Next recommended phase

Proceed to Phase 7 — Mobile / UI Polish and Final Design System stabilization.
