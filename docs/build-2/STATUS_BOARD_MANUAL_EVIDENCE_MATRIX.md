# GATE Build 2 — Status Board Manual Evidence Matrix

Status: EVIDENCE COLLECTION OPEN  
Scope: route-specific human validation required before any Phase 3B authorization review

## Evidence record format

Every completed check must retain:

```text
checkId
status: pass | fail
observedAt
review environment
validation method
artifact reference
reviewer role
```

Do not retain personal names, email addresses, phone numbers, trainee identifiers, DoD identifiers, Social Security numbers, credentials, cookies, or secrets.

## Responsive posture evidence

| Check ID | Required posture | Pass condition | Expected artifact |
|---|---|---|---|
| `responsive.desktop-landscape` | Desktop landscape | Four metrics, three dorm regions, active-bus lane, timers, and command-display behavior remain readable with no route-level clipping | Full-route capture and notes |
| `responsive.desktop-vertical` | Desktop vertical | Two-column metric composition and stacked state regions preserve reading order and reachability | Full-route capture and notes |
| `responsive.tablet-landscape` | Tablet landscape | Metrics, dorm regions, active buses, and touch controls remain usable without page-width overflow | Full-route capture and notes |
| `responsive.tablet-portrait` | Tablet portrait | Two-column metrics, stacked dorm regions, and horizontal active-bus overflow remain understandable | Full-route capture and notes |
| `responsive.phone-landscape` | Phone landscape | Compact height does not hide route identity, metrics, active buses, dorms, or fullscreen controls | Full-route capture and notes |
| `responsive.phone-portrait` | Phone portrait | One-column route reflows without clipped text, inaccessible controls, or horizontal page overflow | Full-route capture and notes |

Each posture must also confirm:

- visible route heading;
- visible Empty, Open, and Closed region identities;
- timer text remains legible;
- Space Force, Band, and female indicators do not rely on color alone;
- active-bus controls remain operable;
- no orientation lock is required.

## Accessibility evidence

| Check ID | Pass condition |
|---|---|
| `accessibility.keyboard-route` | All interactive controls are reachable and operable using the keyboard alone; no keyboard trap exists |
| `accessibility.focus-visible-order` | Focus is visible, follows visual/reading order, and is never lost after route actions |
| `accessibility.landmarks-headings-labels` | Banner, navigation, main, route heading, metric labels, active-bus label, and dorm-region headings are announced correctly |
| `accessibility.screen-reader` | The route is understandable with a screen reader; changing timers do not continuously interrupt speech |
| `accessibility.contrast-forced-colors` | Text, focus, state, and controls remain perceivable in normal and forced-colors modes |
| `accessibility.zoom-reflow` | Route remains usable at 200% and 400% zoom without two-dimensional page scrolling except governed regional overflow |
| `accessibility.touch-targets` | Operational controls meet the governed touch-target minimum and do not overlap |

## Fullscreen evidence

| Check ID | Pass condition |
|---|---|
| `fullscreen.entry-exit` | Fullscreen entry and exit controls are visible, labeled, and operable |
| `fullscreen.escape` | Escape exits fullscreen consistently |
| `fullscreen.focus-restoration` | Focus returns to the control that initiated fullscreen |
| `fullscreen.route-isolation` | Fullscreen affects only the Status Board presentation and does not alter navigation or route state |

## Degraded-operation evidence

| Check ID | Pass condition |
|---|---|
| `degraded.stale-readonly` | Stale state is visibly identified and the route remains read-only |
| `degraded.offline-readonly` | Offline state is visibly identified and no write affordance is introduced |
| `degraded.last-sync` | Last successful synchronization context is visible and understandable |
| `degraded.reconnect-refresh` | Reconnection performs an authoritative refresh and clears stale state only after success |

## Rollback evidence

| Check ID | Pass condition |
|---|---|
| `rollback.disable-shadow-asset` | Removing the shadow bridge asset from middleware disables the observer cleanly |
| `rollback.build1-smoke` | Build 1 metrics, active buses, dorm columns, timer display, and existing navigation still pass smoke validation |
| `rollback.no-residual-route` | No Build 2 route, feature flag, service worker, or persistence owner remains after rollback |

## Failure handling

A failed check must:

1. remain failed in the retained review packet;
2. include a concise reproduction method and artifact reference;
3. identify whether the defect belongs to Build 1 presentation, Build 2 contract, environment configuration, or evidence tooling;
4. block Phase 3B authorization review until corrected and revalidated.

A failure may not be changed to pass solely by documentation. A later observation with a retained artifact must demonstrate correction.
