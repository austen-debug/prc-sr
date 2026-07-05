# PRC GATE UI Layer Catalog

This document records the active UI execution path after the top-down UI cull. It is intended to prevent future CSS/JS layering drift, duplicate recovery layers, and theme-specific forks that make light and dark mode behave like separate applications.

## Runtime Injection Source

`functions/_middleware.js` is the runtime source of truth for injected UI files.

### Active CSS middleware order

1. `/css/gate-base-tokens.css`
2. `/css/gate-layout-pages.css`
3. `/css/gate-components.css`
4. `/css/gate-utilities-access.css`

No inline UI CSS assets are currently injected through middleware.

### Active JavaScript middleware order

1. `/js/gate-component-contracts.js`
2. `/js/prc-dash-runtime-fixes.js`
3. `/js/prc-dash-sat-arrivals.js`
4. `/js/prc-dash-space-force.js`
5. `/js/prc-dash-dorm-reopen.js`
6. `/js/prc-dash-final-audit.js`
7. `/js/prc-dash-dorm-flag-validation.js`
8. `/js/prc-dash-auditorium-location.js`
9. `/js/prc-dash-processing-context-menu.js`
10. `/js/prc-dash-local-bus-edit.js`
11. `/js/prc-dash-print-report.js`
12. `/js/prc-dash-receiving-windows.js`
13. `/js/prc-dash-archive-actions.js`
14. `/js/prc-dash-receiving-window-fields.js`
15. `/js/prc-dash-archive-print-cleanup.js`
16. `/js/prc-dash-access-control-validation.js`
17. `/js/prc-dash-modal-mobile-validation.js`
18. `/js/prc-dash-processing-loaded-summary.js`
19. `/js/prc-dash-current-summary-live-records.js`
20. `/js/prc-dash-overtime-audit.js`

## Canonical CSS Ownership

### `gate-base-tokens.css`

Owns root visual tokens, the tactical glass foundation, state badges, empty states, base board card inheritance, watermark baseline, and legacy base imports.

Current internal imports:

- `/css/liquid-command.css`
- `/css/prc-dash-nav.css`

### `gate-layout-pages.css`

Owns page-level layout, input matrix layout, archive management styling, page background/watermark base behavior, and general page visibility contracts.

Current internal imports:

- `/css/prc-dash-input-layout.css`
- `/css/prc-dash-view-cleanup.css`
- `/css/gate-archive-management.css`

### `gate-components.css`

Owns component-level legacy support and the canonical header/nav component baseline. This file still imports some older component support layers because danger actions, modal layering, dorm cards, and processing modals still depend on those styles.

Current internal imports:

- `/css/prc-dash-danger-actions.css`
- `/css/prc-dash-nav-compact.css`
- `/css/prc-dash-nav-polish.css`
- `/css/prc-dash-modal-layer.css`
- `/css/prc-dash-dorm-cards.css`
- `/css/prc-dash-modal-systems.css`

### `gate-utilities-access.css`

Owns the final utility chain and access-specific exceptions.

Current final imports:

1. `/css/gate-board-presentation.css`
2. `/css/gate-theme-unified-contract.css`
3. `/css/gate-clean-ui-pass.css`

This is the final cascade layer. Do not add another broad recovery stylesheet after this file. If a selector conflict appears, fix `gate-clean-ui-pass.css` or the relevant component contract instead.

Current access exceptions:

- Squadron Board hides trainee/airman names.
- Squadron Board hides auditorium location.

## Canonical Component Contracts

### `gate-component-contracts.js`

This file is loaded before all UI behavior patches. It owns stable render contracts for:

- Dorm Card
- Status Metric
- Header/Nav Button
- Archive Record Card
- Processing Dorm Modal identity

The Dorm Card component preserves operational state directly in the markup:

- `data-female-dorm`
- `data-band-dorm`
- `data-space-force`
- `.banner-band`
- `.banner-space-force`
- `.border-female`
- `.border-band`
- `.border-space-force`

Future UI work should style these contracts rather than creating a new post-render indicator layer.

## Board Page Intent

### Status Board

Operational purpose:

- Show receiving totals.
- Show airport/local/active-bus status.
- Group dorms by Empty / Open / Closed.
- Preserve instructor interaction with dorm cards and modals.
- Preserve female, Band, and Space Force indicators.

The Status Board should remain high-readability and command-center oriented on TV/desktop, while remaining usable on mobile for emergency access.

### Squadron Board

Operational purpose:

- Limited view of the same dorm state data.
- Hide trainee/airman names and auditorium location.
- Preserve dorm count/status/timer/load indicators.
- Preserve female, Band, and Space Force indicators without exposing trainee-specific details.

### Airport Page

Operational purpose:

- Update flight arrival time.
- Generate airport bus records.
- Track bus log totals for OTW, female, and naturalization counts.

The Airport page should retain its form workflow and table semantics. UI work may restyle the form and table, but should not alter input IDs or submit/event paths.

### Input Page

Operational purpose:

- Initialize a week group.
- Enter dorm SDQ, section, inter/section, dorm, sex, Band flag, and load.
- Maintain the high-density input matrix.

UI work should avoid changing field IDs or row-generation semantics.

### Processing Page

Operational purpose:

- Add local buses.
- Close out a week group.
- Edit dorm records through instructor workflows.
- Use the Processing Dorm Modal for airman assignment, processing phase, load control, and open/close actions.

### Archives Page

Operational purpose:

- Display arrival logs and archive records.
- Preserve archive grouping/search/edit/print workflows.
- Continue opening records through the existing archive modal/editor path.

## Mobile Contract

The mobile contract is owned by `gate-clean-ui-pass.css`.

Mobile requirements:

- Green classification banner is locked at top.
- Header/nav is locked directly below the classification banner.
- Header uses a mobile layout: logo + Menu, then system controls.
- Full navigation links live in the mobile dropdown.
- Instructor/Logout must not clip.
- Status metrics use a compact two-column grid.
- Dorm columns stack vertically.
- Dorm cards use mobile-specific larger typography and tap-friendly spacing.
- Band/Space Force banners retain a reserved top row.
- Female alert ring surrounds the full dorm card only, not the load value.

## Motion / Interaction Contract

Allowed:

- Subtle hover shadow or border change.
- Small active press state.
- Focus-visible outline for keyboard/touch accessibility.

Avoid:

- Different hover animation systems for nav versus right-side controls.
- Layout-shifting hover states.
- Scale-up effects on operational cards that affect grid geometry.
- Broad new `transition: all` rules.

## Files Removed During Cull

The following split/recovery layers were removed from the active codebase because they caused drift or duplicated the final contract:

- `gate-operational-indicators-recovery.css`
- `gate-ui-stabilization-hotfix.css`
- `gate-dark-command-structure.css`
- `gate-light-mode-consistency.css`
- `gate-light-liquid-polish.css`

## Maintenance Rule

When fixing visual issues, do not add another final stylesheet. Use this order:

1. Fix markup/contract in `gate-component-contracts.js` if the component is missing identity/state.
2. Fix shared theme tokens or structure in `gate-theme-unified-contract.css`.
3. Fix final viewport/board/mobile positioning in `gate-clean-ui-pass.css`.
4. Only touch legacy imported files when their original component still owns unique behavior, such as modal systems or danger actions.
