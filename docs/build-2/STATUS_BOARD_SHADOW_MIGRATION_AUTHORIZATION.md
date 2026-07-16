# GATE Build 2 — Status Board Shadow Migration Authorization

Status: AUTHORIZED AFTER GATE F CI CLOSURE  
Authorization class: hidden, read-only, non-operational comparison

## Authorized scope

The next migration package may:

- consume the authoritative records list through the staged canonical normalization boundary;
- calculate the Build 2 Status Board summary in parallel with Build 1;
- compare arrived, expected, active buses, last arrival, local arrivals, dorm state, loads, timers, overtime, and operational indicators;
- record comparison results in test output, development logs, or non-PII diagnostic fixtures;
- expose the comparison only through a controlled non-production test surface or disabled feature flag;
- collect responsive, accessibility, fullscreen, stale/offline, and cross-tab evidence.

## Prohibited scope

The shadow package may not:

- replace or alter the visible Build 1 Status Board;
- change the default route;
- write operational records;
- register the staged service worker in Build 1;
- expose Build 2 to normal operational users;
- retire any Build 1 controller, renderer, calculation, stylesheet, or middleware asset;
- treat a parity mismatch as permission to change Build 1 operational truth without a documented decision;
- advance directly to Processing or another write-capable route.

## Required shadow evidence

```text
PASS — same authoritative input records
PASS — active Week Group parity
PASS — arrived and projected totals parity
PASS — AF, SF, female, and NAT parity
PASS — active bus and last-arrival parity
PASS — local-arrival parity
PASS — empty/open/closed dorm parity
PASS — dorm load and capacity parity
PASS — timer and overtime ownership parity
PASS — Female, Band, and Space Force indicator parity
PASS — stale/offline display is visibly read-only
PASS — foreign-tab invalidation triggers authoritative refetch
PASS — all six responsive postures
PASS — keyboard, focus, screen-reader, contrast, and reflow evidence
PASS — fullscreen/command-display evidence
PASS — immediate rollback to Build 1-only execution
```

## Activation decision after shadowing

Shadow parity does not automatically authorize production activation. A later Status Board activation package must identify:

- the exact Build 1 owner being replaced;
- the Build 2 route host and feature flag;
- production deployment prerequisites;
- manual accessibility and command-display results;
- mismatch disposition;
- activation sequence;
- rollback sequence;
- monitoring period;
- legacy retirement criteria.

## Route order

Status Board remains first. Processing, Airport, Input, Archives/Reports, and Squadron Board remain blocked until their preceding route and route-specific prerequisites are complete.
