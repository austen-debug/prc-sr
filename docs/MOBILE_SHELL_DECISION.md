# GATE Mobile Shell Decision

Status: Phase Zero baseline
Scope: Documentation only. No runtime behavior changes.

## Purpose

This document defines the decision framework for mobile, tablet, and desktop shell behavior. GATE must stop treating mobile as a compressed desktop layout. The mobile shell must support operational workflow while preserving desktop and tablet behavior.

## Product UX contract

GATE has three primary experience modes:

1. Desktop command board
   - Used for PRC staff, command visibility, large displays, and full operational monitoring.

2. Tablet instructor console
   - Used for Processing workflows, Airman assignment, dorm updates, local arrivals, and floor-level mobility.

3. Phone field app
   - Used for quick viewing, limited updates, local arrivals, and Airman-accessible Processing support.

Each mode must be designed intentionally. A phone must not inherit a squeezed desktop nav row. A desktop must not be mutated by mobile drawer logic.

## Current mobile problem

Current active mobile behavior is spread across several files:

- `prc-dash-modal-mobile-validation.js`
- `gate-tablet-processing-modal-fix.js`
- `gate-mobile-nav-routing-fix.js`
- `gate-mobile-shell-redesign.js`
- `gate-mobile-app-shell-finalizer.js`
- `gate-desktop-nav-restore.js`
- `gate-airport-phone-layout-fix.js`
- `gate-mobile-ui-polish.css`

Observed symptoms:

- Mobile menu misrouting.
- Desktop navigation altered by mobile fixes.
- Inactive pages visible under active pages.
- Week Group display visually unstable.
- Airport mobile layout required multiple hardening patches.
- Processing tablet modal required separate scroll fix.

Conclusion:

Mobile is currently controlled by layered runtime fixes. The final product needs one responsive shell owner.

## Responsive shell breakpoints

Recommended design breakpoints:

```txt
phone portrait: 320px–480px
large phone portrait: 481px–767px
phone landscape / constrained height: coarse pointer and low height
tablet portrait: 768px–1024px
tablet landscape: 1024px–1366px
desktop: 1367px+
fullscreen board: special mode
```

Breakpoints should be based on layout need, not device names alone.

## Phone portrait shell

Visible top shell:

```txt
UNCLASS banner
Week Group chip | Menu button
```

Inside menu:

```txt
page navigation
sound control
theme control
fullscreen if applicable
role/logout
```

Rules:

- No horizontal body scroll.
- No horizontal nav row.
- No desktop utility buttons visible across the header.
- Menu must be a controlled drawer.
- Page content must fit screen width.
- Forms stack vertically.
- Tables use contained horizontal scroll only when unavoidable.

## Phone landscape shell

Rules:

- Use compressed shell height.
- Menu may use two-column drawer layout if vertical space is constrained.
- Page content must remain scrollable.
- Controls must remain reachable.
- No page should be hidden under the fixed header.

## Tablet shell

Rules:

- Tablet should not automatically receive phone UI.
- Tablet should feel like an instructor console.
- Navigation may remain more desktop-like if space supports it.
- Modals must be viewport-constrained and scrollable.
- Processing modal actions must remain reachable.

## Desktop shell

Rules:

- Desktop uses command-center horizontal navigation.
- Desktop must not receive mobile menu drawer behavior.
- Desktop must not require a desktop restoration patch in final architecture.
- Fullscreen Status Board is a special display mode.

## Page isolation decision

Current problem:

- Some pages remain in layout even when inactive.

Final rule:

- Router owns active page.
- Inactive pages are not displayable or interactive.
- Mobile, tablet, and desktop all use the same active-page state source.
- Page visibility must not depend on multiple controllers toggling classes differently.

## Menu decision

Final menu behavior:

- One drawer/menu controller.
- One click/touch route handler.
- Navigation button route must come from `data-page` or router config.
- Menu closes after successful route.
- Escape closes menu.
- Outside tap closes menu.
- Role permissions determine which nav items exist.

## Week Group display decision

Final behavior:

- Week Group is an app-state chip, not a large desktop badge on phone.
- Desktop may show fuller operational identity.
- Mobile should show compact text, for example `WG26040` or `WG 26040`.
- It must not overflow or force horizontal scroll.

## Modal decision

Final behavior:

- All modals use one modal component.
- Modal content is scrollable when needed.
- Action sections are reachable on phone/tablet.
- X button never triggers record logic.
- Airman-safe and instructor-safe behavior should be built into modal ownership, not separate safety patches.

## Airport mobile decision

Final behavior:

- Generate Airport Bus form is a vertical card on phone.
- Bus Log table can scroll horizontally inside its own container.
- Page itself should not horizontally scroll.
- Inputs are at least 44px high and use 16px+ font to avoid mobile zoom.

## Processing mobile/tablet decision

Final behavior:

- Processing dorm modal must fit viewport.
- Airman save controls must be reachable.
- Instructor actions remain hidden/blocked for Airman.
- Tap targets are at least 44px high.
- Right-click/long-press actions must not appear for Airman.

## Migration plan

1. Document current shell and nav conflicts.
2. Create canonical `ResponsiveShell` and `AppShellRouter`.
3. Move role-aware nav into `Permissions` and `NavMenu`.
4. Convert mobile drawer behavior into a single controller.
5. Remove `gate-mobile-nav-routing-fix.js` after router owns mobile routes.
6. Remove `gate-mobile-app-shell-finalizer.js` after router owns page isolation.
7. Remove `gate-desktop-nav-restore.js` after mobile shell no longer affects desktop.
8. Fold tablet and Airport mobile fixes into canonical responsive CSS.

## Acceptance criteria

Phone portrait:

- No horizontal body scroll.
- Menu opens and routes correctly.
- Week Group chip is clean.
- Page content fits viewport.
- Airport form is usable.
- Processing modal controls are reachable.

Phone landscape:

- Shell compresses naturally.
- Menu remains usable.
- Page content scrolls vertically.

Tablet:

- Tablet does not feel like phone UI.
- Processing modal scrolls and saves.
- Header/navigation remain proportional.

Desktop:

- Desktop nav remains unchanged.
- No mobile trigger appears unless intentionally responsive.
- Fullscreen board remains usable.

## Phase Zero conclusion

The next code phase should consolidate Navigation / App Shell / Mobile Shell first. Mobile must become a product-level responsive shell, not a collection of bug-specific patches.
