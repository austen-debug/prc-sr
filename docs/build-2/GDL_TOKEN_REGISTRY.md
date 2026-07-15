# GATE Design Language Token Registry

## Canonical source

- `public/app/design/tokens/foundations.mjs`
- `public/app/design/tokens/semantic.mjs`
- `public/app/design/themes/gdl-foundations.css`

The ES modules are the machine-readable governance source. The CSS file is an inactive consumer artifact for future Build 2 workshop and shell work.

## Naming model

Primitive tokens describe controlled foundation values. Semantic tokens describe purpose. Components must consume semantic names whenever a semantic alias exists.

Examples:

```text
primitive: navy800
semantic:  surfaceCommand
component: background: var(--gate-surface-command)
```

Components may not encode raw palette names such as `blue500` or arbitrary hex values.

## Semantic surfaces

```text
surfaceCanvas
surfacePanel
surfaceRaised
surfaceCommand
textPrimary
textSecondary
textMuted
borderDefault
borderStrong
```

Light and dark themes must expose the same keys.

## Operational states

```text
arrived
enroute
processing
closed
overtime
warning
failed
```

## Persistence and synchronization states

```text
saved
pending
stale
conflict
failed
```

Text and iconography must accompany state color where a user must make an operational decision.

## Spacing scale

```text
2, 4, 8, 12, 16, 20, 24, 32, 40, 48
```

Values outside this scale require a documented component exception.

## Density modes

| Mode | Control | Row | Card padding | Gap | Minimum target |
|---|---:|---:|---:|---:|---:|
| Command | 32 | 32 | 8 | 8 | 32 |
| Standard | 40 | 40 | 16 | 12 | 40 |
| Touch | 48 | 48 | 20 | 16 | 44 |

Command density is not valid for touch-only primary actions unless the component independently preserves the 44-pixel interaction target.

## Layers

```text
base 0
sticky 100
navigation 300
sheet 500
dialog 700
notification 900
```

Components may not invent local z-index values outside this model without a documented layering requirement.

## Versioning

GDL starts at `2A.1.0`.

- Patch: correction without semantic contract change.
- Minor: additive token or backward-compatible alias.
- Major: removal, rename, or changed semantic meaning.
