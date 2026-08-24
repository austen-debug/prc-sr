# GATE 3.0 — Existing Codebase Index and Plan Alignment

Status: CURRENT-STATE ENGINEERING INDEX  
Scope: Repository architecture, active runtime, staged foundations, route ownership, migration readiness, retirement requirements, and alignment to the GATE 3.0 execution plan  
Repository: `austen-debug/prc-sr`  
Captured from: `main` at `3be5d27593dfdfd01e9de59b4e21f6b518fddbe0`  
Companion machine-readable index: [`GATE_3_0_PLAN_ALIGNMENT_MATRIX.json`](./GATE_3_0_PLAN_ALIGNMENT_MATRIX.json)

---

## 1. Purpose

This document answers four questions:

1. What code actually operates GATE today?
2. What Build 2 / GATE 3.0 foundation code already exists but is not yet visible in production?
3. Which current files own each page, workflow, component, and cross-cutting behavior?
4. What must be retained, revised, activated, or retired to execute the GATE 3.0 plan without losing functionality?

This is not a replacement for route-specific contracts, operational-truth definitions, or retirement manifests. It is the consolidated navigation layer across those records.

## 2. Authority and interpretation

When documents conflict, use this authority order:

1. [`build-2/PROGRAM_INTENT_BASELINE.md`](./build-2/PROGRAM_INTENT_BASELINE.md)
2. [`ACTIVE_RUNTIME_STACK.md`](./ACTIVE_RUNTIME_STACK.md) and `functions/_middleware.js`
3. [`build-2/PROGRAM_TRACEABILITY_MATRIX.md`](./build-2/PROGRAM_TRACEABILITY_MATRIX.md)
4. Route-specific migration and retirement contracts
5. This index
6. Historical Phase Zero and execution reports

Definitions used in this index:

| Classification | Meaning |
|---|---|
| **Active — Build 1** | Loaded or source-rewritten into the visible operational application. |
| **Active — shadow** | Loaded in production but hidden, read-only, and unable to own a visible route or write. |
| **Staged — Build 2** | Implemented and tested in the repository but excluded from the visible runtime. |
| **Compatibility** | Required temporarily to preserve Build 1 while routes migrate. |
| **Retirement target** | Must be removed, lose route ownership, or be reduced to shared infrastructure when its replacement activates. |
| **Evidence-only** | Test, fixture, workshop, or review tooling that must remain outside production routing. |

---

# PART I — EXECUTIVE CODEBASE ASSESSMENT

## 3. Current program state

GATE currently exists as two coordinated systems:

### 3.1 Visible operational system — Build 1

Build 1 remains the only visible application. It is composed from:

- a monolithic `public/index.html` containing page markup, inline handlers, legacy styles, global state, render functions, forms, modals, and workflow code;
- Cloudflare middleware that authenticates requests, rewrites portions of the served HTML, strips the served inline style block, and injects the active CSS and JavaScript stack;
- active compatibility and corrective controllers under `public/js`;
- active presentation layers under `public/css`;
- server-side session and record APIs under `functions/api`.

### 3.2 Staged replacement foundation — Build 2 / GATE 3.0 foundation

The repository already contains substantial framework-neutral replacement architecture:

- canonical operational calculations;
- canonical entity normalization and legacy compatibility boundaries;
- typed repositories and version-aware transport;
- server-enforced versions and conflict responses;
- append-only audit ownership;
- critical workflow orchestration and recovery;
- synchronization and degraded-operation contracts;
- GATE Design Language tokens;
- shared component contracts;
- unified shell, route, and permission registries;
- capability-driven responsive composition;
- WCAG 2.2 AA accessibility services;
- a hidden Status Board parity and evidence system.

Most of this foundation is implemented and tested but deliberately not loaded by active middleware.

## 4. Primary conclusion

GATE 3.0 is **not a greenfield rebuild**. The correct path is:

```text
preserve Build 1 behavior
→ activate canonical Build 2 foundations behind controlled gates
→ migrate one route at a time
→ prove parity, accessibility, responsive behavior, authorization, and rollback
→ retire the competing Build 1 owner in the same accepted migration package
```

The largest remaining engineering problem is not missing business logic. It is the gap between:

- clean staged architecture, and
- a visible Build 1 runtime with overlapping controllers, compatibility globals, middleware source rewriting, and accumulated corrective CSS.

---

# PART II — ACTIVE BUILD 1 RUNTIME INDEX

## 5. Served runtime entry path

```text
request
  ↓
functions/_middleware.js
  ├─ allows login and static assets
  ├─ verifies signed session cookie
  ├─ loads public/index.html
  ├─ normalizes visible branding
  ├─ strips the legacy inline style block from served HTML
  ├─ rewrites Status Board metric markup/functions
  ├─ injects active CSS and JavaScript
  └─ returns authenticated application shell
```

`functions/_middleware.js` is the authoritative runtime manifest. A file merely existing in the repository does not make it operational.

## 6. Active runtime totals

| Asset class | Current | Governed ceiling | Status Board activation target |
|---|---:|---:|---:|
| Direct stylesheets | 13 | 13 | 12 or fewer |
| Imported stylesheets | 3 | 3 | 3 or fewer |
| Direct scripts | 28 | 28 | 24 or fewer |
| Visible Build 2 routes | 0 | 0 until authorized | 1 controlled Status Board route |
| Hidden Build 2 observers | 1 | 1 | 0 after accepted Status Board activation |
| New corrective assets allowed | 0 | 0 | 0 |

## 7. Active stylesheet inventory

### 7.1 Direct stylesheets

| Asset | Current role | Classification | GATE 3.0 disposition |
|---|---|---|---|
| `gate-index-legacy-shell.css` | Externalized legacy `index.html` shell/page/modal baseline | Active compatibility | Retire selectors as each source-owned route replaces the monolith; remove entirely after final route migration. |
| `gate-base-tokens.css` | Current Build 1 token bridge | Active shared | Reconcile with GDL 3.0 semantic tokens, then retire duplicate primitives. |
| `gate-layout-pages.css` | Cross-page layout rules | Active shared/legacy | Remove migrated route selectors; preserve only unmigrated route rules. |
| `gate-components.css` | Active Build 1 component presentation | Active shared/legacy | Replace progressively with GDL 3.0 component contracts. |
| `gate-utilities-access.css` | Utility/access chain and imported visual layers | Active aggregation | Reduce to necessary compatibility imports; remove route-specific ownership. |
| `gate-premium-metrics.css` | Status Board metrics and active-bus presentation | Active Status Board owner | Retire when the GATE 3.0 Status Board metric components activate. |
| `gate-app-shell.css` | Current shell/navigation presentation | Active shell owner | Replace with staged unified shell presentation and retire after shell acceptance. |
| `gate-mobile-corrective.css` | Cross-page mobile repair layer | Grandfathered corrective | Retire route selectors during migrations; no GATE 3.0 component may depend on it. |
| `gate-ui-ownership-correction.css` | High-specificity ownership corrections | Grandfathered corrective | Retire. Correct ownership must live in source components. |
| `gate-light-mode-command-contrast.css` | Current light-theme contrast corrections | Active theme compatibility | Absorb valid contrast decisions into semantic Day Command tokens. |
| `gate-light-mode-grid-correction.css` | Light-mode canvas/grid correction | Grandfathered corrective | Retire after Day Command canvas tokens activate. |
| `gate-tablet-shell.css` | Legacy tablet shell and posture corrections | Active responsive compatibility | Replace with capability-driven shell composition; retire device-specific page patches. |
| `gate-fullscreen-board-contract.css` | Fullscreen Status Board containment | Active Status Board patch owner | Retire when fullscreen becomes a route/shell contract rather than a final stylesheet patch. |

### 7.2 Imported stylesheets

| Asset | Current role | GATE 3.0 disposition |
|---|---|---|
| `gate-board-presentation.css` | Status/Squadron board responsive presentation | Remove Status Board selectors at first route activation; retain Squadron selectors only until Squadron migration. |
| `gate-theme-unified-contract.css` | Existing semantic light/dark component bridge | Use as implementation evidence; supersede with versioned GDL 3.0 tokens. |
| `gate-clean-ui-pass.css` | Shared shell and board-card correction layer | Remove migrated route selectors and ultimately retire as source components become authoritative. |

## 8. Active JavaScript inventory

| Asset | Current responsibility | Classification | GATE 3.0 disposition |
|---|---|---|---|
| `gate-record-display-contract.js` | Stable display/input order and record-identity resolution for legacy consumers | Active compatibility | Retain until all dependent routes consume canonical entities and order fields. |
| `gate-component-contracts.js` | Build 1 render helpers for dorm cards, active buses, metrics, nav, and archives | Active compatibility | Retain only for unmigrated routes; remove route branches as GDL components activate. |
| `gate-ui-hooks.js` | Wraps legacy `renderAll()` and `showPage()` and hosts lifecycle compatibility | Active compatibility | Retain during strangler migration; GATE 3.0 routes must not depend on global wrappers. |
| `gate-branding-controller.js` | Normalizes visible GATE terminology | Active shared | Absorb stable identity into source markup/shell; retain only if unmigrated content requires normalization. |
| `prc-dash-runtime-fixes.js` | Runtime safeguards including sound unlock, modal/load limits, Escape, and Input tab behavior | Grandfathered corrective | Replace with component, accessibility, and workflow contracts; retire. |
| `prc-dash-sat-arrivals.js` | SAT arrivals board/integration support | Active Airport support | Preserve behavior; migrate to named Airport integration/service with explicit freshness and failure states. |
| `prc-dash-space-force.js` | Space Force compatibility and legacy field normalization | Active compatibility | Retire after canonical entity/attribute handling is active on all dependent routes. |
| `prc-dash-dorm-reopen.js` | Legacy dorm reopen support | Active Processing compatibility | Replace with `reopenDormWorkflow`; retire after Processing migration. |
| `prc-dash-final-audit.js` | Dorm Board ownership and dynamic Squadron Board support | Active board compatibility | Remove Status Board ownership at Status migration; remove Squadron ownership at Squadron migration. |
| `gate-status-board-controller.js` | Visible Status Board columns, cards, active buses, and timer refresh | Active Status Board owner | Retire after accepted GATE 3.0 Status Board activation. |
| `gate-processing-controller.js` | Processing page and dorm-modal behavior | Active Processing owner | Retire after Processing route acceptance. |
| `prc-dash-dorm-flag-validation.js` | Female/Band/Space Force identity and indicator validation | Active shared compatibility | Preserve rules, move to canonical entity/component contract, then retire legacy renderer participation. |
| `prc-dash-auditorium-location.js` | Auditorium/location field support | Active Processing/board compatibility | Preserve approved field; move to canonical Processing workflow and authorized display projections. |
| `gate-bus-workflow-controller.js` | Airport dispatch, local arrivals, combined log, edit modal, count preservation | Active Airport/Processing workflow owner | Replace with typed repository and named arrival workflows during Airport/Processing migration. |
| `gate-airport-bus-delete-controller.js` | Instructor airport-bus deletion path | Active Airport workflow extension | Move to named authorized deletion/correction workflow with visible keyboard/touch path; retire context-only owner. |
| `gate-input-page-controller.js` | Receiving windows, Space Force batch column, mutual exclusion, preflight, payload preservation | Active Input compatibility owner | Preserve validation and fields; migrate into source-owned Input route and initialization workflow. |
| `gate-archive-controller.js` | Archives, reporting, print/PDF, closeout presentation | Active Archives owner | Replace with canonical archive/report route while preserving create-verify-clear safety. |
| `gate-permission-guard.js` | Client-side protected-action guard | Active access compatibility | Replace route/action decisions with canonical registries and server authorization; retain only during migration. |
| `gate-tablet-shell-classifier.js` | Legacy tablet posture classification | Active responsive compatibility | Retire when capability-driven responsive composition selects shell presentation. |
| `gate-app-shell-controller.js` | Visible route state, navigation, drawer/sheet behavior, Week Group context | Active shell owner | Replace with staged unified shell/store/registry. |
| `gate-fullscreen-board-layout-controller.js` | Measures and contains fullscreen board | Active Status Board/shell compatibility | Retire or reduce to a shared fullscreen primitive with no route patch ownership. |
| `prc-dash-modal-mobile-validation.js` | Mobile modal and overflow corrections | Grandfathered corrective | Replace with shared `GateDialog`/`GateSheet` and touch-density rules; retire. |
| `gate-render-stability-fix.js` | Post-render/compositing stabilization | Grandfathered corrective | Retire. Deterministic rendering must remove the need for post-render repair. |
| `prc-dash-processing-loaded-summary.js` | Arrived versus loaded Processing summary | Active Processing support | Replace with canonical `calculateAssignmentSummary()` output. |
| `gate-premium-metrics-controller.js` | Visible Status Board metric composition | Active Status Board owner | Retire when source-owned GATE 3.0 metrics activate. |
| `prc-dash-overtime-audit.js` | Timer/sound/overtime compatibility | Active timer owner/compatibility | Move display to deterministic timer component and operational audit to canonical workflow/domain owner; retire Status Board branch. |
| `gate-status-board-timer-visual-stability.js` | Warning/critical class refresh | Grandfathered Status Board correction | Retire when timer state is rendered deterministically. |
| `gate-status-board-shadow-controller.js` | Hidden, read-only Build 1/Build 2 parity observer | Active shadow | Retain through evidence and controlled activation; remove after final acceptance. |

## 9. The `public/index.html` monolith

`public/index.html` still contains or defines the base source for:

- legacy tokens and page styles;
- the fixed security banner and navigation;
- `showPage`, `buildNav`, `renderAll`, and global application state;
- Status Board source markup;
- Airport form and bus log;
- Input batch matrix and initialization action;
- Processing page, load controls, phase controls, and open/close actions;
- Archives page;
- Dorm Processing modal;
- dorm correction modal;
- local arrival modal;
- bus edit modal;
- archive edit modal;
- generic confirmation surfaces;
- numerous inline `onclick`, `onsubmit`, and key handlers.

The middleware strips the large inline style block only from the served response. The source remains monolithic. GATE 3.0 must move markup and behavior into source-owned route modules instead of adding further middleware replacement expressions.

## 10. Middleware source rewriting

Current middleware performs temporary Build 1 compatibility transformations, including:

- normalizing the served title and legacy visible terminology;
- stripping the legacy inline style block;
- injecting replacement Status Board telemetry markup;
- replacing `updateAirportMetric()` by regular expression;
- replacing the legacy arrived/expected writer by regular expression;
- injecting all active UI assets.

The Status Board activation package must remove Status Board markup/function rewriting. The final route must be served from owned source modules.

---

# PART III — SERVER, DATA, AND WORKFLOW INDEX

## 11. Server and API surface

| Source | Current responsibility | GATE 3.0 action |
|---|---|---|
| `functions/_middleware.js` | Authentication gate and served-HTML transformation/injection | Retain authentication; eliminate route-function rewriting as routes migrate. |
| `functions/api/_middleware.js` | API session/role boundary | Preserve and validate role enforcement for every migrated command. |
| `functions/api/login.js` | Session creation | Preserve contract; verify environment bindings and security behavior. |
| `functions/api/logout.js` | Session termination | Preserve and integrate with unified shell. |
| `functions/api/session.js` | Authenticated session context | Preserve as shell role source. |
| `functions/api/records.js` | Authoritative generic record API with versioning compatibility | Preserve transport while migrated features use typed repositories and conditional writes. |
| `functions/api/records-contract.mjs` | Server record/version/role contract | Treat as canonical API contract. |
| `functions/api/sat-arrivals.js` | SAT arrival integration endpoint | Audit freshness, errors, authorization, and payload boundary before Airport migration. |
| `functions/api/archive-delete.js` | Archive deletion endpoint | Reconcile with immutable archive/amendment policy and explicit authorization. |

## 12. Canonical domain layer — staged

Source root: `public/app/domain/`

Primary owned concepts include:

- active Week Group selection;
- confirmed-arrival eligibility;
- manifested versus arrived bus totals;
- Air Force / Space Force / female / NAT partitioning;
- dorm identity, state, load, and grouping;
- Processing assignment summaries;
- deterministic timers and overtime thresholds;
- shared Status/Squadron summaries;
- Current Summary and Archive Report models;
- immutable archive snapshot construction;
- Receiving Night One/Two windows and half-open boundary logic.

Binding rules:

- no DOM access;
- no browser globals;
- no network calls;
- no persistence;
- no rendering;
- no source-record mutation;
- deterministic output from explicit inputs.

Critical definitions already implemented:

```text
confirmed arrival = status "arrived" AND valid arrived_at
projected total   = sum of dorm capacity
awaiting assignment = max(arrived - loaded, 0)
over-assigned       = max(loaded - arrived, 0)
receiving window    = start <= arrived_at < end
```

GATE 3.0 route code must consume these selectors rather than recalculate totals in page controllers.

## 13. Canonical data and repository layer — staged

Source root: `public/app/data/`

```text
feature/workflow command
  → typed repository
  → records client
  → version-aware transport
  → server-authoritative records API
```

Implemented repository families:

- `GateBusRepository`
- `GateDormRepository`
- `GateArchiveRepository`
- `GateConfigRepository`
- `GateAuditRepository`

Capabilities:

- canonical entities and provenance;
- legacy record normalization at one boundary;
- expected-version forwarding through `If-Match`;
- stable `409 conflict` translation;
- server-derived role provenance;
- append-only audit events;
- reduced Squadron read-only projection.

Migration rule: no GATE 3.0 component or route renderer may call `/api/records` directly.

## 14. Critical workflow layer — staged

Source root: `public/app/workflows/`

Implemented workflows include:

### Airport and arrival

- `dispatchAirportBusWorkflow`
- `createLocalArrivalWorkflow`
- `confirmArrivalWorkflow`
- `correctArrivalCountsWorkflow`

### Dorm

- `updateDormLoadWorkflow`
- `openDormWorkflow`
- `closeDormWorkflow`
- `reopenDormWorkflow`
- `correctDormFinalTimeWorkflow`

### Week Group

- `initializeWeekGroupWorkflow`
- partial-initialization resume and compensation

### Archive

- `closeoutWeekGroupWorkflow`
- `amendArchiveWorkflow`
- audit and closeout recovery workflows

Every critical workflow follows:

```text
validate
→ load authoritative state
→ persist with expected version
→ refetch authoritative state
→ verify postcondition
→ append required audit event
→ report complete
```

The UI must represent `complete`, `partial`, `failed`, `conflict`, and `blocked`. A partial result cannot be reduced to a generic success/failure toast.

## 15. Synchronization and degraded operation — staged

Source root: `public/app/synchronization/`

Implemented rules:

- records API remains authoritative;
- one last-confirmed canonical record set may remain in memory only;
- `BroadcastChannel` carries invalidation identifiers, not operational payloads;
- foreign changes force stale/read-only state and authoritative refetch;
- states are `unknown`, `syncing`, `current`, `offline`, `stale`, and `failed`;
- critical writes are permitted only when online, current, authoritative, and not stale;
- no offline operational write queue;
- no IndexedDB/localStorage operational database;
- static-shell service-worker cache only; `/api/*` remains network-only.

This foundation aligns directly with the GATE 3.0 requirement for visible synchronization and no silent failure, but it is not yet the active owner.

---

# PART IV — STAGED APPLICATION FOUNDATION INDEX

## 16. GATE Design Language foundation

Source root: `public/app/design/`

Current staged version: `2A.1.0`

Implemented:

- primitive and semantic token registries;
- equivalent dark/light semantic keys;
- operational and persistence state colors;
- spacing scale `2, 4, 8, 12, 16, 20, 24, 32, 40, 48`;
- radius, motion, layer, safe-area, focus, and touch contracts;
- Command, Standard, and Touch density modes.

### GATE 3.0 gap

The architecture is usable, but the visual contract must be versioned and refined to the approved GATE 3.0 Unified UI language:

- Night Command and Day Command must be formally named and documented;
- final GATE 3.0 color values must replace or alias the `2A.1.0` palette;
- typography must be reconciled: active Build 1 uses DM Sans, staged GDL uses Inter plus system mono, while the approved 3.0 specification uses a more deliberate display/body/data hierarchy;
- glass, elevation, command-display, and attribute-indicator tokens must be governed rather than page-specific;
- version should advance to `3.0.0` when semantic meaning is finalized.

## 17. Component foundation

Source root: `public/app/components/`

Current staged canonical inventory:

- `GateButton`
- `GateFormField`
- `GateMetricCard`
- `GateStatusPill`
- `GateDormCard`
- `GateBusCard`
- `GateDataTable`
- `GateDialog`
- `GateSheet`
- `GateNotification`
- `GatePageHeader`
- `GateCommandBar`

### GATE 3.0 gap

Expand without creating private page variants:

- icon buttons;
- select, checkbox, radio, and toggle primitives;
- tabs/segmented controls where justified;
- progress and timer components;
- attribute tags and dorm banners;
- archive record, list, empty, error, loading, and conflict states;
- synchronization indicator;
- shared menu/context action component with visible keyboard and touch parity.

## 18. Unified application shell

Source root: `public/app/shell/`

Implemented:

- canonical six-route registry;
- Instructor, Airman, Squadron route permissions;
- deterministic shell state and store;
- active route and Week Group context;
- theme and density state;
- persistent, compact, and sheet navigation presentations;
- persistence and connectivity presentation;
- skip link, landmarks, `aria-current`, live regions, and named host actions.

Shell state intentionally excludes operational records, domain calculations, repositories, credentials, and PII.

### GATE 3.0 gap

- connect the shell to authenticated server session context;
- bind a migrated route outlet;
- integrate fullscreen/command-display state as a shared shell capability;
- apply final GDL 3.0 tokens;
- activate only through a governed route migration package;
- retire current shell and tablet/mobile classifiers when accepted.

## 19. Responsive composition

Source root: `public/app/responsive/`

Validated posture contracts:

| Posture | Reference geometry | Navigation | Density |
|---|---:|---|---|
| Desktop landscape | 1440×900 | Persistent | Command |
| Desktop vertical | 1080×1920 | Compact | Standard |
| Tablet landscape | 1024×768 | Compact | Touch |
| Tablet portrait | 820×1180 | Sheet | Touch |
| Phone landscape | 740×360 | Sheet | Touch |
| Phone portrait | 390×844 | Sheet | Touch |

Component container bands:

- Compact: `0–319px`
- Standard: `320–639px`
- Expanded: `640px+`

### GATE 3.0 gap

- add explicit ultra-wide and fixed-TV validation fixtures without creating a separate application;
- preserve the six canonical posture decisions while treating TV and ultra-wide as expanded command compositions;
- complete real-device validation, safe areas, 200% zoom, text scaling, burn-in, and long-duration fullscreen evidence;
- retire active device-specific repair scripts/styles as migrated routes consume this system.

## 20. Accessibility foundation

Source root: `public/app/accessibility/`

Implemented:

- WCAG 2.2 AA contracts;
- focus and keyboard order;
- shared dialog/sheet overlay controller;
- inert background and focus restoration;
- polite and assertive announcer;
- 44×44 touch minimum for coarse/absent pointers;
- reduced motion, increased contrast, forced colors;
- 320 CSS-pixel reflow and 200% zoom requirements;
- color-independent operational states.

### GATE 3.0 gap

- integrate shared services into each visible route;
- inventory every right-click, long-press, and hover action and provide visible equivalents;
- complete screen-reader, keyboard-only, forced-color, zoom, and real-device evidence;
- remove private modal/focus implementations after route migration.

## 21. Status Board shadow and evidence system

Source root: `public/app/status-board-shadow/`

Current status:

- hidden and read-only observer active;
- canonical and legacy snapshots compared from the same records;
- arrived, expected, active bus, dorm membership/state, and timer parity supported;
- six-posture route contract exists;
- evidence remains memory-only;
- fixture review harness remains outside middleware;
- visible Phase 3B surface is not authorized.

Known governing UX corrections:

- **Latest Confirmed Arrival** and **Final Airport Arrival** are separate concepts;
- ambiguous `LAST` is prohibited in the migrated route;
- phone portrait metrics remain two-by-two;
- right-click is never the only action path;
- operational scan order is preserved across compositions.

---

# PART V — ROUTE-BY-ROUTE PLAN ALIGNMENT

## 22. Status Board

| Area | Current Build 1 | Staged foundation | Remaining GATE 3.0 work |
|---|---|---|---|
| Metrics | Middleware-injected markup plus premium metrics controller | Canonical selectors and shadow snapshot | Create source-owned metrics using separate arrival concepts and GDL components. |
| Active buses | Build 1 component/helper plus hooks/controller | Canonical bus selectors | Bind one `GateBusCard` lane to authoritative state. |
| Dorm cards | Multiple compatibility renderers and CSS layers | Canonical dorm selector and staged component | Implement all approved attribute variants and deterministic state presentation. |
| Timers | Legacy timer/audit plus visual-stability layer | Canonical timer domain and route policy | Use one timer presentation owner; preserve 40/50/60 policy without flashing. |
| Fullscreen/TV | Dedicated CSS and JS containment patches | Route fullscreen contract | Implement stable opaque command-display composition and long-duration validation. |
| Responsive | Multiple active corrections | Six-posture and container contracts | Add ultra-wide/TV evidence; maintain phone 2×2 metrics. |
| Migration readiness | Visible Build 1 plus hidden shadow | Most advanced route | Complete Gate 2, live/manual evidence, controlled feature flag, net-negative activation, and legacy retirement. |

**Readiness:** Foundation strong; evidence and retirement incomplete.  
**Next decision:** Audit Remediation Gate 2, then evidence closure—not immediate visible activation.

## 23. Processing

| Area | Current Build 1 | Staged foundation | Remaining GATE 3.0 work |
|---|---|---|---|
| Page/card grid | `index.html` plus `gate-processing-controller.js` | Dorm/processing domain and component contracts | Build source-owned route and adaptive grid. |
| Processing modal | Base modal plus mobile validation and supporting controllers | `GateDialog`, `GateSheet`, shared overlay | Consolidate into one modal/sheet controller. |
| Load/phase/assignment | Inline/global handlers | Typed dorm repository and named workflows | Bind all actions to version-aware workflows and explicit states. |
| Open/close/reopen/final time | Multiple compatibility paths | Named dorm workflows with verification/audit | Replace all direct writes and preserve recovery/conflict behavior. |
| Arrived vs loaded | Separate injected summary | Canonical assignment summary | Render canonical values only. |
| Instructor correction | Right-click/context paths | Accessibility decision requires parity | Add visible overflow action, keyboard path, and touch sheet using same command. |
| Roles | Patched UI guards | Shell registry plus server role provenance | Verify each action at server/workflow level. |

**Readiness:** Domain and workflows exist; route/component integration not started.  
**Principal risk:** highest visible workflow fragmentation after Status Board.

## 24. Airport

| Area | Current Build 1 | Staged foundation | Remaining GATE 3.0 work |
|---|---|---|---|
| Dispatch | Base form plus bus controller capture | `dispatchAirportBusWorkflow` | Build one form/action path with pending/complete/conflict states. |
| Local arrivals | Shared modal/controller | `createLocalArrivalWorkflow` | Decide shared route entry while retaining role permissions. |
| Arrival confirmation | Active bus interaction/global handler | `confirmArrivalWorkflow` | Bind source action and authoritative refresh. |
| Count correction | Bus edit modal | `correctArrivalCountsWorkflow` | Use expected versions and conflict resolution. |
| Deletion | Instructor context controller | Requires named authorization decision | Make visible/keyboard/touch accessible and audit its operational policy. |
| SAT arrivals | Separate active support script/API | No final migrated service owner | Define integration service, freshness, error, and authorization contract. |
| Bus log | Base table plus controller | Canonical manifested bus totals | Build one responsive table/list without confusing manifested and arrived totals. |

**Readiness:** Repository/workflow foundation exists; visible route is still coupled to monolith.

## 25. Input

| Area | Current Build 1 | Staged foundation | Remaining GATE 3.0 work |
|---|---|---|---|
| Batch matrix | `index.html` | Canonical entity/identity contracts | Build source-owned desktop matrix and phone sequential composition from one model. |
| Receiving windows | Input controller patch | Canonical receiving window validation | Bind to shared field components and timezone-aware values. |
| Band/SF attributes | Dynamic column and mutual exclusion | Canonical entity attributes | Preserve mutual exclusion in domain validation and UI. |
| Expected strength | Base total calculation | Canonical capacity totals | Remove UI-owned arithmetic. |
| Initialization | Inline function plus preflight patch | Resumable `initializeWeekGroupWorkflow` | Bind saga progress, partial state, retry, and compensation UI. |
| Active Week Group | Build 1 config writes | Canonical owner sets active last | Enforce workflow sequence and verified success. |

**Readiness:** Workflow foundation is mature; route and progress/recovery presentation are missing.

## 26. Archives and Reports

| Area | Current Build 1 | Staged foundation | Remaining GATE 3.0 work |
|---|---|---|---|
| Archive list/search | Monolith plus archive controller | Typed archive repository | Build source-owned archive route and filters. |
| Current Summary | Separate live-record support and print controllers | Shared canonical report model | Remove direct API/report recalculation and render shared model. |
| Closeout | High-value create/verify/clear compatibility logic | `closeoutWeekGroupWorkflow` | Bind saga phases, partial recovery, and operation ID. |
| Archive correction | Existing edit/delete behavior | Immutable amendment workflow | Replace ordinary parent overwrite with amendment creation. |
| Print/PDF | Multiple delegated controllers | Rendering model exists | Consolidate one report renderer and reference-output tests. |
| Deletion | Existing override path/API | Policy must align with immutable history | Restrict or formally authorize deletion; audit every action. |

**Readiness:** Strong canonical workflow foundation; policy and route integration remain.

## 27. Squadron Board

| Area | Current Build 1 | Staged foundation | Remaining GATE 3.0 work |
|---|---|---|---|
| Route | Dynamically inserted by board controller | Canonical route registry | Create real source route. |
| Data | CSS/renderer hides restricted detail | Server reduced projection implemented | Ensure restricted fields are absent from payload, not merely hidden. |
| Authorization | Client route restrictions; login inactive | Server role provenance and read-only projection | Activate only after environment binding and endpoint tests. |
| Presentation | Shares patched board card structure | Shared truth and components staged | Build limited command-display composition with no write controls. |
| Fullscreen/TV | Depends on legacy board/shell behavior | Shared responsive/fullscreen contracts | Validate long-duration TV use and distance readability. |

**Readiness:** Must remain last in approved sequence. Server-side data minimization is the acceptance center of gravity.

---

# PART VI — GATE 3.0 PLAN PHASE ALIGNMENT

## 28. Plan status matrix

| Plan phase | Repository status | Assessment | Required next action |
|---:|---|---|---|
| 0 — Program control and baseline lock | Substantially present | Program baseline, traceability, runtime budget, ownership, fixtures, and migration rules exist. | Approve GDL 3.0 specification as governing; assign named owners; merge this current-state index. |
| 1 — Runtime-owner reduction | **Next** | Gate 1 complete; active stack still contains grandfathered corrective assets and competing owners. | Execute Gate 2 one bounded removal at a time with runtime-integrity tests. |
| 2 — GDL 3.0 foundation | Foundation implemented as `2A.1.0`, staged | Architecture is correct; final unified visual language and version are not yet canonical in source. | Issue GDL 3.0 token/typography ADR and update registries/workshop/tests. |
| 3 — Unified shell | Implemented and staged | Route, role, state, persistence, and navigation contracts exist. | Apply GDL 3.0, add command-display/ultra-wide validation, integrate only through route gate. |
| 4 — Shared components | Implemented and staged at baseline | Twelve canonical contracts exist; 3.0 specification requires expanded inventory and states. | Expand workshop and contracts before visible route work. |
| 5 — Status Board migration | Phase 3A shadow active | Canonical truth and comparison exist; visible route unauthorized. | Complete Gate 2, evidence closure, controlled route plan, and retirement delta. |
| 6 — Processing migration | Domain/workflows staged | Build 1 remains fragmented; no Build 2 route. | Inventory all actions/modals and build route after Status acceptance. |
| 7 — Airport migration | Repositories/workflows staged | Active workflow overlaps base source; SAT integration needs explicit contract. | Build route after Processing and bind named workflows. |
| 8 — Input migration | Initialization workflow staged | Active matrix remains monolithic. | Build one adaptive data model with saga/recovery presentation. |
| 9 — Archives/Reports migration | Canonical report/archive/workflows staged | Visible behavior fragmented; correction policy needs amendment alignment. | Consolidate route, report renderer, and closeout recovery. |
| 10 — Squadron Board migration | Reduced server projection staged; login inactive | Dynamic Build 1 page remains. | Activate last after server authorization and payload-minimization evidence. |
| 11 — System integration and acceptance | Foundation regression suites mature | Route-level real-device/manual evidence incomplete. | Build a retained system evidence packet across all postures/roles/routes. |
| 12 — Deployment, training, sustainment | Governance and rollback documents partial | No visible Build 2 route authorized. | Develop operator guides, deployment runbook, feature-control, monitoring, and sustainment ownership before production activation. |

---

# PART VII — TEST, EVIDENCE, AND GOVERNANCE INDEX

## 29. Existing automated validation families

- `tests/runtime/`
  - active runtime budget;
  - record display integrity.
- `tests/build-2/domain/`
  - operational truth, dorm identity, timers, reports, and summaries.
- `tests/build-2/data/`
  - normalization, canonical entities, repositories, provenance.
- `tests/build-2/workflows/`
  - critical workflows, recovery, idempotency.
- `tests/build-2/synchronization/`
  - invalidation, stale/offline, guarded writes, cache boundaries.
- `tests/build-2/design/`
  - tokens, themes, density, spacing, motion.
- `tests/build-2/components/`
  - contracts, rendering, workshop coverage.
- `tests/build-2/shell/`
  - routes, permissions, state, store, markup.
- `tests/build-2/responsive/`
  - postures, thresholds, capabilities, containers.
- `tests/build-2/accessibility/`
  - focus, overlays, live regions, CSS contracts.
- `tests/build-2/status-board-shadow/`
  - parity, route readiness, evidence, rollback boundaries.
- `tests/build-2/foundation/` and `parity/`
  - consolidated foundation and Build 1 equivalence.

## 30. Evidence still required

Repository tests cannot substitute for:

- sustained live shadow operation;
- representative operational records at minimum and maximum density;
- TV/fullscreen entry, exit, Escape, focus restoration, burn-in, and long-duration stability;
- ultra-wide command-workstation composition;
- iPad landscape ergonomics;
- phone portrait/landscape touch paths;
- hardware keyboard behavior;
- desktop and mobile screen readers;
- 200%/400% zoom and text-spacing overrides;
- forced colors and increased contrast;
- stale/offline/reconnect behavior against deployed services;
- deployed API version/conflict/audit triggers;
- environment-bound role authentication;
- exercised rollback.

## 31. Non-negotiable migration controls

- No big-bang rewrite.
- No new PII or trainee-level records.
- No second visible owner for the same route or workflow.
- No new corrective runtime asset.
- No page-specific responsive system.
- No critical write without server confirmation, authoritative refetch, verification, and required audit.
- No optimistic or queued offline critical write.
- No route activation without rollback.
- No legacy owner retirement before accepted replacement evidence.
- No visible route activation that increases the active runtime count.

---

# PART VIII — CURRENT RISK REGISTER

## 32. Critical risks

| Risk | Current evidence | Control |
|---|---|---|
| Duplicate runtime ownership | Monolith plus 28 injected scripts and multiple corrective layers | Gate 2 owner reduction; one owner per migrated surface. |
| Middleware-manufactured application logic | Status Board HTML and functions are regex-rewritten | Remove rewrite in Status activation package. |
| Build 1 global-state coupling | `allData`, `renderAll`, `showPage`, inline handlers | Canonical store, domain selectors, named actions, route modules. |
| Responsive regression | Active phone/tablet/fullscreen repair history | Capability-driven shell and container contracts; real-device evidence. |
| Record-to-card drift | Historical positional mapping defect | Canonical IDs, explicit display order, immutable entities, identity tests. |
| Timer/render instability | Historical duplicate intervals and forced rebuilds | One deterministic timer owner and signature/store-driven rendering. |
| Silent/optimistic write claims | Build 1 compatibility workflows may not expose all phases | Bind migrated writes to Gate D result contract and shell persistence state. |
| Context-only actions | Right-click deletion/edit workflows remain | Visible overflow controls, keyboard and touch parity, same command path. |
| Archive history mutation | Existing edit/delete surfaces predate amendment doctrine | Immutable parent archives and explicit amendment workflow. |
| Restricted-data leakage | Squadron currently relies partly on rendering/hiding | Server reduced projection and payload tests. |

## 33. High-value code to preserve

Preserve behavior and tests—not necessarily the current file shape—for:

- record display/input order and identity matching;
- Female full-card indicator;
- Band and Space Force mutual exclusion;
- full-width Band/Space Force board banners;
- compact Processing attribute chips;
- authoritative dorm timers and 40/50/60 policy;
- create-verify-clear archive closeout safety;
- Space Force/female/NAT count preservation;
- receiving windows;
- loaded-versus-arrived reconciliation;
- role boundaries;
- no-PII safeguards;
- current report output requirements;
- fullscreen command-display use;
- Build 1 rollback.

---

# PART IX — IMMEDIATE EXECUTION BACKLOG

## 34. Work Package A — Merge and govern this index

- Review this index against `ACTIVE_RUNTIME_STACK.md` and the GATE 3.0 specification.
- Assign a named owner and review cadence.
- Treat the JSON companion as the automation source for future dashboards/checks.
- Update this index whenever active middleware, route status, or retirement requirements change.

## 35. Work Package B — Audit Remediation Gate 2

1. Inventory every active observer, interval, wrapper, and global.
2. Prove whether each is active, redundant, or required.
3. Remove one low-risk owner at a time.
4. Run runtime, foundation, and route-isolation tests after every removal.
5. Update `ACTIVE_RUNTIME_BUDGET.json` and `ACTIVE_RUNTIME_STACK.md` in the same change.
6. Do not activate any visible Build 2 route during Gate 2.

## 36. Work Package C — GDL 3.0 source decision

- Approve final Night Command and Day Command semantic values.
- Decide display/body/data font families and loading strategy.
- Add glass/elevation/attribute/command-display tokens.
- Version the token registry to `3.0.0`.
- Update workshop and automated token parity tests.
- Define migration aliases so staged components remain coherent during transition.

## 37. Work Package D — Component expansion

- Add all missing GATE 3.0 primitives and states.
- Finalize `GateDormCard` variants.
- Add timer, progress, sync, conflict, empty, and error components.
- Implement visible menu/action parity.
- Validate both themes, all densities, all container bands, and hostile/long content.

## 38. Work Package E — Status Board evidence and activation planning

- Complete sustained live shadow evidence.
- Resolve Latest Confirmed Arrival versus Final Airport Arrival comparisons.
- Capture all postures, including TV and ultra-wide.
- Complete accessibility, stale/offline, and rollback evidence.
- Design a default-off, server-controlled route activation mechanism.
- Prepare a net-negative activation manifest that meets the retirement targets.

---

# PART X — MAINTENANCE CONTRACT

## 39. Update triggers

Update this index whenever any of the following changes:

- active middleware CSS or JS;
- route visibility or authorization;
- canonical calculation owner;
- repository/workflow contract;
- GDL or component major version;
- responsive posture thresholds;
- accessibility contract;
- Status Board evidence/activation state;
- retirement manifest;
- approved migration order;
- deployment/rollback posture.

## 40. Completion condition

The repository is aligned to the GATE 3.0 plan when:

- all six routes use one shell, one token system, one component system, and one operational-truth plane;
- every route has exactly one visible owner;
- critical writes use typed repositories and verified workflows;
- TV, ultra-wide, laptop, iPad, and phone are adaptive compositions of one application;
- Night Command and Day Command expose identical semantic meaning;
- no required workflow was lost;
- no action depends only on hover, right-click, color, or animation;
- legacy route owners and corrective layers are retired;
- middleware no longer manufactures route markup or rewrites application functions;
- active runtime is smaller and more maintainable than the Build 1 baseline;
- source, tests, documentation, and deployed behavior agree.
