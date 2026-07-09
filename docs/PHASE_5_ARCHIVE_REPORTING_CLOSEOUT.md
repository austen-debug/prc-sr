# Phase 5 — Archive / Reporting / Closeout Ownership

Status: Implemented baseline
Scope: Closeout archive creation, archive verification before clearing live records, archive management rendering, archive edit modal, archive print/PDF, current summary print, and archive data integrity.

## Objective

Phase 5 consolidates archive and reporting behavior so one active controller owns the archive lifecycle from closeout through later archive review and printing.

Before this phase, archive behavior was fragmented across the base app and several patch files.

## What this phase does not change

Phase 5 does not change:

- backend records API
- archive record schema compatibility
- Status Board rendering
- Processing workflow
- Airport/local bus workflow
- Input initialization
- mobile shell/dropdown polish
- mobile watermark polish

## Active implementation

### Canonical owner

Added:

```txt
public/js/gate-archive-controller.js
```

This controller now owns:

- closeout confirmation handoff
- archive payload construction
- archive creation
- archive verification before live records are cleared
- live dorm/bus/sound-event deletion after archive verification
- active Week Group / last Airport config clearing
- Input grid reset after closeout
- archive history rendering
- archive search/filter
- archive edit modal open/close
- archive edit save
- archive print/PDF output
- current summary print output
- receiving-window metadata preservation
- Space Force dorm/bus metadata preservation

The controller exposes:

```js
window.GateArchiveController = {
  isCanonicalOwner: true,
  buildArchivePayload,
  runSafeCloseout,
  initiateCloseout,
  renderArchives,
  openArchiveEditModal,
  closeArchiveEditModal,
  printArchiveReport,
  printCurrentSummaryReport,
  refresh
}
```

## Files removed from active runtime

These files remain in the repository for traceability but are no longer loaded by middleware:

- `public/js/prc-dash-archive-actions.js`
- `public/js/prc-dash-archive-print-cleanup.js`
- `public/js/prc-dash-current-summary-live-records.js`
- `public/js/gate-archive-print-controller.js`

Their active behavior is now incorporated into `gate-archive-controller.js`.

## Runtime change

Middleware now loads:

```html
<script src="/js/gate-archive-controller.js?v=phase-5-archive-20260709" defer></script>
```

The controller loads after the Input controller so it can use `GateInputPageController.collectReceivingWindows()` when available.

## Closeout behavior

`runSafeCloseout()` now owns the operational closeout path.

Behavior:

1. Verifies instructor role.
2. Gets the active Week Group.
3. Collects live dorm, bus, and sound-event records for that Week Group.
4. Builds a canonical archive payload.
5. Creates the archive record.
6. Fetches records directly from `/api/records` to verify archive creation.
7. Deletes live dorm/bus/sound-event records only after verification.
8. Clears `last_airport` and `week_group` config records.
9. Resets the Input grid.
10. Runs closeout/data hooks.
11. Refreshes archive management and dependent UI surfaces.

The closeout button is patched repeatedly during startup so the legacy closeout handler and earlier archive schema controller cannot retake ownership during load races.

## Archive payload integrity

Archive payloads now include:

```txt
archive_schema_version: gate-archive-schema-v3-canonical
closeout_safety_version: archive-verified-before-clear-v3
receiving_day_one_start
receiving_day_one_end
receiving_day_two_start
receiving_day_two_end
space_force_total
arrived_space_force_total
dorm_data
bus_data
```

Dorm history preserves:

- dorm name
- SDQ / section / inter-sec
- sex
- Band flag
- Space Force flag
- auditorium location
- current/max load
- state/phase
- notes
- assigned Airman field
- opened/closed timestamps
- closed timer

Bus history preserves:

- bus ID
- bus type
- local origin/destination
- departed/created/arrived timestamps
- OTW count
- female count
- NAT count
- Space Force count
- status

## Archive management behavior

The Archives page now renders through the canonical Archive controller.

Features:

- archive card list
- search by Week Group
- summary counts
- Space Force totals
- click/tap archive card to open editor
- instructor-only archive editor access

## Archive edit behavior

The controller owns archive edit modal open/close and form submit.

It validates the dorm and bus JSON fields before saving. It also preserves receiving-window fields and recalculates Space Force totals from bus data on save.

## Print behavior

The controller owns two report paths:

- `printArchiveSpreadsheet()` / archive print/PDF
- `printCurrentSummaryReport()` / current live summary

Both reports use the same command-summary print shell with:

- UNCLASSIFIED / NO PII classification banner
- Week Group metadata
- received/loaded/expected/female/NAT/Space Force metrics
- Receiving Night One / Two summary text when windows exist
- dorm detail snapshot
- bus detail snapshot

## Legacy global handoffs

The controller patches these globals:

```js
window.initiateCloseout = initiateCloseoutCanonical;
window.renderArchives = renderArchiveManagementView;
window.openArchiveEditModal = openArchiveEditModalCanonical;
window.closeArchiveEditModal = closeArchiveEditModalCanonical;
window.printArchiveSpreadsheet = printArchiveReport;
window.printCurrentSummaryReport = printCurrentSummaryReport;
```

## Acceptance criteria

Must pass before proceeding to UI/mobile polish or final hardening:

1. Closeout button still prompts for confirmation.
2. Closeout creates an archive before clearing live records.
3. Live records are not cleared if archive creation or verification fails.
4. Archive record contains dorm data, bus data, receiving windows, and Space Force fields.
5. Live dorm/bus records clear after successful archive verification.
6. Week Group and last Airport config values clear after closeout.
7. Input grid resets after closeout.
8. Archive card appears in the Archives page.
9. Archive search filters by Week Group.
10. Clicking an archive opens the archive edit modal.
11. Archive edit saves valid changes and rejects invalid JSON.
12. Archive print/PDF opens a report window.
13. Current Summary print opens a report window for the active Week Group.
14. Space Force totals appear in archive management and reports.

## Known remaining risks

- `gate-ui-hooks.js` still contains the older archive schema controller, but Phase 5 now patches closeout later and repeatedly during startup to retain active ownership.
- `public/index.html` still contains legacy archive functions, but Phase 5 patches globals and intercepts archive form submission in capture phase.
- Print output is intentionally command-summary oriented. A future reporting phase can add richer CSV/XLSX export if required.

## Next recommended phase

Proceed to Final Runtime Hardening and UI Stabilization, then Mobile/UI Polish.

Recommended next work:

1. Remove inactive legacy files from middleware documentation permanently or move them to `docs/legacy-runtime` notes.
2. Audit `gate-ui-hooks.js` and remove old active bus/archive internal controllers now superseded by canonical owners.
3. Fix mobile dropdown menu corruption.
4. Fix mobile watermark scaling/position.
5. Run a full workflow validation matrix across Instructor, Airman, and Squadron roles.
