# GATE Design Language — Foundations

Status: Build 2 Phase 2A
Runtime status: Inactive

## Purpose

GDL provides one design language for every GATE composition. Desktop, vertical displays, tablets, phones, and command displays share the same semantic tokens and component contracts while varying density, composition, and disclosure.

## Principles

### Mission clarity
Operational state is visible before decoration.

### State before color
Color reinforces meaning but never acts as the only indicator.

### Touch certainty
Actions must remain unambiguous and reachable without hover.

### Persistent context
Week Group, route, selected record, operational state, and persistence state remain understandable.

### Progressive disclosure
Small compositions prioritize the primary task; larger compositions may show concurrent context.

### No silent failure
Persistence-facing components must be able to represent saving, saved, failed, retry-required, stale, and conflict states.

### Operational restraint
Motion and visual effects may establish hierarchy but may not reduce readability or delay workflow.

## Foundation families

- Color: primitive palette and semantic theme/state aliases.
- Typography: UI and monospaced families, controlled size and weight scales.
- Spacing: 2, 4, 8, 12, 16, 20, 24, 32, 40, and 48 pixels only.
- Radius: none, extra-small, small, medium, large, and pill.
- Motion: instant, fast, standard, deliberate, plus reduced-motion zero-duration behavior.
- Layering: base, sticky, navigation, sheet, dialog, and notification.
- Density: command, standard, and touch.
- Interaction: visible focus, 44-pixel minimum touch target, disabled state, and safe-area variables.

## Density contract

Command density supports high-information fixed command displays and pointer/keyboard workstations. Standard density is the default productive interface. Touch density increases controls, rows, padding, gaps, and targets without changing business logic or record shape.

Density is a token configuration, not a separate interface.

## Theme contract

Light and dark themes expose identical semantic keys. Components consume `surface`, `text`, `border`, and `state` aliases rather than raw palette names.

## Motion contract

Motion is tokenized and optional. `prefers-reduced-motion: reduce` sets GDL durations to zero. Operational timers, changing metrics, warnings, and status updates must not depend on animation to communicate meaning.

## Safe-area contract

GDL exposes top, right, bottom, and left safe-area values. Shell and overlay components must consume these variables rather than embedding device-specific inset logic.

## Integration boundary

The Phase 2A CSS artifact is not linked from middleware and the ES modules are not loaded by Build 1. Phase 2B and later work may consume them only inside inactive Build 2 workshop and shell surfaces until a migration gate is approved.
