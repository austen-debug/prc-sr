# Phase 14 File Audit

Phase 14 removed inactive legacy UI files only after checking the active middleware stack and CSS import chain.

## Removed

- `public/js/prc-dash-local-bus-edit.js`
- `public/js/prc-dash-receiving-windows.js`
- `public/js/prc-dash-receiving-window-fields.js`
- `public/js/prc-dash-status-header.js`
- `public/css/prc-dash-status-header.css`
- `public/css/prc-dash-board-dorms.css`

## Rationale

These files were not injected by `functions/_middleware.js`, not imported by the active CSS chain, and not dynamically loaded by the active runtime controllers.

Their current responsibilities are covered by active controllers and styles:

- Bus workflow: `GateBusWorkflowController`
- Input receiving windows and batch Space Force support: `GateInputPageController`
- Status Board header/active buses: `GateActiveBusController`, `GateDormBoardController`, and final board CSS
- Status/Squadron dorm card layout: `GateDormBoardController`, `GateComponents.dormCard`, and `gate-clean-ui-pass.css`

## Retained for later review

- `public/js/prc-dash-dorm-final-time.js`

This file is not in the active middleware stack, but it appears to describe a dorm final-time correction workflow. It was intentionally retained pending a separate behavior review.

## Rule going forward

Do not delete files solely because they have legacy names. Only delete files proven inactive by middleware, CSS imports, dynamic loaders, and workflow ownership.
