# GATE Build 2 — Phase 2C Execution Report

## Unified Application Shell

Status: COMPLETE — INACTIVE  
Runtime status: inactive; Build 1 remains operational and unchanged

## Objective

Create one framework-neutral application shell contract for route identity, route-level permissions, shell state, navigation presentation, Week Group context, persistence visibility, and connectivity visibility.

## Build 1 parity baseline

Phase 2C preserves the active route and role behavior:

```text
Instructor: Status Board, Airport, Input, Processing, Archives, Squadron Board
Airman: Status Board, Processing
Squadron: Squadron Board
```

Defaults:

```text
Instructor → Status Board
Airman → Status Board
Squadron → Squadron Board
```

Fixture:

```text
tests/build-2/shell/fixtures/B2-P2-F001-shell-parity.json
```

## Implemented source

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
    ├── index.html
    ├── workshop.css
    └── workshop.mjs
```

## Canonical ownership

### Route registry

Owns route IDs, labels, page IDs, ordering, groups, descriptions, allowed roles, and role defaults.

### Permission registry

Owns role normalization, permitted routes, default routes, and shell-control availability.

### Shell state

Owns:

- authenticated role context;
- active route;
- Week Group display context;
- theme;
- density;
- navigation presentation/open state;
- persistence presentation;
- connectivity presentation;
- access notices.

It does not contain operational records, domain calculations, repository clients, authentication secrets, or PII.

### Shell store

Owns validated event dispatch and subscriptions. It has no DOM, network, storage, or clock dependency.

### Renderers

Produce accessible reference markup with named host actions, route landmarks, active-route semantics, persistence live regions, and compact/sheet navigation contracts.

## Navigation presentations

Phase 2C defines:

```text
persistent
compact
sheet
```

The presentation is explicit state. Phase 2D will select the correct presentation from available layout and input capability. Phase 2C does not use device names or viewport-specific JavaScript.

## Persistence and connectivity

The shell visibly represents:

```text
idle
saving
saved
failed
conflict
stale
```

Offline state also includes the last synchronized timestamp when available. The shell does not queue operational writes.

## Frontend architecture decision

`FRONTEND_ARCHITECTURE_ADR.md` accepts standards-based ES modules for Phase 2 and initial route-level migration. No additional frontend runtime or package-build dependency was introduced.

## Documentation

```text
docs/build-2/APP_SHELL_CONTRACT.md
docs/build-2/ROUTE_PERMISSION_REGISTRY.md
docs/build-2/FRONTEND_ARCHITECTURE_ADR.md
docs/build-2/PHASE_2C_EXECUTION_REPORT.md
```

## Automated validation

```text
tests/build-2/shell/unified-shell.test.mjs
.github/workflows/build-2-shell-tests.yml
```

The suite validates:

1. route and permission registry integrity;
2. exact Build 1 parity fixture results;
3. least-privileged unknown-role compatibility;
4. guarded routing and role-change fallback;
5. deterministic, frozen state transitions;
6. explicit navigation overlay behavior;
7. persistence announcements;
8. validated store publication;
9. accessible route and sheet markup;
10. escaped shell-controlled labels;
11. no DOM, API, repository, or generic-record dependency in shell core;
12. token-only shell CSS;
13. no page-specific or device-specific repair rules;
14. workshop role, route, theme, density, persistence, connectivity, and focus behavior;
15. Build 1 middleware isolation.

## CI result

Final implementation-head validation:

```text
PASS — Build 2 Shell Tests
PASS — Build 2 Component Tests
PASS — Build 2 Domain Tests
PASS — Build 2 Phase 1 Validation
PASS — GDL regression within shell workflow
PASS — Build 1 middleware isolation
```

The shell workflow separates registry, state, markup, source isolation, CSS, workshop, and middleware checks so future failures identify the affected contract directly.

Validation also identified and corrected an overly broad inline-handler assertion. Escaping validation now uses hostile script markup, while inline-handler validation inspects the renderer source boundary directly.

## Runtime and rollback boundary

No Phase 2C file is loaded by active middleware. No Build 1 route, controller, page, workflow, record, API, authentication behavior, or visible interface is changed.

Rollback consists only of removing inactive shell source, workshop, tests, workflow, and documentation.

## Closure gate

```text
PASS — shell registry and state tests
PASS — Build 1 route/role parity fixture
PASS — component and GDL regression
PASS — Phase 1 regression
PASS — middleware isolation
PASS — index identifies Phase 2D as next
```

## Next workstream

```text
Build 2 — Phase 2D
Responsive Composition Contracts
```
