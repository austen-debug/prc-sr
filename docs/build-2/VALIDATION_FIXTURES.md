# GATE Build 2 — Validation Fixtures

Status: Phase 1A baseline
Purpose: Define deterministic operational scenarios that Build 2 domain calculations must satisfy before runtime integration.

## Fixture standard

Every fixture must contain:

- a stable fixture ID;
- operational intent;
- input records;
- receiving windows where applicable;
- requested Week Group;
- expected normalized records;
- expected derived metrics;
- explicit exclusion rules;
- Build 1 comparison notes;
- pass/fail assertions.

Fixtures use synthetic non-PII records.

---

# B2-P1-F001 — Historical receiving parity: 911 / 818 / 39 / 857

## Intent

Reproduce the known operational totals that exposed the receiving-summary defect.

## Expected output

```json
{
  "projectedTotal": 911,
  "nightOne": {
    "processed": 818,
    "naturalization": 52,
    "spaceForce": 0,
    "cumulativeProcessed": 818,
    "cumulativeNaturalization": 52,
    "cumulativeSpaceForce": 0
  },
  "nightTwo": {
    "processed": 39,
    "naturalization": 4,
    "spaceForce": 0,
    "cumulativeProcessed": 857,
    "cumulativeNaturalization": 56,
    "cumulativeSpaceForce": 0
  },
  "confirmedArrived": 857,
  "activeBusCount": 1,
  "activeBusTraineesExcluded": 20,
  "spaceForceSentenceVisible": false
}
```

## Required assertions

1. Only bus records with confirmed-arrival eligibility count.
2. The active bus with a departure timestamp inside Night Two does not count.
3. Night assignment uses `arrived_at` only.
4. NAT uses the exact same eligible bus set as processed totals.
5. No Space Force sentence is generated because projected and confirmed-arrived Space Force totals are zero.
6. Cumulative totals equal the ordered sum of receiving-night values.
7. Status Board, Processing summary, Squadron Board, Current Summary, Archive Report, and archive snapshot selectors return compatible arrived totals.

Machine-readable data: `tests/build-2/fixtures/B2-P1-F001-receiving-parity.json`.

---

# B2-P1-F002 — Active bus exclusion

## Intent

Prove that an airport bus does not count as arrived or processed before explicit confirmation.

## Inputs

- one airport bus with `status: active`;
- valid `created_at` and `departed_at` inside a receiving window;
- no `arrived_at`;
- positive total, female, NAT, and Space Force counts.

## Expected

```text
confirmed arrived = 0
receiving processed = 0
female arrived = 0
NAT arrived = 0
Space Force arrived = 0
active bus count = 1
manifested bus-log total = bus.otw_count
```

This fixture explicitly distinguishes bus-log totals from confirmed-arrival totals.

---

# B2-P1-F003 — Local arrival inclusion

## Intent

Prove that a local arrival contributes immediately because it is created as a confirmed arrival.

## Inputs

- one local bus record;
- `status: arrived`;
- valid `arrived_at` within Night One;
- total 12, female 5, NAT 2, Space Force 0.

## Expected

```text
confirmed arrived = 12
Night One processed = 12
female arrived = 5
NAT arrived = 2
active bus count = 0
```

---

# B2-P1-F004 — Space Force partition and display

## Intent

Validate that Air Force and Space Force counts partition the same confirmed-arrival total and that Space Force text is shown only when relevant.

## Inputs

- projected total 977;
- projected Space Force 120;
- confirmed total arrivals 975;
- confirmed Space Force arrivals 118.

## Expected

```text
Air Force confirmed arrivals = 857
Space Force confirmed arrivals = 118
combined confirmed arrivals = 975
Space Force sentence visible = true
Space Force projected = 120
```

No Space Force count may exceed its bus total.

---

# B2-P1-F005 — Legacy arrived record without arrival timestamp

## Intent

Force an explicit compatibility decision for historical records with `status: arrived` but no valid `arrived_at`.

## Required decision

Build 2 must not silently use `departed_at`, `created_at`, or `updated_at` for receiving-night assignment.

Permitted outcomes:

1. exclude the record from time-window summaries while retaining it in a separately flagged aggregate compatibility total; or
2. normalize it using a documented migration rule supported by auditable historical evidence.

The rule must be deterministic and separately labeled. Active/en-route records may never enter this compatibility path.

---

# B2-P1-F006 — Receiving windows cross midnight

## Intent

Validate timestamp assignment across calendar-day boundaries.

## Required assertions

- ISO timestamps are compared as instants;
- `start <= arrived_at < end`;
- a record exactly at the end boundary belongs to no prior window and may belong to the next window if its start equals that boundary;
- overlapping windows fail validation.

---

# B2-P1-F007 — Arrived bus edited after confirmation

## Intent

Confirm that editing counts on an already-arrived bus updates all derived consumers consistently without changing the original arrival window.

## Required assertions

- `arrived_at` remains the receiving assignment timestamp;
- updated total, female, NAT, and Space Force counts propagate through canonical selectors;
- Current Summary and Archive Report remain identical;
- audit/version handling is required before Build 2 enables conflict-aware writes.

---

# B2-P1-F008 — Dorm load and capacity bounds

## Intent

Validate processing assignment totals.

## Required assertions

```text
0 <= dorm.current_load <= dorm.max_load
total loaded = sum(current_load)
awaiting assignment = max(confirmed arrived - total loaded, 0)
```

The persistence boundary must reject or normalize invalid values; an input-element maximum is not sufficient.

---

# B2-P1-F009 — Archive snapshot parity

## Intent

Ensure archive closeout stores the same operational truth used by live consumers.

## Required assertions

- archive total arrived equals canonical confirmed-arrival total;
- archive NAT, female, and Space Force totals use the same eligible bus set;
- archive expected and loaded totals equal canonical dorm selectors;
- receiving-night summary generated from archived bus data matches the live summary immediately before closeout;
- archive creation is verified before live deletion.

---

# B2-P1-F010 — Empty and partial Week Group

## Intent

Validate safe behavior when records or receiving windows are missing.

## Expected

- empty collections return zero-value metric models, not exceptions;
- incomplete receiving-window pairs produce a validation error;
- absent Space Force values normalize to zero;
- invalid numeric values normalize according to the documented record contract;
- reports clearly indicate unconfigured windows rather than inventing assignments.

## Phase 1 test gate

The canonical domain layer may not assume runtime ownership until F001–F010 have executable assertions or an explicitly approved deferral with risk and owner documented.
