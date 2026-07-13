# GATE Build 2 — Phase 1C Execution Report

Status: Implemented — not active in runtime
Phase: Record Normalization and Compatibility Boundary
Operational baseline: Build 1 remains active

## Objective

Create a deterministic, typed, lossless compatibility boundary between Build 1 generic persisted records and Build 2 canonical domain calculations.

## Implemented source

```text
public/app/data/
├── legacy-compatibility.mjs
├── record-normalizer.mjs
└── index.mjs
```

### `legacy-compatibility.mjs`

Owns:

- operational timezone conversion;
- explicit-offset timestamp preservation;
- `datetime-local` compatibility conversion;
- config-key alias normalization;
- legacy JSON-array parsing;
- schema/version compatibility defaults;
- JSON-safe source-record cloning.

### `record-normalizer.mjs`

Owns:

- canonical record envelopes;
- typed config, bus, dorm, and archive payloads;
- compatibility warnings and alias reporting;
- confirmed-arrival eligibility after normalization;
- archive Space Force reconciliation;
- raw Build 1 restoration;
- adapter output for Phase 1B selectors.

## Validation fixtures

Added:

```text
tests/build-2/fixtures/B2-P1-F011-record-compatibility.json
```

The fixture covers:

- `active_wg` to `week_group` aliasing;
- America/Chicago `datetime-local` conversion;
- arrived and active bus separation;
- numeric string normalization;
- dorm load greater than capacity;
- dual archive Space Force fields;
- stringified archive arrays;
- unknown future record preservation.

The Phase 1C suite also runs the original F001 historical fixture through the compatibility boundary to verify that normalization preserves:

```text
911 projected
818 Night One
39 Night Two
857 cumulative
52 / 4 / 56 naturalization
1 active bus excluded
```

## Automated tests

Created:

```text
tests/build-2/data/record-normalization.test.mjs
.github/workflows/build-2-data-tests.yml
```

Local validation result:

```text
9 tests
9 passed
0 failed
```

Validated behaviors:

1. summer and winter operational-timezone conversion;
2. explicit-offset timestamp preservation;
3. config alias normalization;
4. lossless raw-record restoration;
5. confirmed-arrival eligibility after normalization;
6. active-bus exclusion;
7. dorm load constraints and warnings;
8. archive confirmed Space Force precedence;
9. unknown-record preservation;
10. F001 historical parity preservation;
11. malformed archive JSON recovery.

## CI decision

The existing Phase 1B domain workflow remains focused on pure calculations.

A separate data workflow was added because the connector blocked replacement of the existing workflow. The separation is also architecturally valid:

```text
Build 2 Domain Tests → calculation contracts
Build 2 Data Tests   → persistence compatibility contracts
```

Neither workflow affects runtime delivery.

## Access-control FYSA recorded

Cloudflare bindings identified for future Squadron Board-only access:

```text
SQUADRON_USERNAME
SQUADRON_PASSWORD
```

Current finding:

- Build 1 login authenticates only MTI and Airman environment bindings.
- The new Squadron bindings are not currently consumed by repository code.
- No authentication or authorization code was changed in Phase 1C.

Future requirements:

- map successful Squadron authentication to role `squadron`;
- enforce Squadron Board-only authorization server-side;
- restrict Squadron API access to approved read operations;
- retain secrets exclusively in Cloudflare environment bindings;
- preserve the existing `prc_sr_session` cookie contract unless separately migrated.

## Forward validation

The Phase 1C design supports:

- typed repositories;
- future record-version checks;
- stale-write conflict handling;
- normalized server state;
- canonical domain selectors;
- diagnostics and audit events;
- future backend replacement without feature-level record parsing;
- future Squadron role mapping through a server-side authentication service.

## Backward validation

```text
PASS — original records remain unchanged
PASS — raw records are losslessly recoverable
PASS — F001 historical totals remain exact after normalization
PASS — Build 1 status semantics remain compatible
PASS — legacy config aliases remain readable
PASS — legacy datetime-local values receive deterministic interpretation
PASS — archive string payloads remain readable
PASS — unknown record types are preserved
PASS — no middleware asset was added
PASS — no API behavior was changed
PASS — no authentication behavior was changed
```

## Known constraints

1. `America/Chicago` is currently the compatibility default and must become repository/configuration context before runtime integration.
2. Unversioned records normalize to `recordVersion: 0`; conflict-aware writes are not yet implemented.
3. Normalization warnings are available to future diagnostics but are not surfaced in the Build 1 UI.
4. Archive records are normalized as read models only; no historical data is rewritten.
5. Squadron credentials are provisioned but not yet activated in application authentication.

## Runtime and rollback boundary

No file under `public/app/data/` is loaded by active middleware.

Rollback is removal of the inactive Build 2 files and tests. No database rollback or operational data repair is required.

## Next phase

```text
Build 2 — Phase 1D
Typed Repository Boundary and Persistence Commands
```

Phase 1D should implement repository contracts around the existing records API without allowing UI components to write generic records directly.
