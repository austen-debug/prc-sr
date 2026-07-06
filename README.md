# PRC DASH / GATE

Pfingston Reception Center Dashboard and Gateway Arrival Tracking Environment.

PRC DASH / GATE is an unclassified operational throughput dashboard for Pfingston Reception Center Shipping and Receiving operations. It tracks reception status counts, airport and local arrivals, dormitory processing status, assigned Airmen, dorm timers, Squadron Board display data, and archive closeout records.

The system is intended to support the receiving workflow from airport arrivals through PRC processing, dormitory load management, command-center display, and archived week-group review.

## Data Rules

- No PII
- No trainee names
- No orders data
- No trainee records
- Status counts only
- Shared access accounts only for alpha testing

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
- Configure explicit Receiving Day One and Receiving Day Two start/end windows
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
- Review rollups for dorms, buses, arrived, Female, and Naturalization totals
- Open archive records through the archive edit modal
- Print/PDF archived receiving reports

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

1. `/css/gate-base-tokens.css`
2. `/css/gate-layout-pages.css`
3. `/css/gate-components.css`
4. `/css/gate-utilities-access.css`

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

## Component Contracts

The current UI recovery effort is moving the app away from patch-after-render behavior and toward stable component contracts.

Current contract areas:

- Dorm Card component
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
- Mobile/tablet/desktop risk areas

Static repository validation has been completed, but live browser/device QA is still required for final confirmation of viewport behavior, touch behavior, and print/PDF output.

## Alpha Run Display Setup

Recommended operational display setup:

- Lobby TV monitors: Status Board live
- Hold over room: Status Board live
- Front break room: Status Board live
- Auditorium or limited-view display: Squadron Board live
- Bus / Intake Instructor: instructor access on phone, work iPad, or laptop
- Admin Instructor: instructor access open on auditorium screen or laptop
- Hold over Airmen: plugged-in instructor iPad at the desk using Airman access

For iPad use, the Kiosk app may be used to lock the iPad to the single PRC DASH / GATE webpage for Airman use.

## Current Alpha Build Notes

- Cloudflare Pages static app with Functions middleware
- Cloudflare D1-backed records API
- Shared login sessions with instructor and Airman roles
- Live refresh across devices through `/api/records`
- SAT arrivals panel filters to a rolling next-24-hours window
- Status Board uses live operational status metrics and Empty/Open/Closed dorm columns
- Squadron Board provides a limited-view operational display
- Explicit Receiving Day One and Day Two date/time windows support reporting and archive rollups
- Airport and local bus records support editable OTW, Female, Naturalization, and Space Force counts
- Archive closeout verifies archive creation before clearing live records
- Archive management supports search/filter, year/month groups, record cards, edit modal, and print/PDF flow
- Sound alerts support dorm open, dorm close, airport bus dispatch, and overtime
- iPad sound requires users to press Enable Sound on that device

## Operational Reminder

PRC DASH / GATE is for unclassified operational status counts only. Do not enter PII, trainee names, orders information, or trainee records.
