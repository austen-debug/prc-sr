# PRC DASH

Pfingston Reception Center Dashboard.

PRC DASH is an unclassified operational throughput dashboard for Pfingston Reception Center Shipping and Receiving operations. It tracks reception status counts, airport and local arrivals, dormitory processing status, assigned Airmen, dorm timers, and archive closeout data.

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
- Monitor SAT arrivals on Airport
- Update last airport arrival time
- Dispatch airport buses
- Edit airport bus counts
- Acknowledge bus arrivals
- Add local buses and local arrivals
- Open and close dorms
- Update dorm load, phase, and assigned Airman
- Right-click edit dorm records
- Add dorm notes
- Delete dormitories
- Close out week group
- Access Archives
- Edit, print, and delete archive records with the override password

### Airman Access

Airman access supports live processing execution.

Airman functions include:

- View Status Board
- Acknowledge bus arrivals
- Open Processing
- Add local buses and local arrivals
- Add or subtract dorm load numbers
- Update processing phases
- Add or update assigned Airman
- Enable sound
- Use fullscreen Status Board

Airman access does not initialize week groups, dispatch airport buses, open or close dorms, right-click edit dorm records, close out week groups, or access Archives.

## Pages

- Status Board
- Airport
- Input
- Processing
- Archives

## Alpha Run Display Setup

Recommended operational display setup:

- Lobby TV monitors: Status Board live
- Hold over room: Status Board live
- Front break room: Status Board live
- Bus / Intake Instructor: instructor access on phone, work iPad, or laptop
- Admin Instructor: instructor access open on auditorium screen
- Hold over Airmen: plugged-in instructor iPad at the desk using Airman access

For iPad use, the Kiosk app may be used to lock the iPad to the single PRC DASH webpage for Airman use.

## Current Alpha Build Notes

- Cloudflare Pages static app with Functions middleware
- Cloudflare D1-backed records API
- Shared login sessions with instructor and Airman roles
- Live refresh across devices through `/api/records`
- SAT arrivals panel filters to a rolling next-24-hours window
- Status Board uses a four-card header: Arrived, Last, Expected, Local
- Archive closeout verifies archive creation before clearing live records
- Sound alerts support dorm open, dorm close, airport bus dispatch, and overtime
- iPad sound requires users to press Enable Sound on that device

## Operational Reminder

PRC DASH is for unclassified operational status counts only. Do not enter PII, trainee names, orders information, or trainee records.
