# GATE Build 2 — Responsive Validation Matrix

Status: Phase 2D executable validation baseline

## Reference fixtures

| Fixture | Geometry | Capability profile | Expected posture | Navigation | Density |
|---|---|---|---|---|---|
| B2-P2-F002-01 | 1440×900 | Fine pointer, hover, keyboard | Desktop landscape | Persistent | Command |
| B2-P2-F002-02 | 1080×1920 | Fine pointer, hover, keyboard | Desktop vertical | Compact | Standard |
| B2-P2-F002-03 | 1024×768 | Coarse pointer, no hover, no keyboard | Tablet landscape | Compact | Touch |
| B2-P2-F002-04 | 820×1180 | Coarse pointer, portrait safe area | Tablet portrait | Sheet | Touch |
| B2-P2-F002-05 | 740×360 | Coarse pointer, landscape side safe area | Phone landscape | Sheet | Touch |
| B2-P2-F002-06 | 390×844 | Coarse pointer, reduced motion, portrait safe area | Phone portrait | Sheet | Touch |

Machine-readable source:

```text
tests/build-2/responsive/fixtures/B2-P2-F002-postures.json
```

## Boundary matrix

| Geometry | Expected result | Purpose |
|---|---|---|
| 1179×800 | Tablet landscape | Width immediately below desktop landscape |
| 1180×699 | Tablet landscape | Height immediately below desktop landscape |
| 1180×700 | Desktop landscape | Exact desktop landscape threshold |
| 767×400 | Phone landscape | Width immediately below tablet landscape |
| 768×400 | Tablet landscape | Exact tablet landscape threshold |
| 899×1200 | Tablet portrait | Width immediately below desktop vertical |
| 900×1179 | Tablet portrait | Height immediately below desktop vertical |
| 900×1180 | Desktop vertical | Exact desktop vertical threshold |
| 599×900 | Phone portrait | Width immediately below tablet portrait |
| 600×900 | Tablet portrait | Exact tablet portrait threshold |

## Capability matrix

| Condition | Required behavior |
|---|---|
| Pointer coarse | Touch density; 44px minimum target; no hover enhancement |
| Pointer none | Touch density; 44px minimum target; no hover enhancement |
| Pointer fine plus hover | Hover enhancement permitted |
| Pointer fine without keyboard | Pointer density retained; keyboard shortcuts unavailable |
| Keyboard available | Keyboard capability exposed without changing route or data behavior |
| Reduced motion | Composition transitions and animations removed |
| Invalid safe-area value | Normalize to zero |
| Invalid pointer value | Fall back to coarse |
| Invalid dimensions | Fall back to touch-safe portrait dimensions |

## Container matrix

| Boundary | Expected band |
|---:|---|
| 0px | Compact |
| 319px | Compact |
| 320px | Standard |
| 639px | Standard |
| 640px | Expanded |

Every governed component must define compact, standard, and expanded behavior. Container bands are contiguous and contain no gap or overlap.

## Automated validation

```text
tests/build-2/responsive/responsive-composition.test.mjs
.github/workflows/build-2-responsive-tests.yml
```

The suite verifies:

1. exactly six posture contracts exist;
2. every fixture resolves to the expected posture, navigation mode, density, and input state;
3. all posture thresholds are contiguous;
4. orientation is derived from dimensions;
5. pointer, hover, and keyboard signals remain independent;
6. coarse and absent pointers enforce touch targets;
7. safe-area values normalize without entering operational state;
8. component container contracts are contiguous;
9. shell layout uses viewport queries;
10. reusable components use container queries;
11. responsive CSS consumes GDL tokens and contains no operational page selectors;
12. responsive core contains no DOM, API, repository, user-agent, or style-injection dependency;
13. the workshop renders all six postures from one shell surface;
14. Build 1 middleware does not load responsive assets;
15. Phase 1, GDL, component, and shell regressions pass before Phase 2D closes.

## Manual review retained for Phase 2E and Phase 3

Phase 2D validates composition contracts, not final production-page usability. Manual validation remains required for:

- 200% zoom and browser text scaling;
- screen-reader announcement order;
- hardware keyboard focus order;
- touch ergonomics on representative hardware;
- feature-specific overflow and data density;
- fixed command-display burn-in and long-duration stability;
- route-by-route feature parity during Phase 3 migration.
