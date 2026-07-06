# PRC GATE Active UI Stack Audit

_Last updated: Step 1 of UI recovery plan._

## Purpose

This document freezes the active UI/runtime stack and defines ownership boundaries before additional UI work. It exists to prevent the application from regressing into stacked CSS patches where multiple files compete for the same component.

## Current active runtime injection

`functions/_middleware.js` injects four stylesheet entrypoints in this order:

1. `/css/gate-base-tokens.css`
2. `/css/gate-layout-pages.css`
3. `/css/gate-components.css`
4. `/css/gate-utilities-access.css`

The middleware also injects the UI behavior chain beginning with `gate-component-contracts.js`, followed by the existing PRC DASH runtime/validation modules.

## Current active final CSS chain

### 1. `gate-base-tokens.css`

**Owns:**

- Root visual tokens.
- Baseline glass/card variables.
- State badge variables.
- Baseline board text/progress colors.
- Imports for `liquid-command.css` and `prc-dash-nav.css`.

**Current risk:**

This file still contains older board-card selectors. Do not add new board-card geometry here. Future cleanup should move any remaining Status/Squadron card geometry out of base tokens and into the final board-card contract.

### 2. `gate-layout-pages.css`

**Owns:**

- Page-level layout imports.
- Input matrix layout import.
- View cleanup import.
- Archive management import.
- Canvas/background/watermark baseline.

**Current risk:**

This file still defines canvas and watermark rules. Final watermark visibility is currently corrected later by `gate-clean-ui-pass.css`. Do not add component-level card or banner styling here.

### 3. `gate-components.css`

**Owns:**

- Component imports.
- Header/nav component contract.
- Modal layer import.
- Processing/modal support import.
- Processing dorm chip support through `prc-dash-dorm-cards.css`.

**Current risk:**

`gate-components.css` still imports several legacy component files. Header/nav rules here are overwritten later by `gate-clean-ui-pass.css` for the locked security/nav shell. Do not add Status/Squadron dorm-card layout here.

### 4. `gate-utilities-access.css`

**Owns:**

- Final import chain.
- Squadron Board limited-view access rules.

Current final import chain:

1. `/css/gate-board-presentation.css`
2. `/css/gate-theme-unified-contract.css`
3. `/css/gate-clean-ui-pass.css`

It also hides Squadron Board Airman and auditorium location display.

### 5. `gate-board-presentation.css`

**Owns:**

- Presentation-mode board readability and display environment rules.

**Rule:**

This file may tune board scale/readability, but it should not own Band/Space Force banner structure or Female ring behavior.

### 6. `gate-theme-unified-contract.css`

**Owns:**

- Shared semantic tokens for light/dark mode.
- Theme variable mapping.
- General component geometry baseline.

**Rule:**

This file should define universal tokens and shared component behavior only. It should not own final Status/Squadron dorm-card banner placement after Step 1.

### 7. `gate-clean-ui-pass.css`

**Owns final authority for:**

- Locked green classification banner.
- Locked nav/header shell underneath classification banner.
- Background logo/watermark final visibility.
- Status Board dorm-card grid.
- Squadron Board dorm-card grid.
- Band and Space Force full-width banner rows.
- Female alert ring around the whole dorm cell only.
- Mobile shell layout.

This is the current final board-card authority.

## JavaScript component ownership

### `gate-component-contracts.js`

**Owns:**

- Dorm Card render helper.
- Status Metric render helper.
- Nav Button render helper.
- Archive Record render helper.
- Processing Dorm Modal data-component tagging.

The Dorm Card helper renders:

- Optional Band/Space Force banner.
- Dorm name.
- Assigned Airman.
- Optional auditorium location.
- Squadron/section/inter-section info.
- Status pill.
- Timer.
- Load.
- Progress bar.
- Data attributes for `data-female-dorm`, `data-band-dorm`, and `data-space-force`.

### `prc-dash-dorm-flag-validation.js`

**Owns:**

- Behavior-only flag reconciliation after render.
- Female/Band/Space Force class and data-attribute enforcement.
- Board banners for legacy-rendered cards.
- Processing chips for Processing cards.
- Space Force edit-field preservation.
- Band/Space Force mutual exclusion.

**Rule:**

This file may insert missing indicators, but CSS layout must remain owned by `gate-clean-ui-pass.css` for Status/Squadron board cards and by `prc-dash-dorm-cards.css` only for Processing chip support.

### `prc-dash-final-audit.js`

**Owns:**

- Legacy responsive command shell patch behavior.
- Squadron page creation/support.
- Legacy render patching.

**Current risk:**

This is still a patch-behavior file. It should not become the permanent home for UI structure. Future work should move stable structures into component contracts.

## Component ownership map

| Component / Surface | Current owner | Secondary support | Do not edit for this |
|---|---|---|---|
| Security banner | `gate-clean-ui-pass.css` | `index.html` markup | `gate-components.css` |
| Header / nav shell | `gate-clean-ui-pass.css` | `gate-components.css`, `prc-dash-final-audit.js` | ad hoc inline CSS |
| Global theme tokens | `gate-theme-unified-contract.css` | `gate-base-tokens.css` | page/component files |
| Canvas / watermark final | `gate-clean-ui-pass.css` | `gate-layout-pages.css` | legacy patch files |
| Status Board layout | `gate-board-presentation.css` | `gate-clean-ui-pass.css` for cards | `prc-dash-dorm-cards.css` |
| Squadron Board layout | `gate-board-presentation.css` | `gate-clean-ui-pass.css` for cards | `prc-dash-dorm-cards.css` |
| Status/Squadron Dorm Card structure | `gate-clean-ui-pass.css` | `gate-component-contracts.js`, `prc-dash-dorm-flag-validation.js` | `gate-base-tokens.css`, `prc-dash-dorm-cards.css` |
| Band / Space Force board banners | `gate-clean-ui-pass.css` | `gate-component-contracts.js`, `prc-dash-dorm-flag-validation.js` | overlay patches |
| Female board ring | `gate-clean-ui-pass.css` | `gate-component-contracts.js`, `prc-dash-dorm-flag-validation.js` | load-number styles |
| Processing dorm cards/chips | `prc-dash-dorm-cards.css` | `prc-dash-dorm-flag-validation.js` | `gate-clean-ui-pass.css`, unless shell-wide issue |
| Processing dorm modal | `prc-dash-modal-systems.css` / `gate-theme-unified-contract.css` | `gate-component-contracts.js` tags | Status/Squadron card files |
| Airport page | `gate-theme-unified-contract.css` | page-specific original markup/scripts | board-card files |
| Input page | `prc-dash-input-layout.css` / `gate-theme-unified-contract.css` | receiving window scripts | board-card files |
| Archive page | `gate-archive-management.css` / `prc-dash-archive-actions.js` | archive print cleanup | board-card files |
| Print/PDF output | `prc-dash-print-report.js`, `prc-dash-archive-print-cleanup.js` | archive actions | screen-only CSS unless print-scoped |

## Conflict findings from Step 1

1. `prc-dash-dorm-cards.css` previously competed with `gate-clean-ui-pass.css` for Status/Squadron dorm-card geometry, banners, and Female rings. That conflict was corrected by reducing `prc-dash-dorm-cards.css` to Processing-only chip support.
2. `gate-base-tokens.css` still contains older board-card baseline selectors. These have not been removed yet because they are broader base rules and need a safer Step 2/cleanup pass.
3. `gate-layout-pages.css` still defines background/watermark baseline rules. Final visual behavior is owned by `gate-clean-ui-pass.css`, but future consolidation should reduce duplicate background ownership.
4. `gate-components.css` still owns a header/nav contract, while `gate-clean-ui-pass.css` owns the final locked security/nav shell. This is acceptable temporarily, but Step 2+ should avoid adding header changes anywhere except the final owner.
5. `prc-dash-final-audit.js` remains a patch layer. Its behavior should be slowly converted into stable component contracts only when the specific component is being rebuilt.

## Frozen rules before Step 2

1. Do not add new CSS files for board-card fixes.
2. Do not add new dorm-card layout rules outside `gate-clean-ui-pass.css`.
3. Do not style Female alerts on `.gate-dorm-load`; the ring belongs to the whole dorm card.
4. Do not use absolute positioning for Band/Space Force board banners.
5. Do not modify data behavior while doing visual-only passes.
6. Keep Processing chip styling separate from Status/Squadron board banner styling.
7. Use light/dark tokens, not separate hardcoded theme structures.

## Next step

Proceed to Step 2: rebuild the Dorm Card as the first true component contract. The target is to move from patch/repair behavior to a single stable structure for both Status Board and Squadron Board, with Processing handled as its own card variant.
