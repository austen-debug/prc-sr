# GATE Build 2 — Status Board Shadow Rollback Plan

Status: REQUIRED / NOT YET EXERCISED IN A CONTROLLED ENVIRONMENT  
Recovery target: Build 1-only Status Board execution

## Scope

This rollback applies to the hidden Phase 3A Status Board shadow observer only. It does not roll back records, schemas, operational workflows, or the visible Build 1 Status Board because Phase 3A does not own any of those surfaces.

## Trigger conditions

Execute rollback when any of the following is observed:

- the shadow bridge causes a runtime error;
- shadow evaluation degrades Build 1 rendering or responsiveness;
- diagnostic output contains prohibited data;
- unexpected network, storage, route, or service-worker behavior occurs;
- the observer cannot be proven read-only.

## Rollback procedure

1. Remove the following asset from `UI_HEAD_SCRIPTS` in `functions/_middleware.js`:

   ```text
   /js/gate-status-board-shadow-controller.js
   ```

2. Deploy the middleware-only change through the approved environment path.
3. Perform a clean application reload.
4. Confirm `window.GateStatusBoardShadow` is absent.
5. Confirm `window.GateStatusBoardController` remains the visible Status Board owner.
6. Validate the Build 1 Status Board:
   - Arrived and Expected metrics;
   - Last and Local metrics;
   - active-bus cards and arrival confirmation;
   - Empty, Open, and Closed dorm regions;
   - dorm card indicators;
   - timer warning, critical, and overtime behavior;
   - existing role-aware navigation.
7. Confirm the canonical route registry still contains only the six approved routes.
8. Confirm no Build 2 service worker is registered.
9. Confirm no Build 2 record write, migration, or queue is required.
10. Retain the environment, deployment reference, timestamp, operator role, and smoke-test result.

## Data safety

```text
Operational write required: NO
Schema change required: NO
Data migration required: NO
Archive change required: NO
Cache policy change required: NO
```

The rollback must not delete or modify operational records.

## Recovery acceptance

Rollback passes only when:

- the shadow diagnostic API is absent;
- Build 1 remains operational;
- no additional route is visible;
- no Build 2 service worker is active;
- runtime record-integrity validation passes;
- the retained rollback evidence identifies the controlled environment and result.

## Reintroduction

The shadow bridge may be restored only after the triggering condition is corrected, automated validation is green, and the observer-only boundary is reconfirmed.
