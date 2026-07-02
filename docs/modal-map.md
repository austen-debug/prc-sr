# PRC GATE Modal System Map

This map documents the current modal and popup surface contract for the receiving application. It is intended to prevent modal behavior from becoming tribal knowledge as PRC GATE moves from repair/validation mode into a cleaner system package.

## Modal layer standard

All primary popups use the shared `.confirm-overlay` backdrop pattern and should remain behind the same layer contract:

| Layer | Purpose | Token |
|---|---|---|
| Base app | Background, watermarks, page base | `--z-base-app` |
| Page content | Status Board, Airport, Input, Processing, Archives, Squadron Board | `--z-page-content` |
| Fixed nav | Security banner, app navigation | `--z-fixed-nav` |
| Modal backdrop | Full-screen modal overlay | `--z-modal-backdrop` |
| Modal window | Actual modal surface | `--z-modal-window` |
| Context/toast add-ons | Instructor context menu and access-denied toast | `--z-modal-window + offset` |

## Active modal inventory

| Surface ID / selector | User-facing purpose | Primary entry path | Role | Data affected | Close behavior | Notes |
|---|---|---|---|---|---|---|
| `#dorm-modal` | Dorm Processing modal | Click/tap Processing dorm card | Instructor and Airman can open processing view; instructor controls remain guarded by role logic | Dorm phase, load, assigned airman, auditorium location, open/close actions | Close button / action completion | This is the operational processing control surface. Auditorium Location is entered here and displayed on Status Board + Processing only. |
| `#dorm-edit-modal` | Dorm record correction modal | Instructor right-click menu → Edit Record; original dorm edit path | Instructor only | Dorm identity/details, sex, band, Space Force, assigned airman, auditorium location, notes | Cancel/save/delete | This is the correction surface, not the normal processing flow. |
| `#airport-bus-edit-modal` | Airport/local bus correction modal | Airport bus log row click | Instructor only | Bus ID/name, OTW, female, naturalization, Space Force counts | Cancel/save | Local bus and airport bus edit use the same correction surface. |
| `#local-bus-modal` | Local bus creation modal | Airport/local bus workflow | Instructor only | New local bus record | Cancel/create | Should use same modal sizing and form spacing as other small correction modals. |
| `#archive-edit-modal` | Archived week group correction and print/PDF modal | Archive card right-click/double-click/Enter | Instructor only | Archive metadata, dorm JSON, bus JSON, receiving windows, print/PDF, archive delete | Cancel/save/delete/print | This is the largest modal and must remain scroll-safe on mobile. |
| `#confirm-dialog` | Generic confirmation dialog | Destructive/major operational actions | Depends on caller | No direct data; confirms callback execution | Yes/Cancel | Used for closeout and other confirmation paths. |
| `#gate-processing-context-menu` | Processing page instructor action menu | Desktop right-click; mobile long-press | Instructor only | Opens Edit Record, Processing Controls, or Delete Record path | Outside click, Escape, scroll, resize, action selection | Styled as a context menu on desktop and bottom sheet on mobile. |
| `#gate-access-denied-toast` | Client-side role feedback | Airman attempts instructor-only UI control | Airman receives message | None | Auto-hide | This is a UI guard only; it does not replace server-side authorization. |

## Mobile behavior contract

- Primary modals must fit within `100dvh` and use internal scroll, not page scroll.
- Modal headers should remain sticky when the body scrolls.
- Form grids collapse to one column below mobile widths.
- Buttons stack full-width on mobile.
- Archive JSON textareas must be height-limited so Save/Cancel remains reachable.
- Processing instructor actions use long-press on touch devices and must reuse the same instructor-gated context menu path.

## Role/access contract

Instructor-only surfaces:

- Dorm Edit modal
- Airport/local bus edit modal
- Archive Edit modal
- Closeout
- Input/initialize controls
- Airport controls
- Archive edit/delete/print controls
- Processing right-click/long-press context menu

Airman-visible operational surfaces:

- Status Board
- Processing page
- Dorm Processing modal view, subject to guarded action controls

## Consolidation note

Canonical modal and mobile UI styles should live in `public/css/prc-dash-modal-systems.css`. JavaScript modules may create DOM and perform behavior, but should avoid injecting durable styling unless a future emergency patch requires it.
