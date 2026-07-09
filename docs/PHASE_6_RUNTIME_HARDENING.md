# Phase 6 — Runtime Hardening / Ownership Cleanup

Status: Implemented baseline
Scope: Reduced remaining controller overlap by narrowing `gate-ui-hooks.js` back to lifecycle-hook ownership only.

## Objective

Phase 6 removes the last major internal ownership conflict from the active runtime.

Before this phase, `gate-ui-hooks.js` was doing three jobs:

1. lifecycle hook registration / wrapper support
2. Active Buses rendering
3. Archive schema / closeout patching

After Phases 1C, 3, and 5, those workflow jobs had already moved to canonical owners:

- `GateStatusBoardController` owns the Active Buses panel.
- `GateBusWorkflowController` owns bus arrival confirmation and bus lifecycle changes.
- `GateArchiveController` owns closeout, archive creation/verification, archive editing, and reporting.

Phase 6 removes the duplicate implementations from `gate-ui-hooks.js` so it only owns lifecycle hooks.

## What this phase does not change

Phase 6 does not change:

- backend record schema
- app routes
- role permissions
- Status Board layout
- Processing workflow
- Airport/local bus workflow
- Input initialization
- Archive/reporting behavior
- mobile dropdown or watermark polish

## Active implementation

Updated:

```txt
public/js/gate-ui-hooks.js
```

It now owns only:

- hook registry initialization
- `window.runGateHooks()`
- `window.registerGateHook()`
- `window.unregisterGateHook()`
- `renderAll()` lifecycle wrapper
- `showPage()` lifecycle wrapper
- compatibility stubs for older `GateHooks.installActiveBusController()` and `GateHooks.installArchiveSchemaController()` calls

## Removed from `gate-ui-hooks.js`

Removed internal duplicate ownership for:

- Active Bus controller rendering
- Active Bus mutation observer
- Active Bus renderAll wrapper
- Archive schema controller
- Archive payload creation
- Safe closeout implementation
- Closeout button ownership

Those behaviors are now owned by the dedicated workflow controllers.

## Runtime change

Middleware now loads:

```html
<script src="/js/gate-ui-hooks.js?v=phase-6-hooks-20260709" defer></script>
```

## Compatibility behavior

The old installer names remain as safe handoff stubs:

```js
window.GateHooks.installActiveBusController = function gateHooksActiveBusHandoff() {
  if (window.GateStatusBoardController?.scheduleRender) {
    window.GateStatusBoardController.scheduleRender({ force: true });
    return true;
  }
  return false;
};

window.GateHooks.installArchiveSchemaController = function gateHooksArchiveHandoff() {
  if (window.GateArchiveController?.refresh) {
    window.GateArchiveController.refresh();
    return true;
  }
  return false;
};
```

This preserves compatibility for any older code path that still calls those installer names while preventing the old duplicate controllers from coming back.

## Coding standard correction

During the Phase 6 pass, an unsafe `eval()`-based helper was immediately removed. The hook API is now exposed through direct `window.*` assignment only.

## Acceptance criteria

Must pass before UI/mobile polish:

1. Page navigation still fires `afterPageChange` hooks.
2. `renderAll()` still fires `afterRenderAll` hooks.
3. Active Buses En Route still renders from `GateStatusBoardController`.
4. Confirm bus arrival still routes to `GateBusWorkflowController.confirmBusArrival`.
5. Closeout still routes to `GateArchiveController`.
6. Archive page still renders archive cards/search.
7. Processing, Input, Status Board, and Airport pages still refresh after data changes.
8. Browser console has no `GateArchiveSchemaController` or old active-bus ownership errors.

## Remaining active overlap areas

The primary remaining overlap is UI-specific and mobile-specific rather than workflow ownership:

- `gate-airport-phone-layout-fix.js`
- `prc-dash-modal-mobile-validation.js`
- `gate-tablet-processing-modal-fix.js`
- `gate-render-stability-fix.js`
- legacy inline CSS and page markup in `public/index.html`

## Next recommended phase

Proceed to Mobile / UI Polish and Final Design System pass.

Priority items:

1. Repair corrupt/inaccessible mobile dropdown menu.
2. Fix mobile watermark size/position.
3. Normalize mobile page overflow and scroll behavior.
4. Audit desktop visual regressions after mobile changes.
5. Begin removing page-specific mobile patch files once their logic is folded into the canonical App Shell/mobile layer.
