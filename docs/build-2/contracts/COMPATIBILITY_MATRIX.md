# GATE Build 2 Compatibility Matrix

| Producer or consumer | Reads | Writes | Phase 1C rule |
|---|---|---|---|
| Build 1 Airport | legacy bus records | legacy bus records | Unchanged; future repository adapter maps to v3. |
| Build 1 Processing | legacy dorm records | legacy dorm records | Unchanged; identity must remain backend-ID based. |
| Build 1 Input | Week Group, config, dorm setup | legacy initialization records | Unchanged; receiving windows remain source evidence. |
| Build 1 Status Board | bus and dorm records | none | Unchanged; cannot become a data source. |
| Build 1 Current Summary | live records | none | Must eventually consume canonical domain output. |
| Build 1 Archive closeout | live records | archive records | Unchanged until archive repository parity is proven. |
| Build 1 Archive Report | archive records | none | Must eventually consume canonical archive snapshot. |
| Build 2 domain | normalized records | none | May import contracts; remains pure and inactive. |
| Build 2 repositories | legacy and v3 records | validated v3 records | Future Phase 1D owner. |
| API records endpoint | generic records | generic records | No direct Build 2 UI access after repository migration. |
| Audit repository | v3 actions | audit records | Future owner of mutation evidence. |

## Backward-compatibility guarantees

- Build 1 record loading is not modified.
- Existing field names remain readable through adapters.
- Existing archive data is not rewritten.
- Missing additive fields receive only documented defaults.
- Invalid or ambiguous timestamps are surfaced as warnings.
- Record identity is never replaced by display position.

## Forward-compatibility guarantees

- Version-aware envelopes support optimistic concurrency.
- Record types have registered validators.
- Complete receiving datetimes support midnight crossover.
- Audit and repository contracts can be added without changing UI calculations.
- New schema versions can coexist with v1, v2, and v3 reads.
