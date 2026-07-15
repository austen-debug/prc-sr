# GATE Build 2 Accessibility Foundation

Status: Implemented; validation pending  
Target: WCAG 2.2 Level AA  
Runtime status: staged; Build 1 remains active

## Purpose

This contract establishes the accessibility requirements every Build 2 route, component, shell surface, report viewer, dialog, sheet, notification, and operational action must satisfy before production activation.

Accessibility is an application architecture requirement. It is not a final visual review or a page-specific repair layer.

## Governing principles

1. Every workflow is operable with keyboard, touch, and pointer input.
2. Focus order follows task order and remains visible.
3. No action depends on hover, color, animation, or a right-click gesture alone.
4. Dialogs and sheets share one focus-management and dismissal contract.
5. Save, conflict, stale, offline, and failure states are visible and programmatically announced.
6. Operational state uses text and structure in addition to color.
7. Content reflows at 320 CSS pixels and remains usable at 200% zoom.
8. Reduced-motion, increased-contrast, and forced-color preferences are respected.
9. Accessibility behavior is shared; feature routes may not create private focus traps or live-region implementations.
10. Build 1 remains unchanged until a Phase 3 route passes its migration gate.

## Keyboard and focus contract

All interactive elements must be reachable in logical DOM order. Native controls are preferred.

Required behavior:

- Enter and Space activate buttons according to native semantics.
- Tab and Shift+Tab move through the task sequence.
- Visible focus indicators remain at least 2 CSS pixels thick.
- Focused controls are not obscured by fixed shell surfaces.
- Skip navigation moves directly to the route main region.
- Route changes place focus at the new page heading or main region.
- Disabled controls are not focusable unless a documented read-only explanation is required.
- Keyboard shortcuts are enhancements only and cannot be the sole way to complete an action.

## Dialog and sheet contract

`GateDialog` and `GateSheet` expose the same overlay attributes and use the shared Phase 2E overlay controller.

On open:

1. Save the invoking control.
2. expose modal semantics and the accessible name;
3. make the background inert;
4. move focus to the declared initial target or the first operable control;
5. contain Tab and Shift+Tab within the overlay.

On close:

1. close through the visible control, Cancel action, or Escape;
2. remove background inertness and restore previous accessibility attributes;
3. return focus to the invoking control when it still exists.

Blocking confirmation dialogs must not place initial focus on a destructive action.

## Touch and pointer contract

- Coarse or absent pointer capability requires a minimum 44 by 44 CSS-pixel target.
- Adjacent targets require sufficient separation or an equivalent expanded hit area.
- Hover may reveal supplemental information but cannot reveal the only action.
- Context-menu behavior must have a visible keyboard- and touch-operable equivalent.
- Dragging cannot be the only way to reorder or move operational items.

## Status and announcement contract

Routine outcomes use a polite status region. Blocking failures use an assertive alert region.

Visible text remains on screen even when an announcement is sent. Announcements are concise and describe the outcome and required next step.

Examples:

```text
Saved → "Changes saved."
Failed → "Save failed. Retry is required."
Conflict → "Conflict detected. Refresh or resolve before continuing."
Offline → "Offline. Last synchronized at 21:14."
```

Repeated timer updates are not announced every second. Only meaningful threshold changes may be announced.

## Color-independent operational state

Every governed state includes visible text and a structural marker:

```text
Arrived     ✓ Arrived
En route    → En route
Processing  … Processing
Closed      ■ Closed
Overtime    ! Overtime
Failed      × Failed
Saved       ✓ Saved
Pending     … Pending
Stale       ↻ Stale
Conflict    ! Conflict
```

Service, sex, Band, and other record attributes must also remain textually available. Rings, borders, fill colors, and icons are supplemental.

## Motion, contrast, and forced colors

- `prefers-reduced-motion: reduce` removes nonessential animation and transition duration.
- `prefers-contrast: more` strengthens borders and control separation.
- `forced-colors: active` preserves control boundaries and focus indicators through system colors.
- Flashing content is prohibited. No visual surface may flash more than three times in one second.

## Zoom, text spacing, and reflow

At 200% zoom and at 320 CSS pixels:

- the page does not require two-dimensional scrolling except for essential tabular content;
- headings, labels, controls, and messages do not overlap or clip;
- dialogs and sheets remain within the visible viewport;
- tables use a labelled horizontal scrolling region when necessary;
- text can wrap without truncating operational meaning;
- user text-spacing overrides do not hide or overlap content.

## Source ownership

```text
public/app/accessibility/
├── contract-registry.mjs
├── focus-contract.mjs
├── overlay-controller.mjs
├── announcer.mjs
├── gate-accessibility.css
├── index.mjs
└── workshop/
```

The contract and focus helpers are framework-neutral. The overlay controller and announcer are browser-native host services and do not read operational data or call repositories.

## Validation boundary

Automated tests validate contracts, markup, source ownership, focus-cycle logic, live-region semantics, CSS requirements, workshop coverage, and Build 1 isolation.

Phase 3 route migration must additionally include manual review with:

- keyboard-only navigation;
- browser zoom and text-spacing overrides;
- forced-colors/high-contrast mode;
- at least one desktop screen reader;
- mobile screen-reader gestures for touch-critical routes;
- real content at minimum and maximum operational densities.
