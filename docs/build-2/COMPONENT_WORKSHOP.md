# GATE Component Workshop

Status: Build 2 Phase 2B reference environment  
Runtime status: inactive and absent from Build 1 middleware

## Purpose

The workshop provides an isolated surface for developing and validating GATE Design Language components before any operational feature is migrated.

It is intentionally framework-neutral. The repository has not yet selected React, Vue, Svelte, Web Components, or a standards-only application architecture. Adding Storybook before that decision would introduce a framework and build-tool commitment ahead of the architecture decision record.

The current workshop provides the capabilities needed for Phase 2B without making that commitment:

- isolated component rendering;
- difficult operational states;
- light and dark theme switching;
- command, standard, and touch density switching;
- keyboard and modal interaction examples;
- safe reference fixtures;
- automated contract and markup validation.

## Source

```text
public/app/components/
├── contracts.mjs
├── render-utils.mjs
├── renderers-core.mjs
├── renderers-operational.mjs
├── gate-components.css
└── index.mjs

public/app/workshop/
├── index.html
├── workshop.css
├── workshop.mjs
└── fixtures.mjs
```

The workshop can be served as a static module page by a development server. It is not linked from the operational application or middleware manifest.

## Included states

### Actions and persistence

- primary, secondary, quiet, and destructive buttons;
- disabled/loading action;
- saved, pending, stale, conflict, and failed states.

### Fields

- normal field with help text;
- required number field;
- invalid datetime field with connected error text.

### Metrics

- confirmed arrivals;
- projected capacity;
- active bus warning;
- awaiting-assignment stale state.

### Dorms

- open female dorm;
- closed Space Force dorm;
- empty Band dorm;
- timer, location, assignment, load, and action states.

### Buses

- active airport bus;
- confirmed local arrival;
- OTW, female, NAT, Space Force, departure, and arrival facts.

### Other foundations

- captioned data table;
- success, warning, and error notifications;
- destructive confirmation dialog;
- contextual dorm-detail sheet;
- page header and command bar.

## Interaction model

The reference page binds named `data-gate-action` values through one event-delegation boundary. Components do not contain inline JavaScript handlers.

The native dialog uses `showModal()`. The sheet reference includes:

- initial focus placement;
- Tab and Shift+Tab containment;
- Escape close;
- focus restoration;
- document scroll containment.

These behaviors are reference evidence, not the final shared accessibility controller. Phase 2E will establish the canonical dialog and sheet behavior before runtime use.

## Data boundary

Workshop records are static, non-PII fixtures. They are not loaded from the operational API and cannot write to Build 1 or Build 2 repositories.

## Responsive boundary

Component styles use:

- container queries for local composition;
- hover and fine-pointer capability queries for optional enhancements;
- dynamic viewport units and safe-area variables for overlays;
- reduced-motion preferences.

The workshop contains no user-agent detection and no phone, tablet, or desktop data forks.

## Future workshop decision

After the frontend architecture ADR, Phase 2 may either:

1. retain this standards-based workshop;
2. wrap the contracts in Storybook;
3. generate framework stories from the same fixtures and contracts.

The component contracts and fixtures remain authoritative regardless of workshop tooling.
