# ADR — Build 2 Frontend Architecture

Status: Accepted for Phase 2 and initial feature migration  
Decision date: 2026-07-15

## Decision

GATE Build 2 will use standards-based JavaScript ES modules, semantic HTML, CSS custom properties, and browser-native APIs for the unified shell and initial strangler migration.

No React, Vue, Svelte, Storybook, or third-party component runtime is introduced at this stage.

## Context

GATE must migrate incrementally beside Build 1, retain the current backend, minimize operational risk, and remain understandable to future maintainers. Phase 1 established pure domain and repository modules. Phase 2A established framework-neutral design tokens. Phase 2B established framework-neutral component contracts and renderers.

Phase 2C therefore needs a shell that can coexist with Build 1 without introducing a second application runtime or a mandatory package-build pipeline.

## Options reviewed

| Option | Strengths | Current concern |
|---|---|---|
| Standards-based ES modules | Direct repository compatibility, minimal dependencies, low migration cost, browser-native semantics | Requires disciplined internal contracts |
| React | Mature ecosystem and broad familiarity | Adds runtime, build, bundle, and parallel-tree migration cost |
| Vue | Progressive adoption and approachable components | Adds framework and mixed-runtime sustainment obligations |
| Svelte | Compact compiled output | Adds compilation and specialized maintainership |
| Web Components | Standards-based encapsulation | Adds shadow-DOM, styling, form, and accessibility complexity before it is required |

## Rationale

The primary GATE risks are duplicated ownership, layered patches, unclear state boundaries, and sustainment continuity. A framework does not automatically resolve those risks.

The approved Build 2 controls address them directly:

- canonical domain calculations;
- typed repositories;
- one GDL token system;
- one component contract library;
- one route and permission registry;
- deterministic shell state;
- automated validation;
- route-level migration and legacy retirement.

## Binding constraints

The standards-based decision does not permit ad hoc scripts. Build 2 must continue to require:

1. ES module boundaries.
2. Pure domain and selector logic.
3. Repository-owned persistence.
4. One shell store and route registry.
5. Semantic GDL tokens.
6. Named component and shell actions.
7. No inline event handlers.
8. No device-specific JavaScript layout behavior.
9. Automated accessibility and parity validation.
10. Explicit retirement of former owners during feature migration.

## Reconsideration triggers

A replacement ADR is required before changing this decision. Reconsideration must be supported by evidence involving maintainability, staffing, enterprise platform requirements, accessibility, testability, or measured performance.

## Consequence

Phase 2C, 2D, and 2E will remain framework-neutral. Phase 3 will migrate features through controlled route-level gates rather than a big-bang frontend rewrite.
