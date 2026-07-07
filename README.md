# GATE — Gateway Arrival Tracking Environment

Gateway Arrival Tracking Environment is an unclassified operational throughput tool for Pfingston Reception Center receiving operations. It tracks reception status counts, airport and local arrivals, dormitory processing status, assigned Airmen, dorm timers, Squadron Board display data, and archive closeout records.

The system is intended to support the receiving workflow from airport arrivals through PRC processing, dormitory load management, command-center display, and archived week-group review.

## Data Rules

- No PII
- No trainee names
- No orders data
- No trainee records
- Status counts only
- Shared access accounts only for beta testing

## Access Roles

### Instructor Access

Instructor access controls the structure and authority of the operation.

Instructor functions include:

- Initialize week group from Input
- Configure explicit Receiving Day One and Day Two date/time windows
- Monitor SAT arrivals on Airport
- Update last airport arrival time
- Dispatch airport buses
- Edit airport and local bus counts
- Track Female, Naturalization, and Space Force arrival counts
- Acknowledge bus arrivals
- Add local buses and local arrivals
- Open and close dorms
- Reopen closed dorms when correction is required
- Update dorm load, phase, and assigned Airman
- Maintain Band, Space Force, and Female dorm indicators
- Right-click edit dorm records
- Add dorm notes
- Delete dormitories
- Close out week group
- Access Archives
- Search, edit, print/PDF, and delete archive records with the override password

### Airman Access

Airman access supports live processing execution without exposing instructor-only controls.

Airman functions include:

- View Status Board
- View Squadron Board when available
- Acknowledge bus arrivals
- Open Processing
- Add local buses and local arrivals
- Add or subtract dorm load numbers
- Update processing phases
- Add or update assigned Airman
- Enable sound
- Use fullscreen Status Board

Airman access does not initialize week groups, dispatch airport buses, open or close dorms, right-click edit dorm records, close out week groups, or access Archives.

## Operational Workflow

### 1. Airport

Airport supports inbound arrival tracking.

Primary workflow:

- Set or update the last airport arrival time
- Generate airport buses
- Track buses en route
- Record OTW, Female, Naturalization, and Space Force counts
- Edit airport/local bus records when corrections are required
- Feed arrival totals into the Status Board, Archives, and print/PDF reports

### 2. Input

Input initializes the operational structure for a week group.

Primary workflow:

- Enter the week group ID
- Build dorm rows with SDQ, section, inter-section, dorm, sex, Band, Space Force, and load values
- Configure optional Receiving Day One and Receiving Day Two start/end windows
- Validate that any configured receiving window has both start and end values
- Preserve Band and Space Force as mutually exclusive dorm indicators
- Save receiving window values into dorm and archive records for report continuity
- Initialize the week group
- Establish expected counts used by the Status Board, Squadron Board, Archives, and reports

### 3. Processing

Processing is the active dormitory management workspace.

Primary workflow:

- Open dorm processing controls
- Update dorm phase/status
- Add or subtract dorm load values
- Save assigned Airman and auditorium/location information
- Manage Female, Band, and Space Force indicators
- Use instructor right-click/context actions for record correction
- Add local arrivals
- Close out the week group when operations are complete

### 4. Status Board

Status Board is the live command-center display.

Primary workflow:

- Display arrived, expected, last-arrival, local, and active-bus information
- Display Empty, Open, and Closed dorm columns
- Show dorm name, SDQ/section/inter-section, status, timer, load, progress, and operational indicators
- Preserve visible Female, Band, and Space Force indicators
- Support fullscreen display on lobby/operations monitors

### 5. Squadron Board

Squadron Board is the limited-view command/auditorium display.

Primary workflow:

- Display Status Board-style dorm status with a reduced information set
- Preserve Empty, Open, and Closed operational awareness
- Preserve Female, Band, and Space Force indicators
- Hide Airman and auditorium/location details by design
- Support display environments where a limited operational view is required

### 6. Archives

Archives is the records-management and review module.

Primary workflow:

- Review closed week groups
- Search/filter by week group
- Expand/collapse records by year and month
- Review rollups for dorms, buses, arrived, Female, Naturalization, and Space Force totals
- Open archive records through the archive edit modal
- Print/PDF archived receiving reports
- Print/PDF the current live receiving summary before closeout

## Pages

- Status Board
- Airport
- Input
- Processing
- Archives
- Squadron Board

## Current UI Architecture

The application uses a controlled active UI stack injected through Cloudflare Functions middleware.

Active stylesheet entrypoints:

1. `/css/gate-index-legacy-shell.css`
2. `/css/gate-base-tokens.css`
3. `/css/gate-layout-pages.css`
4. `/css/gate-components.css`
5. `/css/gate-utilities-access.css`

Final active UI chain loaded through `gate-utilities-access.css`:

1. `/css/gate-board-presentation.css`
2. `/css/gate-theme-unified-contract.css`
3. `/css/gate-clean-ui-pass.css`

Current UI ownership rules:

- Security banner and locked header/nav shell are owned by `gate-clean-ui-pass.css`
- Status Board and Squadron Board dorm-card geometry is owned by `gate-clean-ui-pass.css`
- Presentation breakpoints/readability are owned by `gate-board-presentation.css`
- Light/dark theme tokens are owned by `gate-theme-unified-contract.css`
- Processing chip support is owned by `prc-dash-dorm-cards.css`
- Modal and mobile-safe modal layout is owned by `prc-dash-modal-systems.css`
- Archive management styling is owned by `gate-archive-management.css`

Do not add additional board-card patch styles outside the active ownership files. Band and Space Force board banners must use the Dorm Card contract and must not be implemented as absolute overlay patches.

## Runtime Controllers

The current stabilization effort moves the app away from repeated patch-after-render behavior and toward stable component contracts and explicit controllers.

Current controller areas:

- `GateHooks` — lifecycle hook layer
- `GateBrandingController` — user-visible GATE terminology and document identity
- `GateActiveBusController` — active bus cards on Status Board
- `GateBusWorkflowController` — airport dispatch, local arrivals, combined bus log, and shared bus edit modal
- `GateInputPageController` — Input page receiving windows, batch Space Force support, archive window fields, and initialization preflight validation
- `GateArchiveSchemaController` — archive schema and closeout safety
- `GateArchivePrintController` — archive print/PDF and current-summary print/PDF button ownership
- `GateDormBoardController` — Status Board and Squadron Board dorm rendering
- `GateTimerSoundController` — timer display, sound event processing, and overtime eligibility
- `GateRuntimeStabilityController` — sound unlock, capped dorm load controls, Escape-to-close, and batch tab flow

## Component Contracts

Current contract areas:

- Dorm Card component
- Active Bus Card component
- Status Metric component
- Archive Record component
- Header/Nav shell
- Processing Dorm Modal tagging

Dorm Card operational indicator rules:

- Female alert rings the whole dorm card, not the load number
- Band and Space Force indicators render as full-width card header banners on Status Board and Squadron Board
- Band and Space Force indicators render as compact chips on Processing cards
- Space Force and Band are mutually exclusive
- Squadron Board uses the same card structure as Status Board, with limited-view data hiding

## Validation Artifacts

Current validation and continuity documents:

- `docs/ui-stack-audit.md`
- `docs/ui-page-validation-pass.md`

`ui-stack-audit.md` freezes the active UI stack and ownership boundaries.

`ui-page-validation-pass.md` records the current page-by-page static validation pass for:

- Status Board
- Squadron Board
- Processing
- Airport
- Input
- Archives
- Relevant modals
- Print/PDF flow
- Light/dark structural consistency
