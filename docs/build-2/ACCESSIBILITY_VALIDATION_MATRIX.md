# GATE Build 2 Accessibility Validation Matrix

Status: Implemented; CI validation pending

## Automated contract matrix

| Area | Requirement | Evidence |
|---|---|---|
| Standard | WCAG 2.2 AA is the governing target | `contract-registry.mjs` and contract test |
| Keyboard | All actions use native or named keyboard-operable controls | Component contracts and workshop markup |
| Focus | Focus order is logical and wraps only inside modal overlays | `focus-contract.mjs` tests |
| Focus visible | Focus indicator is at least 2 CSS pixels and not removed | `gate-accessibility.css` assertions |
| Focus return | Closing an overlay restores the invoking control | Shared overlay controller source contract |
| Escape | Dialogs and sheets close with Escape | Shared overlay controller source contract |
| Modal background | Background becomes inert and is restored on close | Shared overlay controller source contract |
| Accessible name | Dialogs and sheets expose `aria-labelledby` | Renderer tests |
| Description | Dialogs and sheets expose `aria-describedby` when present | Renderer tests |
| Touch | Coarse/absent pointer targets are at least 44 by 44 CSS pixels | CSS and contract assertions |
| Hover | Hover is enhancement-only | Responsive and accessibility source assertions |
| Routine status | Routine outcomes use polite status regions | Announcement tests |
| Blocking failure | Blocking outcomes use assertive alert regions | Announcement tests |
| Color-independent state | Every state has text and a distinct marker | State-registry and component-render tests |
| Reduced motion | Nonessential animation and transition duration is removed | CSS assertion |
| Increased contrast | Stronger boundaries are available | CSS assertion |
| Forced colors | System colors preserve control and focus boundaries | CSS assertion |
| Zoom/reflow | 320 CSS-pixel composition is defined | CSS and workshop assertions |
| Text wrapping | Long operational text can wrap | CSS assertion |
| Table overflow | Essential tables use a labelled scroll region | Component and CSS assertions |
| Isolation | Build 1 middleware does not load Phase 2E assets | Middleware assertion |

## Manual migration matrix

Every Phase 3 route must record evidence for the following before activation.

| Test | Required evidence |
|---|---|
| Keyboard-only task completion | Complete each primary route workflow without pointer input |
| Focus sequence | Document route entry, dialog entry, close, error, and route-change focus behavior |
| 200% zoom | Screenshots or test notes showing no clipping or lost controls |
| 320 CSS-pixel reflow | Confirm single-axis page flow except essential tables |
| Text-spacing override | Confirm labels, help, errors, cards, and tables remain readable |
| Forced colors/high contrast | Confirm state and selection remain distinguishable without authored colors |
| Reduced motion | Confirm no essential meaning depends on motion |
| Screen reader desktop | Verify landmarks, route name, headings, fields, errors, tables, statuses, and overlays |
| Screen reader mobile | Verify sheet navigation, touch actions, labels, state text, and close behavior |
| Real data density | Test empty, normal, maximum, stale, conflict, failed, and overtime states |
| Destructive actions | Verify explicit confirmation, safe initial focus, and clear outcome announcement |
| Context actions | Verify every context-menu action has a visible keyboard/touch equivalent |

## Phase 2E closure conditions

```text
PASS — accessibility contract registry validates
PASS — dialog and sheet renderers expose the shared modal contract
PASS — focus-cycle and announcement helpers validate
PASS — CSS covers visible focus, touch, reflow, contrast, forced colors, and reduced motion
PASS — accessibility workshop exercises all governed behaviors
PASS — all Phase 1 and Phase 2 regression suites pass
PASS — Build 1 middleware isolation passes
PASS — Phase 2 exit report identifies Phase 3 as next
```

Automated success does not certify a production route by itself. Route-specific manual assistive-technology validation remains a Phase 3 activation gate.
