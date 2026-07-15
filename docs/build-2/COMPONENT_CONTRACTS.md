# GATE Design Language — Component Contracts

Status: Build 2 Phase 2B reference contract  
Runtime status: inactive  
Contract version: `2B.1.0`

## Purpose

The component layer converts canonical data and UI state into accessible presentation. It does not determine operational eligibility, calculate metrics, call generic record APIs, or own page routing.

Every component supports the GDL density modes:

```text
command
standard
touch
```

Density changes spacing and target size only. It never changes records, permissions, actions, or operational meaning.

## Canonical component inventory

| Component | Primary responsibility | Required context |
|---|---|---|
| `GateButton` | Named user action | Label |
| `GateFormField` | Labelled form control and validation relationship | ID and label |
| `GateMetricCard` | Label/value operational metric | Label and value |
| `GateStatusPill` | Text-and-marker state reinforcement | State and label |
| `GateDormCard` | Dorm identity, state, load, and operational context | Record ID, name, state, load, capacity |
| `GateBusCard` | Airport/local bus identity and counts | Record ID, label, status, total |
| `GateDataTable` | Captioned and scoped tabular records | Caption, columns, rows |
| `GateDialog` | Focus-contained modal decision or form | ID and title |
| `GateSheet` | Contextual detail or editing surface | ID and title |
| `GateNotification` | Explicit save, warning, conflict, or failure outcome | Message |
| `GatePageHeader` | Page identity, description, status, and primary actions | Title |
| `GateCommandBar` | Named page or selection toolbar | Accessible label |

The machine-readable registry is `public/app/components/contracts.mjs`.

## Ownership boundary

Components may:

- render provided values;
- expose named actions through `data-gate-action`;
- manage presentation state such as selected, loading, open, or dismissed;
- adapt composition through GDL density and container size;
- provide semantic roles, names, descriptions, and live regions.

Components may not:

- query the DOM as an operational data source;
- calculate arrived, projected, loaded, NAT, female, or Space Force totals;
- call the records API or repositories directly;
- infer permissions from viewport or device type;
- create inline event handlers;
- emit raw page-specific colors or spacing;
- silently discard failed writes.

Feature modules bind named component actions to domain commands and typed repositories.

## Accessibility contracts

### Buttons

- native button semantics;
- Enter and Space activation;
- visible focus;
- disabled and busy states are programmatic;
- destructive action is expressed by label and context, not color alone.

### Fields

- explicit `label`/control association;
- help and error text connected through `aria-describedby`;
- invalid controls use `aria-invalid`;
- error messages use an appropriate live announcement.

### Status

Every state includes visible text. Color and position reinforce the state but cannot be the sole indicator.

### Cards

Operational cards are articles with a labelled heading. Host modules must provide accessible names for actions such as open, close, reopen, confirm arrival, and edit.

### Data tables

- visible caption;
- scoped column headers;
- scoped row headers;
- controlled horizontal scrolling;
- keyboard-reachable overflow region;
- empty, loading, and failed states remain inside the table contract.

### Dialogs and sheets

The host implementation must provide:

- focus entry;
- focus containment while modal;
- Escape close unless an irreversible operation is actively committing;
- visible close control;
- logical focus restoration;
- sticky actions where content scrolls.

The workshop uses the native dialog contract and a reference focus loop for sheets. Phase 2E will formalize the shared accessibility controller before runtime migration.

### Notifications

- ordinary updates use `status`/polite announcement;
- failures requiring immediate attention use `alert`/assertive announcement;
- dismiss controls have an accessible name;
- message text states the outcome and required next action.

## Responsive contract

Components adapt to the space of their containing region rather than device names.

- cards and headers use container queries;
- hover styling is an enhancement under hover/fine-pointer capability;
- touch targets preserve the GDL minimum;
- primary identity and operational state remain visible at every container size;
- secondary facts may wrap or disclose but cannot change calculation or workflow behavior.

## Rendering and trust boundary

Reference renderers escape labels, values, attributes, table cells, and record text. Rich body slots for dialogs and sheets accept trusted component output only. Feature code must not pass unsanitized user strings into a rich body slot.

The reference renderers intentionally contain no inline `onclick`, repository calls, route changes, or persistence logic.

## Versioning

A breaking change to required inputs, semantic meaning, action names, or accessibility behavior requires a contract-version increment and migration note. Visual token updates that preserve the contract remain within the same component version.
