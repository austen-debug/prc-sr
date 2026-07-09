# GATE Enterprise Index

Status: Phase Zero baseline
Scope: Documentation only. No runtime behavior changes.

## Executive summary

GATE — Gateway Arrival Tracking Environment — is an operational receiving workflow application for Basic Military Training arrival processing. Its end state is a professional, role-aware, non-PII, persistent web application that supports airport arrivals, PRC receiving, dorm processing, status board visibility, squadron visibility, reporting, and archive continuity.

The current app proves the operational concept, but it is no longer healthy to continue patching individual UI issues without consolidation. The app currently works through a monolithic base file plus many middleware-injected controllers. Several active files control the same UI surfaces, resulting in duplicate rendering, mobile/desktop conflict, navigation instability, and recurring regressions.

Phase Zero establishes the baseline before code refactor begins.

## Product mission

GATE must support this operational chain:

```txt
Airport arrival counts
→ airport/local bus movement
→ PRC processing visibility
→ dorm open/load/phase/close tracking
→ live Status Board
→ limited Squadron Board visibility
→ current summary / print report
→ safe archive closeout
→ persistent historical archive
```

The system must remain non-PII and should never become a trainee identity repository.

## Operating rules

Future work must follow these rules:

1. Workflow first, aesthetics second.
2. One owner per function, page, modal, and UI surface.
3. Backend records are the persistent source of truth.
4. UI renders from records; UI is not the record authority.
5. No broad patch stacking as the default approach.
6. Do not remove legacy code until it is classified.
7. Preserve role boundaries.
8. Desktop, tablet, and phone are separate UX contracts.
9. Every change must have acceptance criteria.
10. No new PII.

## Current runtime model

The app is currently defined by:

1. `public/index.html`
   - Monolithic base application.
   - Contains original pages, styles, global state, workflow handlers, render loop, and modals.

2. `functions/_middleware.js`
   - Injects active CSS and JS runtime assets into served HTML.
   - This is the live runtime manifest.

3. `functions/api/records.js`
   - Persistent record API.
   - Stores generic record JSON.
   - Contains critical dorm-state preservation logic.

4. Active UI/UX controllers in `public/js`.

5. Active CSS layers in `public/css`.

## Primary architectural issue

The core issue is duplicate ownership.

Examples:

- Navigation is controlled by base `index.html`, Dorm Board controller, Access Control controller, mobile nav fix, mobile shell redesign, mobile finalizer, and desktop restore guard.
- Metrics are controlled by base `index.html`, old board-header compatibility, premium metrics controller, and premium metrics CSS.
- Processing modal behavior is controlled by base `index.html`, context menu controller, final-time commit controller, Airman close safety, tablet fix, and mobile modal validation.
- Airport workflow is controlled by base `index.html`, bus workflow controller, airport phone fix, and mobile validation.

The application needs consolidation, not more surface patches.

## Active documentation set

Phase Zero created the following source-of-truth documents:

1. `docs/ACTIVE_RUNTIME_STACK.md`
   - Active injected CSS/JS stack.
   - Runtime ownership and high-risk overlap areas.

2. `docs/UI_OWNERSHIP_MAP.md`
   - Current owners and target owners for each UI surface.

3. `docs/RECORD_CONTRACT.md`
   - Current and target record contracts.
   - Persistence and privacy rules.

4. `docs/CONFLICT_REMOVAL_PLAN.md`
   - Conflict severity map and recommended removal order.

5. `docs/MOBILE_SHELL_DECISION.md`
   - Mobile/tablet/desktop shell contract and migration decision.

## Current workflow map

### Airport workflow

Current behavior:

- Instructor enters airport bus counts.
- Airport bus record is created.
- Active bus appears on Status Board.
- Bus is confirmed arrived.
- Arrived totals update.
- Archive stores bus data.

Current risks:

- Base form handlers and `gate-bus-workflow-controller.js` overlap.
- Mobile Airport form is hard-patched.

Target owner:

- `AirportPage` and `AirportWorkflow`.

### Local arrival workflow

Current behavior:

- Airman/instructor can add local arrival from Processing path.
- Local bus/arrival creates arrived record.
- Arrived totals update.

Current risks:

- Workflow is coupled to bus controller and modal patches.

Target owner:

- `LocalArrivalModal` under `ProcessingPage` or shared `BusWorkflow`.

### Input / week group initialization workflow

Current behavior:

- Instructor initializes active week group and dorm records.
- Batch grid creates dorm payloads.
- Receiving windows and Space Force data are patched/preserved by controller.

Current risks:

- Base batch grid still lives in monolithic file.
- Input controller patches several global functions.

Target owner:

- `InputPage`, `WeekGroupInitializer`, `BatchDormGrid`, `ReceivingWindowPanel`.

### Processing workflow

Current behavior:

- Dorm cards are rendered for active week group.
- Instructor/Airman opens dorm modal.
- Load, phase, assigned Airman, open/close state are updated.
- Instructor right-click actions are patched in.
- Final time correction is handled by separate controller.

Current risks:

- Multiple modal owners.
- Multiple final-time paths.
- Airman/instructor role paths are patched rather than built into the workflow.

Target owner:

- `ProcessingPage`, `ProcessingDormModal`, `InstructorContextMenu`, `DormEditModal`.

### Status Board workflow

Current behavior:

- Metrics show arrived, expected, last arrival, local time.
- Active buses display en route buses.
- Dorm columns show empty/open/closed state.
- Timers and visual indicators update.

Current risks:

- Metrics have recent duplication history.
- Dorm card rendering is patched.
- Timer/sound/metric/card lifecycle is broad.

Target owner:

- `StatusBoardPage`, `StatusMetrics`, `ActiveBusPanel`, `DormColumnBoard`.

### Squadron Board workflow

Current behavior:

- Squadron page is generated dynamically.
- It displays limited metrics and dorm columns.
- Instructor-only details are hidden.

Current risks:

- Page is dynamic and relies on nav/access/mobile layers.
- Mobile page bleed has occurred.

Target owner:

- `SquadronBoardPage` registered through canonical router.

### Archive workflow

Current behavior:

- Closeout creates archive payload.
- Archive schema is verified before live records are cleared.
- Archive stores bus and dorm snapshots.
- Archive print/current summary behavior is split across controllers.

Current strengths:

- Closeout verification and schema preservation are strong and should be preserved.

Target owner:

- `ArchiveService`, `ArchivePage`, `ArchivePrintService`, `CurrentSummaryReport`.

## Recommended refactor sequence

### Phase 1A — Navigation / App Shell / Mobile Shell

Reason:

- Highest regression rate.
- Affects every page.
- Must be stabilized before page-level refactors.

Deliverables:

- `AppShellRouter`
- `Permissions`
- `NavMenu`
- `ResponsiveShell`
- Removal plan for mobile/desktop compatibility patches.

### Phase 1B — Status Board metrics and board header

Reason:

- Recent duplicate rendering demonstrates conflict.
- Metrics are visible and central.

Deliverables:

- Source-owned metrics container.
- Remove old metric IDs from base render loop.
- Retire board-header compatibility.

### Phase 1C — Status Board dorm cards and active buses

Reason:

- Board is the primary command view.

Deliverables:

- One dorm card component.
- One dorm column renderer.
- One active bus panel.

### Phase 2 — Processing page and modal

Reason:

- Processing is operationally critical and currently fragmented.

Deliverables:

- One Processing page.
- One modal contract.
- Integrated Airman/instructor behavior.
- Integrated final-time correction.

### Phase 3 — Airport and local arrivals

Reason:

- Airport/local arrivals drive totals and live receiving visibility.

Deliverables:

- One airport form submit path.
- One local arrival path.
- One bus log renderer.

### Phase 4 — Input / Week Group

Reason:

- Initialization creates the operational record set.

Deliverables:

- Source-owned batch grid.
- Source-owned receiving windows.
- Formal validation.

### Phase 5 — Archives and reporting

Reason:

- Archive safety must be preserved while print/reporting is consolidated.

Deliverables:

- Archive service.
- Report service.
- Current summary module.

### Phase 6 — CSS design system consolidation

Reason:

- UI polish should sit on stable components.

Deliverables:

- Tokenized spacing, radius, typography, cards, buttons, modals.
- Remove inline legacy shell CSS.
- Remove inactive PRC-era CSS where safe.

## Enterprise target structure

Recommended future structure:

```txt
/src
  /app
    bootstrap.js
    router.js
    store.js
    records-client.js
    permissions.js
    render-scheduler.js

  /domain
    dorm-records.js
    bus-records.js
    archive-records.js
    receiving-windows.js
    timers.js
    sounds.js

  /pages
    status-board.page.js
    airport.page.js
    input.page.js
    processing.page.js
    archives.page.js
    squadron-board.page.js

  /components
    app-shell.js
    nav-menu.js
    metric-card.js
    dorm-card.js
    bus-card.js
    modal.js
    form-field.js
    toast.js

  /styles
    tokens.css
    base.css
    shell.css
    pages.css
    components.css
    mobile.css
    tablet.css
    print.css
```

## Definition of done for Phase Zero

Phase Zero is complete when:

- Active runtime stack is documented.
- UI ownership map is documented.
- Record contract is documented.
- Conflict removal plan is documented.
- Mobile shell decision is documented.
- No runtime behavior was changed.

## Phase Zero conclusion

GATE should now move from patch-driven development to consolidation-driven development. The immediate next phase should be Navigation / App Shell / Mobile Shell consolidation because it is the highest-risk cross-cutting layer and the source of the most visible regressions.
