# GATE Build 2 — Status Board UX Decision Register

Status: GOVERNING FOR STATUS BOARD MIGRATION  
Scope: resolve audit-identified UX drift before any Phase 3B authorization

## Decision UX-SB-001 — Arrival time concepts are not interchangeable

Build 1 currently uses the configuration value `last_airport` in the metric labeled `LAST`. Build 2 derives the latest confirmed arrival from records that have an arrived state and a valid arrival timestamp.

These values represent different operational questions:

- **Latest Confirmed Arrival** — the most recent arrival that is confirmed by authoritative operational data.
- **Final Airport Arrival** — the manually maintained or scheduled final airport-arrival time used for planning and closeout awareness.

### Required Build 2 presentation

A visible Build 2 Status Board may not use the ambiguous label `LAST`.

- The canonical operational metric is **Latest Confirmed Arrival** and must be derived from authoritative confirmed-arrival records.
- The planning value may remain visible as **Final Airport Arrival** when configured.
- The two values must have separate labels, provenance, and empty states.
- One value may not silently substitute for the other.

### Shadow implication

The existing Phase 3A mismatch between the Build 1 `last_airport` display and the canonical derived arrival remains a documented blocker until like-for-like capture is implemented and later live samples pass.

## Decision UX-SB-002 — Phone portrait metrics remain two by two

The approved phone portrait composition is a two-column, two-row metric group for the four primary metrics.

This preserves rapid glanceability and avoids an unnecessarily tall metric stack before the user reaches active buses and dorm state.

The staged Status Board route contract and fixture must therefore use:

```text
phone portrait metricColumns = 2
```

Metric cards are display elements, not touch controls. Text must still reflow without clipping at 320 CSS pixels and at 200% and 400% zoom.

## Decision UX-SB-003 — Right-click is never the only action path

Context menus may remain an Instructor efficiency enhancement, but every operation exposed through right-click must also be available through:

1. a visible button or overflow control;
2. keyboard navigation and activation;
3. a touch-safe path;
4. the same server authorization and workflow command as the context-menu path.

No Processing or Status Board route may be accepted while a required correction action is available only through right-click, hover, or pointer-specific behavior.

## Decision UX-SB-004 — Preserve operational scan order

The visible Status Board scan order remains:

1. operational identity and synchronization state;
2. Arrived and Expected strength;
3. Latest Confirmed Arrival and Final Airport Arrival/local-time context;
4. active buses;
5. Empty, Open, and Closed dorm regions;
6. timers, loads, phases, and operational indicators within each dorm card.

Responsive composition may change column count and regional arrangement, but it may not change the operational meaning or hide critical state behind decorative interaction.

## Acceptance controls

Before a Phase 3B request:

- the route contract must preserve the phone two-by-two decision;
- the parity package must distinguish the two arrival-time concepts;
- manual evidence must verify the scan order in all six postures;
- every right-click action in the migrated surface must have visible keyboard and touch parity;
- ambiguous `LAST` labeling must be absent from the Build 2 surface.
