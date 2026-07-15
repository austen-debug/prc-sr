# GATE Build 2 — Unified Application Shell Contract

Status: Phase 2C inactive reference contract  
Canonical owner: `public/app/shell/`

## Purpose

The unified shell owns application-level context and navigation without owning operational records, calculations, feature workflows, or persistence commands.

It establishes one source for:

- route identity and labels;
- route-level role permissions;
- current route;
- current authenticated role context;
- active Week Group display context;
- theme and density selection;
- navigation presentation and open/closed state;
- persistence status presentation;
- online/offline and last-synchronized context.

Desktop, tablet, phone, and command-display compositions must consume this shell contract. They may render the same shell state differently, but they may not create separate route or permission logic.

## Source structure

```text
public/app/shell/
├── route-registry.mjs
├── permission-registry.mjs
├── shell-state.mjs
├── shell-store.mjs
├── selectors.mjs
├── renderers.mjs
├── gate-shell.css
├── index.mjs
└── workshop/
```

## State boundary

The shell state contains UI and application context only:

```js
{
  role,
  activeRoute,
  weekGroup,
  theme,
  density,
  navigation: { mode, open },
  persistence: { status, message, updatedAt },
  connectivity: { online, lastSyncedAt },
  notice
}
```

The shell state must not contain:

- bus records;
- dorm records;
- archive records;
- receiving calculations;
- selected feature-form payloads;
- repository clients;
- authentication secrets;
- trainee PII.

Server state remains owned by repositories. Derived operational state remains owned by the domain layer. Feature-local UI state remains owned by the relevant feature module.

## Deterministic events

The reducer accepts explicit events:

```text
route.requested
role.changed
weekGroup.changed
navigation.modeChanged
navigation.opened
navigation.closed
navigation.toggled
theme.changed
density.changed
persistence.changed
connectivity.changed
sync.completed
notice.cleared
```

Reducers do not read the DOM, browser dimensions, current clock, network, storage, or global variables. Time values enter as explicit event data.

## Navigation presentations

Phase 2C defines three presentation contracts:

```text
persistent
compact
sheet
```

These are shell render modes, not device identities.

Phase 2D will determine which presentation is appropriate from available width, height, safe area, and input capability. Phase 2C does not use user-agent detection or viewport-specific JavaScript.

## Routing behavior

1. Normalize the authenticated role context.
2. Resolve permitted routes from the canonical registry.
3. Accept a requested route only when permitted.
4. Preserve the current permitted route when a request is denied.
5. Emit an explicit access notice for a denied request.
6. When the role changes, retain the route only if it remains permitted.
7. Otherwise move to that role's canonical default route.
8. Close overlay navigation after a route decision.

The shell provides client-side presentation enforcement. Server-side authorization remains mandatory for protected data and actions.

## Persistence presentation

The shell exposes explicit persistence states:

```text
idle
saving
saved
failed
conflict
stale
```

Every non-idle state has a visible and assistive-technology-readable presentation. The shell never assumes that a requested write succeeded.

Repositories and feature modules provide persistence results. The shell only displays the resulting state.

## Connectivity presentation

When offline, the shell must show:

- an offline indicator;
- that displayed data is the last confirmed dataset;
- the last synchronized timestamp when available.

The shell does not queue operational writes. Offline write reconciliation remains outside Phase 2C.

## Renderer contract

Reference renderers:

- use semantic GDL variables;
- escape shell-controlled labels and attributes;
- emit no inline event handlers;
- expose named `data-gate-action` events to the host;
- provide a skip link and application landmarks;
- mark the active route with `aria-current="page"`;
- expose sheet navigation as a modal dialog;
- include visible close controls;
- include polite persistence and connectivity live regions.

Feature content passed into the shell is trusted component output. User-controlled data must be escaped by the feature component before composition.

## Host responsibilities

A future active host must:

- supply authenticated role context from the server session;
- supply Week Group context from repositories/configuration;
- choose a navigation presentation through the Phase 2D composition contract;
- dispatch shell events;
- synchronize route changes with the active feature outlet;
- move focus to operational content after navigation;
- contain focus while sheet navigation is open;
- return focus to the invoking control when it closes;
- pass repository write results into persistence events;
- never bypass the route permission registry.

## Runtime boundary

Phase 2C source is not referenced by active middleware. Build 1 remains the operational shell until a later route-level migration gate validates parity, authorization, viewports, roles, rollback, and legacy retirement.
