# GATE Build 2 — Responsive Composition Contracts

Status: Phase 2D implementation contract  
Runtime status: inactive; Build 1 remains operational

## Purpose

Define one measurable composition system for desktop landscape, desktop vertical, tablet landscape, tablet portrait, phone landscape, and phone portrait without creating separate applications or device-specific workflow behavior.

The posture names describe validated operating compositions. They are not user-agent classifications. A composition is selected from available geometry and capabilities.

## Governing inputs

Every responsive decision may use only:

- available viewport width;
- available viewport height;
- derived orientation;
- reusable-component container width;
- primary pointer precision: fine, coarse, or none;
- hover availability;
- keyboard availability;
- safe-area insets;
- reduced-motion preference.

The responsive layer does not use device brand, operating system, browser identity, model name, or persisted operational data.

## Six posture contracts

| Posture | Geometry contract | Navigation | Default density | Content columns | Detail presentation |
|---|---|---|---|---:|---|
| Desktop landscape | Landscape, width at least 1180px, height at least 700px | Persistent | Command | 2–4 | Side panel |
| Desktop vertical | Portrait, width at least 900px, height at least 1180px | Compact | Standard | 1–2 | Inline |
| Tablet landscape | Landscape, width at least 768px, below desktop-landscape gate | Compact | Standard | 1–3 | Sheet or inline |
| Tablet portrait | Portrait, width at least 600px, below desktop-vertical gate | Sheet | Touch | 1–2 | Sheet |
| Phone landscape | Landscape below 768px width | Sheet | Touch | 1–2 | Sheet |
| Phone portrait | Portrait below 600px width | Sheet | Touch | 1 | Sheet |

Thresholds are half-open through ordered evaluation. Every positive width and height resolves to exactly one posture.

## Boundary rules

```text
Landscape:
width >= 1180 and height >= 700  → desktop-landscape
otherwise width >= 768           → tablet-landscape
otherwise                         → phone-landscape

Portrait:
width >= 900 and height >= 1180   → desktop-vertical
otherwise width >= 600            → tablet-portrait
otherwise                         → phone-portrait
```

When width equals height, the contract resolves to landscape. This provides deterministic behavior for square command displays.

## Input-capability rules

### Pointer and target size

- Coarse or absent pointer forces `touch` density.
- Coarse or absent pointer requires at least a 44px control target.
- Fine pointer may use command, standard, or touch density according to the posture default.
- Hover styling is enabled only when both hover and a fine pointer are available.

### Keyboard

Keyboard availability is independent from pointer and posture. The contract exposes `keyboardShortcuts` only when a keyboard is explicitly available. No essential action may require a shortcut.

### Reduced motion

Reduced-motion preference disables composition animation and smooth movement. It does not change data, workflow, routing, or information availability.

## Safe-area contract

Safe-area values are normalized to non-negative finite numbers and mapped to the governed GDL safe-area variables:

```text
--gate-safe-top
--gate-safe-right
--gate-safe-bottom
--gate-safe-left
```

The shell header, main content, navigation sheet, and workshop all account for safe-area insets. Safe-area values are UI context only and are never persisted in operational records.

## Shell ownership

Viewport queries govern shell composition. The responsive layer may select among the Phase 2C navigation presentations:

```text
persistent
compact
sheet
```

The responsive layer does not redefine route labels, route permissions, Week Group context, save state, connectivity state, or authentication behavior.

## Component ownership

Reusable components adapt through container queries, not page selectors or device names.

| Container band | Width | Component behavior |
|---|---:|---|
| Compact | 0–319px | Stacked summaries, optional detail suppression, horizontal table overflow |
| Standard | 320–639px | Wrapped controls and standard detail |
| Expanded | 640px and above | Inline controls and detailed content |

The governed component contracts currently cover:

- GateMetricCard;
- GateDormCard;
- GateBusCard;
- GateDataTable;
- GatePageHeader;
- GateCommandBar.

## CSS ownership

`public/app/responsive/gate-responsive.css` owns:

- viewport-query composition values;
- safe-area shell padding;
- generic responsive grids and regions;
- component container-query behavior;
- pointer and hover enhancements;
- reduced-motion composition behavior.

It does not contain operational page selectors, raw color literals, injected runtime CSS, or Build 1 corrective rules.

## JavaScript ownership

The framework-neutral responsive modules own contract selection and validation only. They do not:

- query or mutate the DOM;
- call `matchMedia`;
- inspect user-agent strings;
- inject styles;
- call repositories or APIs;
- contain operational calculations;
- change routes or permissions.

A later host adapter may translate browser capabilities into the pure composition input. That adapter must remain separate from the contract and must not duplicate posture logic.

## Failure behavior

Invalid dimensions fall back to a safe 390×844 portrait context. Invalid pointer values fall back to coarse input. Invalid safe-area values normalize to zero. These defaults preserve a touch-safe, single-column composition without altering operational state.

## Phase 3 migration requirement

A feature route may not migrate until its page composition:

1. consumes the canonical shell posture;
2. uses container-owned component behavior;
3. preserves route permissions and domain calculations;
4. passes all six posture fixtures;
5. introduces no page-specific corrective stylesheet or device-specific layout script.
