# GATE Build 2 — Status Board Shadow Parity Matrix

Status: PHASE 3A CONTROL  
Visible owner: Build 1 `GateStatusBoardController` and served metric source  
Shadow owner: Build 2 `public/app/status-board-shadow/*`

| Surface | Build 1 observed source | Build 2 canonical source | Comparison rule | Blocking |
|---|---|---|---|---|
| Arrived | visible `#stat-arrived` | confirmed arrivals with valid `arrived_at` | exact number | Yes |
| Expected | visible `#stat-expected` | active Week Group dorm capacity | exact number | Yes |
| Last arrival | visible `#stat-last`, currently `last_airport` config | latest confirmed arrival timestamp | exact operational HH:MM | Yes |
| Active buses | `GateStatusBoardController.getActiveBuses()` | canonical active bus selector | exact sorted record IDs | Yes |
| Dorm state counts | active Build 1 dorm records | canonical dorm state grouping | exact Empty/Open/Closed/Other counts | Yes |
| Dorm membership | active Build 1 dorm records | canonical dorm groups | exact sorted record IDs per state | Yes |
| Timer display | rendered dorm timer text | canonical elapsed/final timer | exact or within two seconds | Outside tolerance |
| Timer tone | rendered warning/critical class | 40/50-minute route policy | exact | Yes |
| Overtime | visible timer at or above 60 minutes | canonical 60-minute overtime policy | exact | Yes |

## Known intentional ownership exposure

The current visible Status Board displays the manually maintained `last_airport` configuration value. Build 2 derives the most recent confirmed PRC arrival. Phase 3A does not hide that difference. It records the mismatch as a blocking parity result until the route migration package determines the accepted presentation and retirement sequence.

## Eligibility boundary

Build 1 historically counts bus records whose status is `arrived`. Build 2 requires both arrived status and a valid arrival timestamp for confirmed-arrival truth. An arrived record without `arrived_at` therefore appears as a blocking shadow divergence rather than being silently accepted.

## Evidence categories

```text
exact       — values match
 tolerated   — timer text differs by no more than two seconds
 divergent  — one or more blocking comparisons differ
 unavailable — required context or snapshot is absent
```

## Activation review minimum

The in-memory evidence summary requires:

```text
minimum samples                  10
minimum consecutive passing       5
blocking metrics                  0
visible route activation          still requires separate approval
```

## Route-readiness fixture

```text
tests/build-2/status-board-shadow/fixtures/B2-P3A-F001-route-readiness.json
```

The fixture records all six responsive compositions, accessibility boundaries, fullscreen behavior, and the continuing production-activation block.
