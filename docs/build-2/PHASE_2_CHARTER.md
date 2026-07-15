# GATE Build 2 — Phase 2 Charter

## GATE Design Language and Responsive Application Shell

Status: Initiated
Runtime impact at initiation: None
Operational baseline: Build 1 remains active

## Objective

Create one governed design language, component foundation, route system, application shell, and responsive composition model for desktop, vertical displays, tablets, phones, and command displays.

Phase 2 does not migrate operational pages. It establishes the UI architecture that Phase 3 feature migrations must consume.

## Workstreams

### 2A — GDL foundations

Define semantic tokens for color, typography, spacing, radius, elevation, borders, motion, layering, density, interaction targets, safe areas, light theme, dark theme, and operational state.

### 2B — Component workshop

Build and validate foundational components in isolation, including buttons, fields, metrics, cards, dialogs, sheets, tables, notifications, page headers, and command bars.

### 2C — Unified application shell

Establish one route registry, permission registry, navigation model, shell state model, and persistent operational context contract.

### 2D — Responsive composition contracts

Validate desktop landscape, desktop vertical, tablet landscape, tablet portrait, phone landscape, and phone portrait compositions using viewport, container, and input-capability rules rather than device identity.

### 2E — Accessibility foundation

Establish WCAG 2.2 AA contracts for keyboard use, visible focus, touch targets, dialogs, status announcements, reduced motion, zoom, and color-independent state communication.

## Binding rules

1. One component system; no separate desktop and mobile applications.
2. No device-specific workflow or data behavior.
3. No new page-specific corrective CSS.
4. No layout CSS injected by JavaScript.
5. No operational calculations inside components.
6. No duplicated route or permission definitions.
7. No silent persistence state.
8. No Build 1 workflow displacement without a migration gate.
9. Build 2 design source remains inactive until validated.
10. Framework selection requires a documented architecture decision.

## Phase 2 exit gate

Phase 2 closes only when all new UI consumes GDL semantic tokens, foundational components are documented and tested, one route registry and shell model exist, all six posture contracts pass, dialog and sheet accessibility contracts pass, and no new corrective runtime layer is introduced.
