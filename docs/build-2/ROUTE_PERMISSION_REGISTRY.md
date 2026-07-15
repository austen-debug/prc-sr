# GATE Build 2 — Route and Permission Registry

Status: Phase 2C inactive canonical registry  
Source: `public/app/shell/route-registry.mjs` and `permission-registry.mjs`

## Canonical routes

| Route ID | Label | Build 1 page | Group | Instructor | Airman | Squadron | Default |
|---|---|---|---|---:|---:|---:|---|
| `board` | Status Board | `page-board` | operations | Yes | Yes | No | Instructor, Airman |
| `airport` | Airport | `page-airport` | operations | Yes | No | No | — |
| `input` | Input | `page-input` | configuration | Yes | No | No | — |
| `processing` | Processing | `page-processing` | operations | Yes | Yes | No | — |
| `archives` | Archives | `page-archives` | records | Yes | No | No | — |
| `squadron` | Squadron Board | `page-squadron` | leadership | Yes | No | Yes | Squadron |

This matches the active Build 1 role and route baseline captured in fixture `B2-P2-F001`.

## Role contracts

### Instructor

Purpose: full operational and administrative application access.

Allowed routes:

```text
Status Board
Airport
Input
Processing
Archives
Squadron Board
```

Default route: `board`

### Airman

Purpose: operational Status Board and Processing access.

Allowed routes:

```text
Status Board
Processing
```

Default route: `board`

### Squadron

Purpose: read-only Squadron Board access.

Allowed route:

```text
Squadron Board
```

Default route: `squadron`

## Unknown-role compatibility

Build 1 currently falls back to Airman behavior when a recognized authenticated role is unavailable. Phase 2C preserves that least-privileged authenticated compatibility rule:

```text
unknown role → airman route contract
```

This does not authenticate an unknown user. Authentication and session validation remain server responsibilities.

## Shell controls

The registry defines shell-level availability for:

```text
session
theme
density
sound
fullscreen
Week Group context
```

All authenticated roles may use or view these shell controls. Individual feature actions are not granted by this registry.

Operational action permissions remain feature contracts and must be enforced server-side where protected data or writes are involved.

## Permission rules

1. Route labels and role permissions must not be duplicated in renderers.
2. A navigation composition receives its routes from `allowedRoutesForRole()`.
3. A route request is accepted only through `canAccessRoute()`.
4. Each role has exactly one default route.
5. A default route must also be an allowed route.
6. Unknown route IDs are denied.
7. Role changes re-evaluate the active route immediately.
8. Client-side route visibility is not a substitute for API authorization.

## Future changes

A new route or role requires:

- registry update;
- permission decision;
- default-route validation;
- server authorization review;
- navigation validation across all Phase 2D compositions;
- Build 1/Build 2 parity decision;
- automated fixture update;
- documentation update.

No feature may add an unregistered route directly to a navigation renderer.
