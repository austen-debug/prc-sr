# GATE Build 2 — Metric Provenance Registry

Status: Phase 1A baseline
Purpose: Define the operational meaning, source records, eligibility rules, current owners, consumers, known risks, and Build 2 calculation contracts for every material GATE value.

## Registry conventions

### Status values

- **Aligned** — current calculation substantially matches the Build 2 operational definition.
- **Divergent** — current consumers use inconsistent eligibility or formulas.
- **Decision required** — the current value exists, but its operational definition or ownership is not sufficiently explicit.
- **Presentation only** — not persisted operational truth.

### Common eligibility rules

Unless a metric states otherwise:

- records must match the requested Week Group;
- numeric values are normalized to finite non-negative numbers;
- confirmed-arrival metrics require normalized `status === 'arrived'`;
- receiving-night metrics require a valid confirmed-arrival timestamp within a configured half-open window;
- Space Force counts are constrained to the associated total count;
- UI elements are consumers, never data sources.

---

# 1. Operational context

## Active Week Group

- **Operational definition:** Week Group currently selected for live receiving operations.
- **Source:** `config` record with active Week Group key; current code contains legacy naming variants.
- **Current owners/consumers:** application filtering, Status Board, Airport, Input, Processing, Archive, Squadron Board.
- **Current status:** Decision required.
- **Known risk:** historical documentation refers to `active_wg`, while active initialization writes `config.key === 'week_group'`.
- **Build 2 owner:** `GateDomain.weekGroups.selectActiveWeekGroup()` plus `GateConfigRepository`.
- **Build 2 rule:** configuration aliases are normalized at the repository boundary; feature modules consume one canonical value.

## Local time

- **Operational definition:** Current local operational time formatted for display.
- **Source:** system clock through current `getLocalTime24()` compatibility function.
- **Current consumers:** Status Board and Squadron Board.
- **Current status:** Presentation only.
- **Build 2 owner:** application clock service, not operational record storage.
- **Validation:** format, timezone, minute rollover, suspended-tab recovery.

## Last arrival

- **Operational definition:** Most recent confirmed PRC arrival time for the active Week Group.
- **Current source:** `config` record with `key: last_airport`.
- **Current consumer:** Status Board metric.
- **Current status:** Decision required.
- **Known risk:** config value is presentation-oriented and its write provenance is not explicit in the current canonical bus controller.
- **Build 2 owner:** `GateDomain.arrivals.selectLastConfirmedArrival()` derived from eligible bus records.
- **Build 2 rule:** a derived arrival timestamp is preferred over a manually maintained display config. Legacy config remains read-compatible until retired.

---

# 2. Arrival and bus metrics

## Confirmed arrived trainees

- **Operational definition:** Sum of total trainee counts on confirmed-arrived bus records for the active Week Group.
- **Source records:** `bus`.
- **Eligibility:** normalized `status === 'arrived'`; Build 2 requires a valid arrival timestamp or an explicit tested legacy-compatibility rule.
- **Formula:** `sum(bus.otw_count)`.
- **Current owners:** Status Board metrics, Processing loaded summary, Squadron Board, Archive payload.
- **Current status:** Aligned in those consumers.
- **Build 2 owner:** `GateDomain.arrivals.calculateConfirmedArrivalTotals()`.
- **Consumers:** Status Board, Processing summary, Squadron Board, Current Summary, Archive Report, archive snapshot.
- **Fixture:** `B2-P1-F001`, `B2-P1-F002`, `B2-P1-F003`.

## Active/en-route buses

- **Operational definition:** Airport bus records that are dispatched but not confirmed arrived.
- **Source records:** `bus`.
- **Eligibility:** normalized status `active` or `otw`; exclude confirmed arrivals.
- **Current owner:** `GateStatusBoardController.getActiveBuses()`.
- **Current status:** Aligned.
- **Build 2 owner:** `GateDomain.buses.selectActiveBuses()`.
- **Consumers:** Status Board active-bus lane and operational alerts.

## Bus-log total

- **Operational definition:** Total counts represented by all bus records currently listed in the Airport bus log, regardless of arrived/en-route status.
- **Source records:** active Week Group `bus` records.
- **Current owner:** `GateBusWorkflowController.renderBusLog()`.
- **Current status:** Aligned if labeled as a log total, not an arrived total.
- **Known risk:** users may mistake the bus-log footer for confirmed arrivals.
- **Build 2 owner:** `GateDomain.buses.calculateManifestedBusLogTotals()`.
- **Build 2 rule:** UI label must explicitly distinguish manifested/logged totals from confirmed arrivals.

## Female confirmed arrivals

- **Operational definition:** Sum of female counts on the same confirmed-arrival bus set used for arrived totals.
- **Source records:** `bus`.
- **Formula:** `sum(bus.female_count)` over confirmed arrivals.
- **Current status:** Aligned in archive payload; Airport log intentionally includes all logged buses.
- **Build 2 owner:** `GateDomain.arrivals.calculateConfirmedArrivalTotals()`.
- **Rule:** female, NAT, and Space Force arrival totals may not use a broader bus set than the associated arrived total.

## Naturalization requests

- **Operational definition:** Sum of `nat_count` on eligible confirmed-arrival buses.
- **Source records:** `bus`.
- **Current status:** Divergent.
- **Current aligned path:** archive payload uses arrived buses.
- **Current divergent path:** receiving-night report uses timestamp-window buses without first requiring confirmed-arrival status.
- **Build 2 owner:** `GateDomain.receiving.calculateReceivingSummary()`.
- **Consumers:** Current Summary, Archive Report, archive totals, future leadership summary.
- **Fixture:** Night One 52, Night Two 4, cumulative 56.

## Space Force confirmed arrivals

- **Operational definition:** Sum of valid `space_force_count` on eligible confirmed-arrival buses.
- **Source records:** `bus`.
- **Formula per bus:** `min(max(space_force_count, 0), max(otw_count, 0))`.
- **Current status:** Divergent.
- **Current aligned path:** `arrived_space_force_total` uses arrived buses.
- **Current divergent path:** archive `space_force_total` sums all buses, and archive display prefers that broader value.
- **Build 2 owner:** `GateDomain.arrivals.calculateConfirmedArrivalTotals()`.
- **Build 2 rule:** “processed” or “arrived” Space Force values always use confirmed arrivals. A separate manifested Space Force value may exist only under an explicit label.

## Air Force confirmed arrivals

- **Operational definition:** Confirmed total arrivals excluding valid Space Force arrivals.
- **Formula:** `max(confirmed total - confirmed Space Force, 0)`.
- **Current status:** Partially implemented in report helpers, not consistently exposed.
- **Build 2 owner:** `GateDomain.arrivals.calculateConfirmedArrivalTotals()`.
- **Rule:** Air Force and Space Force are partitions of the same eligible bus set.

---

# 3. Projection and capacity metrics

## Projected trainees

- **Operational definition:** Planned trainee capacity represented by active Week Group dorm records.
- **Source records:** `dorm`.
- **Eligibility:** active Week Group.
- **Formula:** `sum(dorm.max_load)`.
- **Current owners:** Status Board metrics, Squadron Board, report summary, archive payload.
- **Current status:** Aligned.
- **Build 2 owner:** `GateDomain.dorms.calculateCapacityTotals()`.
- **Future note:** if an authoritative projection record is introduced, migration must be explicit; existing dorm-capacity behavior remains the compatibility definition.

## Projected Space Force trainees

- **Operational definition:** Planned capacity of dorms explicitly marked Space Force.
- **Source records:** `dorm`.
- **Eligibility:** active Week Group plus normalized Space Force flag.
- **Formula:** `sum(dorm.max_load)`.
- **Current owner:** receiving report.
- **Current status:** Aligned subject to flag normalization.
- **Build 2 owner:** `GateDomain.dorms.calculateCapacityTotals()`.

## Dorm capacity

- **Operational definition:** Maximum planned load for one dorm.
- **Source:** `dorm.max_load`.
- **Current owner:** Input creation and Processing display/edit.
- **Current status:** Aligned.
- **Build 2 owner:** normalized Dorm entity.

---

# 4. Processing and dorm metrics

## Dorm current load

- **Operational definition:** Number of arrived trainees assigned to one dorm through Processing.
- **Source:** `dorm.current_load`.
- **Eligibility:** active Week Group dorm.
- **Current owner:** `GateProcessingController` write path.
- **Current status:** Aligned, with runtime input constraint safeguard.
- **Build 2 owner:** `GateDormRepository.updateLoad()` command plus normalized Dorm entity.
- **Rule:** `0 <= current_load <= max_load` must be enforced in the domain command and persistence boundary, not only by the input element.

## Total loaded

- **Operational definition:** Sum of current dorm loads for the active Week Group.
- **Source records:** `dorm`.
- **Formula:** `sum(dorm.current_load)`.
- **Current owners:** passive Processing loaded summary and Archive payload/report.
- **Current status:** Aligned.
- **Build 2 owner:** `GateDomain.dorms.calculateLoadTotals()`.

## Awaiting dorm assignment

- **Operational definition:** Confirmed arrived trainees not yet represented in dorm current loads.
- **Formula:** `max(confirmed arrived - total loaded, 0)`.
- **Current owner:** `prc-dash-processing-loaded-summary.js`.
- **Current status:** Aligned calculation, legacy/passive ownership.
- **Build 2 owner:** `GateDomain.processing.calculateAssignmentSummary()`.
- **Migration note:** retire the passive compatibility wrapper when Processing consumes the Build 2 selector directly.

## Dorm state counts

- **Operational definition:** Number of active Week Group dorm records in `empty`, `open`, or `closed` state.
- **Source records:** `dorm`.
- **Current owners:** Status Board and Squadron Board column renderers.
- **Current status:** Aligned.
- **Build 2 owner:** `GateDomain.dorms.groupDormsByState()`.

## Processing phase

- **Operational definition:** Current operational processing phase for an open dorm.
- **Source:** `dorm.phase`.
- **Current owner:** `GateProcessingController`.
- **Current status:** Aligned.
- **Build 2 owner:** normalized Dorm entity plus controlled phase command.

## Open time

- **Operational definition:** Timestamp when the dorm most recently entered the open state.
- **Source:** `dorm.opened_at`.
- **Current status:** Aligned with backend preservation rules.
- **Build 2 owner:** `GateDormRepository.open()` / `reopen()` commands.

## Close time

- **Operational definition:** Timestamp of the first valid close unless an explicit auditable correction is authorized.
- **Source:** `dorm.closed_at`.
- **Current status:** Aligned with backend preservation rules.
- **Build 2 owner:** `GateDormRepository.close()` and persistence validation.

## Final processing time

- **Operational definition:** Final elapsed MM:SS duration from the applicable open timestamp to close.
- **Source:** `dorm.closed_timer`, protected by backend close rules.
- **Current status:** Aligned with explicit manual override support.
- **Build 2 owner:** `GateDomain.dorms.calculateElapsed()` plus repository close command and future audit event.

## Overtime state

- **Operational definition:** Open dorm elapsed duration at or above the operational overtime threshold.
- **Source:** `dorm.opened_at`, current clock, and sound-event state.
- **Current status:** Decision required for Build 2 ownership because visual timer and sound trigger remain distributed.
- **Build 2 owner:** `GateDomain.processing.calculateTimerState()`; notification command remains separate.

---

# 5. Receiving-night metrics

## Receiving Night One processed

- **Operational definition:** Sum of total counts on confirmed arrivals whose valid `arrived_at` falls within Night One.
- **Current status:** Divergent.
- **Current defect:** fallback `busTime()` may use departure, creation, or update time and does not require arrived status before window assignment.
- **Build 2 owner:** `GateDomain.receiving.calculateReceivingSummary()`.
- **Fixture:** 818.

## Receiving Night Two processed

- **Operational definition:** Sum of total counts on confirmed arrivals whose valid `arrived_at` falls within Night Two.
- **Current status:** Divergent for the same reason as Night One.
- **Build 2 owner:** `GateDomain.receiving.calculateReceivingSummary()`.
- **Fixture:** 39.

## Cumulative processed

- **Operational definition:** Ordered cumulative sum of eligible receiving-night processed totals.
- **Current status:** calculation structure aligned, eligibility set divergent.
- **Build 2 owner:** `GateDomain.receiving.calculateReceivingSummary()`.
- **Fixture:** 857 after Night Two.

## Receiving-night naturalization

- **Operational definition:** NAT totals from the exact confirmed-arrival set assigned to each receiving night.
- **Current status:** Divergent eligibility.
- **Build 2 owner:** `GateDomain.receiving.calculateReceivingSummary()`.
- **Fixture:** 52 / 4 / 56 cumulative.

## Receiving-night Space Force

- **Operational definition:** Space Force totals from the exact confirmed-arrival set assigned to each receiving night.
- **Current status:** Divergent eligibility.
- **Build 2 owner:** `GateDomain.receiving.calculateReceivingSummary()`.
- **Display rule:** omit the sentence when both projected and processed Space Force totals are zero.

---

# 6. Archive and reporting metrics

## Archive total arrived

- **Operational definition:** Confirmed arrived total at closeout.
- **Current owner:** `GateArchiveController.buildArchivePayload()`.
- **Current status:** Aligned.
- **Build 2 owner:** immutable result of `GateDomain.archives.buildSnapshot()`.

## Archive total expected

- **Operational definition:** Week Group projected total at closeout.
- **Current owner:** archive payload from dorm max loads.
- **Current status:** Aligned.
- **Build 2 owner:** immutable snapshot from canonical capacity selector.

## Archive female total

- **Operational definition:** Female counts on confirmed arrivals at closeout.
- **Current status:** Aligned.
- **Build 2 owner:** immutable snapshot from canonical confirmed-arrival selector.

## Archive NAT total

- **Operational definition:** NAT counts on confirmed arrivals at closeout.
- **Current status:** Aligned in archive payload.
- **Build 2 owner:** immutable snapshot from canonical confirmed-arrival selector.

## Archive Space Force total

- **Operational definition:** Confirmed-arrived Space Force total at closeout.
- **Current status:** Divergent due to dual fields and display precedence.
- **Build 2 owner:** one canonical snapshot field, with legacy aliases retained only in the normalizer.

## Current Summary and Archive Report

- **Operational definition:** Different document contexts consuming the same operational calculations.
- **Current status:** Divergent because the report implements calculation logic locally.
- **Build 2 owner:** `GateDomain.reports.buildReceivingReportModel()` consuming canonical selectors.
- **Rule:** report rendering may format values but may not recalculate operational totals.

---

# 7. Priority migration order

1. Confirmed-arrival eligibility and arrival timestamp normalization.
2. Receiving-night summary.
3. Archive Space Force field normalization.
4. Shared arrived/expected selectors for Status Board, Processing, Squadron, and reports.
5. Dorm load/capacity selectors.
6. Last-arrival derivation.
7. Timer/overtime model.
8. Archive snapshot builder.

# 8. Phase 1A decisions recorded

- “Arrived” and “processed” require confirmed-arrival eligibility.
- Airport bus-log totals are not arrival totals.
- Air Force, Space Force, female, and NAT metrics use one eligible bus set when describing arrivals.
- Receiving-night assignment uses `arrived_at`, not dorm close time, departure time, record creation time, or update time.
- Projected totals remain dorm-capacity based for Build 1 compatibility.
- Reports become consumers of canonical data models, not calculation owners.
- Archive snapshots preserve historical values but are built from the same canonical selectors used by live reporting.
