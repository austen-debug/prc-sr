# PRC GATE Page-by-Page UI Validation Pass

_Last updated after Step 1 UI stack audit and board-card banner-state repair._

## Validation scope

This is a static repository validation pass. It verifies active runtime wiring, selectors, component ownership, page markup, behavior modules, modal wiring, and print/archive flows from source code. It is not a live browser/device execution report.

## Active runtime checked

The middleware injects the active CSS stack in this order:

1. `/css/gate-base-tokens.css`
2. `/css/gate-layout-pages.css`
3. `/css/gate-components.css`
4. `/css/gate-utilities-access.css`

`gate-utilities-access.css` then loads the final active visual chain:

1. `/css/gate-board-presentation.css`
2. `/css/gate-theme-unified-contract.css`
3. `/css/gate-clean-ui-pass.css`

The middleware injects the behavior chain beginning with `gate-component-contracts.js`, followed by PRC DASH runtime, final audit, dorm flag validation, auditorium location, processing context menu, airport/local bus edit, print report, receiving windows, archive actions, access control, modal mobile validation, and overtime audit modules.

## Repair made during validation

### Finding

The Dorm Card component renderer marked Band/Space Force cards with the new canonical banner state, but the post-render dorm flag validation layer did not yet add the same class/data state when it repaired or inserted a board banner.

### Fix

`prc-dash-dorm-flag-validation.js` now returns `hasBanner`, applies `.gate-dorm-has-banner`, and sets `data-has-banner="true|false"` whenever a Band or Space Force indicator is required.

### Reason

This aligns the post-render validation layer with the renderer-owned Dorm Card contract. The CSS still has a `:has(> .gate-dorm-top-banner)` fallback, but the canonical trigger is now available from both render paths.

## Validation matrix

Legend:

- **Static pass:** Source paths are present and internally wired.
- **Needs live QA:** Requires actual browser interaction, viewport/device testing, or representative runtime data.
- **Patched:** A source-level issue was found and corrected during this pass.

---

## 1. Status Board

### Coverage requested

- Dark mode
- Light mode
- Female dorm
- Band dorm
- Space Force dorm
- Open / closed / empty
- Long dorm name
- High load
- Zero load

### Source paths checked

- `public/index.html`
- `public/js/gate-component-contracts.js`
- `public/js/prc-dash-dorm-flag-validation.js`
- `public/css/gate-board-presentation.css`
- `public/css/gate-theme-unified-contract.css`
- `public/css/gate-clean-ui-pass.css`
- `public/css/gate-utilities-access.css`

### Static validation result

**Status:** Static pass, with one patch applied.

### Findings

1. The Status Board has explicit Empty/Open/Closed columns using `col-empty`, `col-open`, and `col-closed` containers.
2. The Dorm Card renderer outputs the required state data for Female, Band, and Space Force: `data-female-dorm`, `data-band-dorm`, `data-space-force`, and `data-has-banner`.
3. The final board CSS uses `gate-clean-ui-pass.css` as the authoritative Status/Squadron card shell and uses `.gate-dorm-has-banner` plus `:has(> .gate-dorm-top-banner)` to trigger banner-card layout.
4. Female alert styling is scoped to the whole Status/Squadron dorm cell and the load number is explicitly cleared of ring/border/background styling.
5. Light/dark mode share the same component geometry through semantic tokens in `gate-theme-unified-contract.css`; only colors/surfaces/shadows differ.

### Needs live QA

- Confirm long dorm names visually truncate without hiding critical data.
- Confirm high-load and over-capacity values remain legible on desktop, tablet, and phone.
- Confirm cards with no Band/Space Force indicators still preserve the same card rhythm as banner cards.
- Confirm browser support for `:has()` fallback in the actual target browsers. The canonical `.gate-dorm-has-banner` class now reduces reliance on `:has()`.

---

## 2. Squadron Board

### Coverage requested

- Same dorm states as Status Board
- Limited view rules

### Source paths checked

- `public/index.html`
- `public/js/prc-dash-final-audit.js`
- `public/js/gate-component-contracts.js`
- `public/js/prc-dash-dorm-flag-validation.js`
- `public/css/gate-board-presentation.css`
- `public/css/gate-clean-ui-pass.css`
- `public/css/gate-utilities-access.css`

### Static validation result

**Status:** Static pass, with same board-card banner-state patch applying here.

### Findings

1. Squadron Board limited view rules remain active in `gate-utilities-access.css`: Airman visibility is hidden and auditorium location is not displayed.
2. Squadron Board shares the same Status/Squadron dorm-card shell from `gate-clean-ui-pass.css`.
3. The same `.gate-dorm-has-banner` repair applies to Squadron Board because dorm flag validation treats `#page-board` and `#page-squadron` as board-card surfaces.
4. Squadron Board metric/header layout is still owned by `gate-board-presentation.css` and final themed surfaces are handled by the shared theme tokens.

### Needs live QA

- Confirm limited view does not leave awkward blank space after Airman/auditorium hiding.
- Confirm Squadron Board title, metrics, and dorm columns remain aligned on TV, desktop, tablet, and phone.
- Confirm Band/Space Force banners in Squadron Board match Status Board geometry.

---

## 3. Processing

### Coverage requested

- Dorm modal
- Right-click/context actions
- Load controls
- Phase controls
- Female/Band/Space Force indicators

### Source paths checked

- `public/index.html`
- `public/js/prc-dash-processing-context-menu.js`
- `public/js/prc-dash-dorm-flag-validation.js`
- `public/css/prc-dash-dorm-cards.css`
- `public/css/prc-dash-modal-systems.css`
- `public/css/gate-theme-unified-contract.css`

### Static validation result

**Status:** Static pass.

### Findings

1. Processing page has the active `proc-dorm-grid`, local bus action, closeout button, and instructor edit hint in markup.
2. The Processing context menu module handles right-click/long instructor actions, creates a menu, supports Edit Record, Open Processing Controls, and Delete Record, and dismisses on click/scroll/resize/Escape.
3. Processing dorm modal markup contains Airman assignment, phase controls, load controls, full/save buttons, and open/close action section.
4. Modal CSS provides structured layout for header, modal info, Airman/location grid, phase buttons, load controls, and mobile modal behavior.
5. Processing indicator styling is intentionally separate: `prc-dash-dorm-cards.css` now owns Processing chip support only, while board banner styling remains in `gate-clean-ui-pass.css`.

### Needs live QA

- Confirm right-click context menu opens only for instructors and does not interfere with normal card click.
- Confirm mobile long-press/access behavior is acceptable in Safari/Chrome mobile.
- Confirm phase selected state and load updates persist correctly through runtime data.
- Confirm edit modal Space Force/Band mutual exclusion works in the UI.

---

## 4. Airport

### Coverage requested

- Generate bus form
- Bus list
- Edit/delete actions
- Light/dark contrast

### Source paths checked

- `public/index.html`
- `public/js/prc-dash-local-bus-edit.js`
- `public/css/gate-theme-unified-contract.css`
- `public/css/prc-dash-modal-systems.css`

### Static validation result

**Status:** Static pass.

### Findings

1. Airport page has flight-time update, Generate Airport Bus form, OTW/Female/Naturalizations inputs, validation message placeholders, and Airport Bus Log table.
2. `prc-dash-local-bus-edit.js` patches the bus log to include airport and local buses, click-to-edit rows, totals, and a Space Force column.
3. Airport bus edit modal supports bus identity/name, OTW, Female, Naturalization, and Space Force count editing.
4. Edit validation prevents invalid OTW, Female, Naturalization, and Space Force values.
5. Shared theme tokens cover light/dark inputs, surfaces, modals, borders, and focus rings.

### Needs live QA

- Confirm bus delete behavior if expected; the inspected Airport edit module supports editing, but no dedicated delete button is visible in the Airport Bus Edit Modal markup.
- Confirm table remains usable on phone widths; the current table may require horizontal scroll or responsive wrapping depending on browser.
- Confirm live totals update after airport bus edit and local bus edit.

---

## 5. Input

### Coverage requested

- Receiving windows
- Batch table
- Dropdowns
- Checkboxes
- Counts
- Mobile/tablet readability

### Source paths checked

- `public/index.html`
- `public/js/prc-dash-receiving-windows.js`
- `public/js/prc-dash-dorm-flag-validation.js`
- `public/css/gate-theme-unified-contract.css`
- `public/css/prc-dash-input-layout.css` through layout stack

### Static validation result

**Status:** Static pass.

### Findings

1. Input page includes Week Group ID, Total Expected, batch grid wrapper, Initialize Week Group action, and success overlay.
2. Receiving windows are dynamically inserted as four explicit `datetime-local` fields: Day One Start/End and Day Two Start/End.
3. Receiving windows are saved by week group in local storage and patched into dorm/archive payloads during create/update flows.
4. Space Force column is dynamically inserted into the batch table and row grid.
5. Band and Space Force mutual exclusion is enforced by the dorm flag validation layer.
6. The static batch table uses a minimum width layout, which intentionally preserves columns and relies on horizontal overflow for narrow screens.

### Needs live QA

- Confirm mobile/tablet horizontal scrolling feels acceptable and the Initialize Week Group footer remains accessible.
- Confirm receiving windows persist when changing week group and after archive creation.
- Confirm dynamic Space Force column does not desync row/header columns after adding/removing rows.

---

## 6. Archives

### Coverage requested

- Search/filter
- Year/month open/closed
- Modal
- Print/PDF flow

### Source paths checked

- `public/index.html`
- `public/js/prc-dash-archive-actions.js`
- `public/js/prc-dash-print-report.js`
- `public/js/prc-dash-receiving-windows.js`
- `public/css/gate-archive-management.css` through layout stack
- `public/css/prc-dash-modal-systems.css`

### Static validation result

**Status:** Static pass.

### Findings

1. Archive page has `archive-history` as the target container and an Archive Edit Modal in markup.
2. Archive management JS renders a toolbar with search, year/month grouping, counts, empty states, and archive record cards.
3. Year/month groups are native `details`/`summary`, with ArrowRight and ArrowLeft keyboard support.
4. Archive record cards bind click, double-click, contextmenu, Enter, and Space to the existing archive edit modal path.
5. Print/PDF button is rebound to `printArchiveReport`, preserving the existing `printArchiveSpreadsheet` flow when available and falling back to `window.print()`.
6. Print report code uses explicit receiving windows as source of truth and includes dorm, bus, and receiving-night rollup payload logic.

### Needs live QA

- Confirm generated print/PDF sheet density after browser print dialog.
- Confirm Archive Edit Modal remains usable with large JSON payloads on mobile.
- Confirm search preserves cursor position during rapid filtering.
- Confirm closed month state maintains consistent visual height in the actual browser.

---

## Cross-page checks

### Functionality still works

**Static status:** No direct runtime function names were removed during the latest UI pass. The page-specific modules still bind to existing DOM IDs and functions.

### Indicator is visible

**Static status:** Female/Band/Space Force indicators are present in renderer and validation layers. Board banners are rendered as card headers; Processing indicators are chips.

### Spacing is clean

**Static status:** Status/Squadron card spacing is now owned by one final contract. Processing and modals have separate spacing rules.

### No overlap

**Static status:** The biggest overlap risk, Band/Space Force banner mismatch, was patched by syncing `.gate-dorm-has-banner` across the renderer and validation layer. Live viewport review is still needed.

### No hidden operational data

**Static status:** Squadron Board intentionally hides Airman/auditorium per limited-view rules. Status Board retains dorm name, info, status, timer, load, progress, and indicators.

### Light/dark match structurally

**Static status:** Light and dark use shared semantic theme tokens and the same final component structure.

### Mobile/tablet/desktop do not break

**Static status:** Mobile rules exist for nav/header, board grid, modal layout, context menu, and input table overflow. Live device QA is still required.

## Open validation items requiring live QA

1. Status/Squadron board card visual confirmation after `.gate-dorm-has-banner` repair.
2. iPhone Safari and Android Chrome mobile nav/header behavior.
3. Long dorm names and long assigned Airman text.
4. Airport bus table usability on phones.
5. Archive print/PDF landscape density from the native print dialog.
6. Processing right-click/long-press behavior on touch devices.
7. Input table row/header alignment after dynamic Space Force column injection.

## Current recommendation

Proceed with a controlled Step 2 Dorm Card component rebuild only after live-checking the Status Board/Squadron Board banner-card repair. Do not add more visual CSS layers. Any further board-card work should stay inside `gate-clean-ui-pass.css` and the Dorm Card renderer/validation contract.
