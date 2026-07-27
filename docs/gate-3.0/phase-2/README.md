# GATE 3.0 Transition — Phase 2

## Enterprise Foundation and Crosscheck

Phase 2 establishes the portable GATE 3.0 enterprise foundation while continuously crosschecking every architectural decision against four protected dimensions:

1. existing functionality;
2. operational intent;
3. approved design and responsive behavior;
4. processing and data-integrity workflows.

Phase 2 is initiated from the active Phase 1 branch. It does not supersede or waive Phase 1 indexing requirements.

## Mission

Create the canonical GATE 3.0 application foundation that later phases will use to assume production ownership, without introducing a second permanent application, changing operational behavior, or allowing architecture work to drift away from the current mission.

## Binding constraints

1. Existing production behavior remains authoritative until a later replacement package proves parity and retires the old owner.
2. Phase 2 foundation code must be portable, modular, server-authoritative, testable, accessible, and independent of middleware source rewriting.
3. No visible production route may be replaced solely because a new foundation implementation exists.
4. No Phase 2 component may own operational calculations that belong to domain services.
5. No Phase 2 client may become the final authority for role permissions, destructive actions, critical writes, archive immutability, or record identity.
6. No offline queue may execute critical operational writes.
7. Every foundation package must identify the Phase 1 records, workflows, design contracts, incidents, and runtime owners it was crosschecked against.
8. Foundation work must reduce future active-runtime complexity; it may not create another permanent compatibility stack.
9. The five-phase end state remains one GATE 3.0 application with no parallel legacy runtime.

## Foundation workstreams

### 1. Application Bootstrap

Create one standards-based application entry point, route host, dependency boundary, configuration loader, error boundary, and feature activation registry.

### 2. Canonical Domain Layer

Establish authoritative models and calculations for Week Group selection, arrivals, buses, dorms, processing, timers, current summaries, archives, reports, roles, and audit events.

### 3. Repository and API Layer

Establish typed repositories, server-confirmed writes, record identity, conditional updates, conflict handling, append-only audit behavior, immutable archive handling, and limited role projections.

### 4. Workflow Orchestration

Establish verified workflows for initialization, bus dispatch and arrival, dorm open/update/close/reopen, destructive actions, closeout, amendments, partial failure, recovery, idempotency, and rollback.

### 5. GATE Design Language

Establish one token system, component contract library, density model, theme model, typography system, spacing system, status language, interaction language, and layering model.

### 6. Unified Application Shell

Establish one route registry, permission-aware navigation contract, Week Group context, persistence state, connectivity state, degraded-operation state, and role-specific shell presentation.

### 7. Responsive and Accessibility Foundation

Establish the six protected postures: desktop landscape, desktop vertical, tablet landscape, tablet portrait, phone landscape, and phone portrait. Preserve fullscreen command-display behavior, touch/keyboard parity, modal safety, visible focus, reflow, reduced motion, and WCAG 2.2 AA requirements.

### 8. Observability and Verification

Establish structured diagnostics, audit traceability, parity fixtures, route-level acceptance contracts, historical-regression suites, and evidence packages without logging trainee identity or expanding PII.

## Mandatory crosscheck dimensions

Every Phase 2 package must record:

- **Functionality:** capabilities, controls, shortcuts, reports, sounds, failure handling, and downstream effects preserved.
- **Intent:** operational problem solved, actor, decision supported, time sensitivity, and mission consequence.
- **Design:** information hierarchy, visual identity, responsive posture, command-display behavior, accessibility, touch, keyboard, and focus behavior.
- **Processing:** source records, identity binding, validation, mutation order, confirmation, audit, reconciliation, partial failure, recovery, and archive continuity.

A package fails Phase 2 review if any dimension is unknown or supported only by assumption.

## Activation boundary

Phase 2 creates and validates foundation ownership. It does not by itself authorize:

- a visible replacement route;
- retirement of a current production owner;
- deletion of original GATE files;
- activation of staged critical writes;
- permanent dual runtime;
- Squadron login activation;
- an operational service worker.

Those actions require later controlled ownership-lift packages using Phase 1 retirement gates and Phase 2 parity evidence.

## Deliverables

- `phase-2-progress.json`
- `foundation-crosscheck-matrix.json`
- `foundation-activation-gates.json`
- canonical bootstrap and module boundaries
- canonical domain and repository contracts
- canonical workflow contracts
- GATE Design Language source
- application shell, responsive, and accessibility contracts
- Phase 2 validation and exit report

## Exit criteria

Phase 2 closes only when:

- every foundation workstream has an authoritative owner;
- each owner is crosschecked against functionality, intent, design, and processing evidence;
- all protected historical corrections are represented in permanent tests or contracts;
- server authority, record identity, archive immutability, and role boundaries are explicit;
- responsive and accessibility contracts cover all six postures and fullscreen command displays;
- no active production runtime asset count has increased;
- no permanent parallel application has been created;
- every staged module has a defined later activation and legacy-retirement path;
- the complete foundation can support route-by-route ownership lift without changing mission semantics.

## Runtime effect

None at initiation. Phase 2 begins as staged enterprise foundation and verification work. Production activation belongs to later controlled packages.