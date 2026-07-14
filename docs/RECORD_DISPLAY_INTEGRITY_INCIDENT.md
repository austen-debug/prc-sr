# GATE Record Display Integrity Incident

Status: Remediation implemented; live validation required  
Severity: Operational data-display integrity  
Date: 14 July 2026

## Incident statement

GATE displayed dorm records inconsistently across Status Board, Processing, and Squadron Board. Reported symptoms included:

- dorms appearing in an order different from the Input sequence;
- Band or Space Force labels appearing associated with the wrong visible dorm;
- disagreement between pages that consumed the same persisted dorm records.

Until remediation was applied, affected dorm order and designation presentation could not be treated as reliable.

## Root causes

### 1. Input order was not a persisted contract

Dorm records were created sequentially from Input, but no explicit display-order field was stored. Status Board, Processing, and Squadron Board independently sorted dorms by `dorm_name`, discarding the operational Input sequence.

### 2. Page-level ordering implementations diverged

Each page selected and sorted dorm records independently. A correction on one page did not guarantee parity on the others.

### 3. Dorm designation validation allowed positional fallback

The dorm-flag validator attempted to resolve a card by record ID, but could fall back to the card's array index. When page order differed from backend array order, this fallback could apply a Band or Space Force indicator to the wrong visible card.

### 4. Dorm creation metadata was second-guessed after payload construction

The Input SDK wrapper searched the current batch grid to re-identify a dorm payload and rewrite designation fields. This duplicated responsibility already owned by `buildDormPayload()` and created an avoidable metadata-drift path.

### 5. Archive dorm reconciliation used dorm name alone

Archive compatibility logic matched live dorms to archive dorms using `dorm_name` without Squadron and Week Group identity. Reused dorm names could therefore select the wrong live record.

## Implemented record contract

`public/js/gate-record-display-contract.js` is the canonical owner for:

- dorm identity: Week Group + Squadron + Dorm name;
- explicit display order;
- legacy creation-order fallback;
- immutable record sorting;
- Band and Space Force flag normalization.

Order precedence:

```text
1. display_order
2. input_order
3. source_row_index / row_index
4. persisted created_at
5. stable dorm identity and original source position
```

## Implemented corrections

### Input

New dorm records now persist:

- `display_order`;
- `input_order`;
- `source_row_index`;
- `dorm_identity`.

Designation fields are taken from the payload built from that exact Input row. The SDK wrapper no longer searches the live batch grid to guess the source row.

### Status Board, Processing, and Squadron Board

All three consumers use `GateRecordDisplay.sortDorms()`.

### Dorm designation rendering

Band and Space Force validation is record-ID bound. Card-index fallback and the broad `MutationObserver` were removed.

### Archive compatibility

Dorm reconciliation uses Week Group + Squadron + Dorm identity. It no longer uses dorm name alone.

## Data-mutation boundary

The remediation does **not** automatically rewrite existing live or archived records.

Legacy records without explicit order metadata display using persisted record creation order, which reflects sequential Input creation under the current initialization workflow.

If a specific existing record still carries an incorrect `band`, `space_force`, or `is_space_force` value after a hard refresh, that is a stored-record defect. It must be corrected deliberately by record identity; GATE must not infer the intended designation from card position.

## Automated guard

`Runtime Record Integrity` verifies:

- active JavaScript syntax;
- canonical contract load order;
- shared sorting across all dorm consumers;
- persisted Input order and identity fields;
- absence of batch-row re-matching;
- absence of card-index designation assignment;
- absence of the former broad designation observer.

## Live acceptance criteria

```text
PASS — Status Board order matches Input sequence
PASS — Processing order matches Status Board
PASS — Squadron Board order matches Status Board
PASS — Band labels remain attached to the same dorm identity on every page
PASS — Space Force labels remain attached to the same dorm identity on every page
PASS — browser refresh preserves order and designations
PASS — moving a dorm between Empty/Open/Closed preserves relative order within the destination state
PASS — editing load, phase, Airman assignment, or timing does not change order or designation
PASS — newly initialized Week Groups persist explicit display order
```

## Program status

Build 2 Phase 1C remains paused until the live acceptance criteria pass. No additional Build 2 integration should proceed while active record presentation is unverified.