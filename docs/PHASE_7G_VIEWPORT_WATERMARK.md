# Phase 7G — Viewport Watermark Contract

Status: Implemented
Scope: Moves the board-style watermark from page pseudo-elements to body-level route state so it stays fixed to the viewport while page content scrolls in front of it.

## Trigger

After Phase 7F, user validation confirmed the watermark was centered but still behaved as if it was tied to the scrollable page. The desired contract is a viewport-fixed watermark, not a page-scroll watermark.

## Root cause

The watermark was still attached to page pseudo-elements on active board-style pages. Those page elements can be affected by transforms, isolation, or scroll context. That can make a fixed pseudo-element behave as if it belongs to the page rather than the viewport.

## Active changes

Updated `public/js/gate-app-shell-controller.js`.

`GateAppShell` now writes active route state to the body and toggles body classes for board-style watermark pages:

- `data-gate-active-page`
- `gate-watermark-page`
- `gate-watermark-board`
- `gate-watermark-processing`
- `gate-watermark-squadron`

Updated `public/css/gate-ui-ownership-correction.css`.

The watermark now renders from a body-level viewport layer using `body.gate-app-shell-ready.gate-watermark-page::after`. The old page-level watermark pseudo-elements are explicitly disabled.

Updated `public/css/gate-mobile-corrective.css`.

The mobile corrective layer no longer adjusts page-level watermark pseudo-elements. Phone watermark positioning now also inherits from the body-level route-state layer.

Updated `functions/_middleware.js`.

The App Shell, mobile corrective CSS, and UI ownership CSS were cache-busted with `phase-7g-viewport-watermark-20260709`.

## What this phase does not change

Phase 7G does not change workflow controllers, records, backend behavior, role permissions, bus workflow, Processing workflow, Input initialization, Archive closeout/reporting, or mobile sheet behavior.

## Acceptance criteria

1. Status Board watermark remains fixed to the viewport while page content scrolls.
2. Processing watermark remains fixed to the viewport while page content scrolls.
3. Squadron Board watermark remains fixed to the viewport while page content scrolls.
4. Board content scrolls in front of the watermark.
5. No page-level watermark pseudo-element remains visible.
6. Legacy body `before` watermark remains disabled.
7. Mobile sheet and modal stacking are not reduced by watermark content rules.
8. Desktop has no phone navigation artifact leak.

## Next validation

Validate desktop first: open Status Board at the top of the page, confirm the watermark is centered in the viewport, scroll, and confirm the watermark does not move. Repeat on Processing and Squadron Board. Then validate phone menu and phone Status Board.
