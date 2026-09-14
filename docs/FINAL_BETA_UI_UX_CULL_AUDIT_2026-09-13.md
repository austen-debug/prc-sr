# GATE Final Beta UI / UX Cull and Architecture Audit

**Audit date:** 13 September 2026  
**Repository:** `austen-debug/prc-sr`  
**Audited production baseline:** `27eff01cc607439147f8dae01ccd11885f4792ab`  
**Audit branch:** `audit/final-beta-ui-ux-cull`  
**Operational posture:** live weekly beta; preservation of record flow and state logic is mandatory.

---

## Executive assessment

GATE's current data path is substantially more stable than its presentation/runtime stack. D1 writes are parameterized, records receive backend IDs and versions, successful client mutations are followed by an authoritative `/api/records` refresh, closed-dorm timer semantics are normalized on the server, and closeout verifies the archive before it begins deleting live records.

The dominant final-beta risk is therefore **not unexplained D1 data loss**. The larger operational risks are:

1. **Runtime ownership overlap.** The served application combines legacy inline application code, middleware source rewriting, 27 directly injected scripts, 13 directly linked stylesheets, 3 imported stylesheet layers, and additional styles injected dynamically by JavaScript. Several compatibility controllers still observe or repair DOM owned by newer canonical controllers.
2. **Full-table synchronization.** Every initialized client polls the entire records table every 3 seconds. That includes retained archive and sound-event records for roles that are allowed to see them. Payload and JSON comparison cost therefore grow with retained history rather than only with the active week group.
3. **No active offline shell.** Once the first records load succeeds, a client can continue displaying its last in-memory state during a temporary outage, but there is no active service worker or durable offline store. If the first records request fails, the normal 3-second polling loop is never installed and the session can remain on an empty snapshot until reload.
4. **Sequential multi-record workflows.** Week-group initialization and closeout intentionally favor correctness and verification, but they perform many serial writes and full authoritative refreshes. On degraded networks they are slow and can finish partially.
5. **Server authorization is coarser than UI authorization.** The API enforces authenticated role-level read/write capability, but write authorization is not currently narrowed by record type and action to the same granularity as the UI. Client permission guards must not be treated as the security boundary.
6. **Startup and visual ownership remain migration-heavy.** The bottom-of-document legacy app starts `initApp()` while middleware-injected deferred controllers are still resolving into their final ownership graph. Retry wrappers, lifecycle hooks, validation passes, and compatibility observers compensate for this, but increase the opportunity for flashes and duplicate rendering.

**Final-beta recommendation:** keep the current record and persistence machinery frozen for the remainder of this beta. Cull only proven duplicate presentation ownership now. Perform the synchronization, authorization, offline, batching, and route modularization work as controlled next-phase changes with rollback coverage.

---

# 1. Current backend logic state and flow

## 1.1 Request architecture

The application is served through Cloudflare Pages/Functions. The effective application is not simply `public/index.html`.

The request path is effectively:

```text
Browser
  -> Cloudflare Pages / Functions
     -> root middleware authenticates / transforms app HTML
     -> API middleware verifies the signed session and places it in context.data
     -> route Function executes
        -> D1 via env.DB for record persistence
        -> external provider + Cloudflare Cache API for SAT arrivals
  -> JSON / transformed HTML response
```

Important files:

- `functions/_middleware.js` — authenticated application shell and runtime injection/source transformation.
- `functions/api/_middleware.js` — verifies request session and places the session in `context.data.session`.
- `functions/api/session-contract.mjs` — signed session verification contract.
- `functions/api/records.js` — D1 record CRUD.
- `functions/api/records-contract.mjs` — record versioning, role capability, audit-event and role-sanitization contract.
- `functions/api/sat-arrivals.js` — external SAT flight data adapter and edge caching.
- `wrangler.jsonc` — runtime compatibility/assets declaration.

## 1.2 D1 binding and reproducibility

`functions/api/records.js` consistently uses `env.DB`, and all observed SQL values are passed through `.bind(...)`. This is the correct parameterized D1 pattern and avoids string-concatenated SQL injection risk.

However, `wrangler.jsonc` does **not** declare a `DB` D1 binding. The live binding may be configured in the Cloudflare project/dashboard, but that makes the infrastructure contract non-reproducible from the repository alone.

**Disposition:** do not alter the live binding during the beta. For the next phase, make the production/staging binding contract explicit in deployment configuration without committing credentials or secrets.

## 1.3 Records API behavior

### GET `/api/records`

- Requires a valid role recognized by the records contract.
- Executes one D1 query for the full records table ordered by `created_at ASC`.
- Parses each record JSON payload and restores backend metadata such as `__backendId` and `record_version`.
- Applies role sanitization.
- Returns `Cache-Control: no-store`.

For the Squadron role, the server filters records to `bus`, `dorm`, and `config` and removes assignment/location/notes fields.

### POST `/api/records`

- Requires a role allowed to write.
- Requires `type`.
- Validates `audit_event` records more strictly than general operational records.
- Generates a backend ID.
- Stamps record version, timestamps, and role provenance.
- Awaits the D1 `INSERT` before returning success.
- Returns an ETag carrying the record version.

### PUT `/api/records`

- Requires a role allowed to write.
- Supports optional `If-Match` optimistic concurrency.
- Loads the current record first.
- Rejects mutation of append-only audit events.
- Preserves closed-dorm state/timer semantics and supports explicit manual reopen/manual final-time override markers.
- Increments `record_version` server-side.
- Can return a 409 record-version conflict if `If-Match` is supplied and stale.

### DELETE `/api/records`

- Requires a role allowed to write.
- Supports optional `If-Match` optimistic concurrency.
- Rejects deletion of append-only audit events.
- Deletes by backend record ID.

## 1.4 Backend strengths

- Parameterized D1 access is consistently used.
- Mutations wait for database execution before returning success.
- Backend-generated IDs prevent client ID collisions.
- Record versions and conditional-write capability already exist.
- Closed-dorm timer behavior is normalized server-side rather than trusting client state alone.
- Audit events are append-only.
- Server stamps actor role provenance.
- Squadron record reads are sanitized server-side.

## 1.5 Backend risks requiring next-phase work

### P1 — conditional writes exist but the active client does not use them

The active Data SDK does not send `If-Match`. Therefore the records API currently behaves as **last successful writer wins** for normal client updates, even though the server already supports optimistic concurrency.

This matters in a multi-device live environment: two operators can load version N, edit independently, and the second write can overwrite fields changed by the first.

**Do not retrofit this during the final beta.** The correct next-phase change is a coordinated client/server conflict UX with record-version-aware retries or operator resolution.

### P1 — server write authorization is broad

`records-contract.mjs` currently permits write access for `instructor`, `airman`, and `system`. The browser UI has more granular restrictions, but the records API does not yet enforce a record-type/action matrix equivalent to the UI.

An authenticated role must be treated as potentially hostile. The next phase should authorize operations server-side, for example:

- which roles may create/delete dorms;
- which roles may change Week Group config;
- which roles may close/reopen dorms;
- which fields an Airman is allowed to update;
- which roles may create or alter archives.

Client `GatePermissionGuard` remains a UX control, not a Zero Trust boundary.

### P1 — operational record schemas are loosely validated

General POST records primarily require a `type`; PUT requires an ID. D1 injection is protected by parameterized SQL, but business-schema validation is not yet strict at the edge.

The next phase should validate record type, permitted fields, lengths, enums, numeric ranges, timestamp forms, and role-specific field mutation before D1 execution.

### P2 — backend exception text is returned to clients

Several Function catch paths return `error.message`. That can expose provider, D1, or runtime implementation details.

The next phase should log an opaque incident/reference ID server-side and return a stable safe user message.

### P2 — HSTS / explicit edge security headers are not declared in this repository

No repository-level HSTS policy was found during this audit. Cloudflare may enforce transport/security policy outside the repository; that must be verified in the zone/project configuration rather than assumed.

---

# 2. Records persistence logic and page relationships

## 2.1 Active client store

The active application still uses the legacy/global record store:

```text
/api/records
   -> dataSdk.refresh()
      -> records JSON
         -> allData
            -> renderAll()
            -> page-specific controllers/hooks
```

`dataSdk.init(handler)` performs an initial authoritative GET, then starts a 3-second polling interval. The refresh layer stringifies the returned record array and compares it to the previous serialized payload; the update handler runs when the payload changes or when a forced refresh is requested.

Every successful active Data SDK mutation follows this pattern:

```text
POST / PUT / DELETE
  -> successful API response
  -> await refresh(true)
  -> authoritative GET /api/records
  -> replace/update allData through the SDK handler
  -> render/lifecycle fanout
```

This is intentionally conservative. The UI does not treat a write as final until the server confirms it, and it then re-reads authoritative state.

## 2.2 Persistence relationship by page

| Page | Primary records consumed | Writes | Persistence behavior |
|---|---|---:|---|
| Status Board | `dorm`, `bus`, config, derived metrics | Generally no direct board mutation | Reads global authoritative snapshot; remote changes arrive on the 3-second records poll. |
| Airport | `bus`, config; SAT data is separate API | Yes | Bus create/edit/arrival/delete uses Data SDK. Successful record mutation is followed by authoritative GET. |
| Input | `config`, `dorm` | Yes | Week-group initialization writes config then creates dorm records sequentially; every mutation performs an authoritative GET. |
| Processing | `dorm` | Yes | Load, assignment, phase, open/close/reopen/edit operations update a dorm through Data SDK; successful write refreshes authoritative records. |
| Archives | `archive`, live `dorm`, `bus`, `sound_event`, config | Yes during closeout | Archive is created and separately verified before live record deletion begins. Deletes and config clears are sequential. |
| Squadron Board | sanitized `dorm`, `bus`, config | No normal write UI | Renders the server-sanitized records available to Squadron role. |

## 2.3 Record-version capability gap

The server returns and stores `record_version`, and accepts `If-Match`. The client currently sends neither an expected version nor a conflict-resolution workflow. That gap is the most important persistence modernization item after beta.

## 2.4 Sound events are records

Operational sound events are persisted as `sound_event` records. This allows cross-client sound behavior and deduplication, but it also means sound history contributes to the full-table `/api/records` payload.

There is a near-record-limit guard that skips sound-event creation when the in-memory record set is near the application limit, but the architectural issue remains: retained non-live data is delivered to normal clients on every poll unless sanitized by role.

---

# 3. How pages load

## 3.1 GATE is a single-document application

Navigating between Status Board, Airport, Input, Processing, Archives, and Squadron Board does **not** perform a new document navigation or a new page-specific records fetch. The pages already exist in the authenticated document or are ensured by controllers. Navigation changes `.active` state and invokes route/page lifecycle hooks.

The shell role map is approximately:

- Instructor: Status, Airport, Input, Processing, Archives, Squadron.
- Airman: Status, Processing.
- Squadron: Squadron Board.

## 3.2 Initial application startup

The startup path is approximately:

```text
Authenticated HTML request
  -> middleware transforms/injects active CSS and deferred JS
  -> legacy document reaches bottom inline script
  -> initApp()
      -> GET /api/session
      -> dataSdk.init()
          -> GET /api/records
          -> update allData
          -> renderAll()
          -> start 3-second record poll
  -> middleware-injected deferred controllers settle ownership/hooks
```

A significant architectural detail is that the legacy bottom inline script calls `initApp()` during document parsing, while the middleware-injected controller files are loaded with `defer`. Deferred scripts execute after parsing. Network waits often give those controllers time to initialize, but the ordering is not a clean module bootstrap contract. This is why several compatibility modules use DOMContentLoaded/load handlers, wrapper retries, or controller handoffs.

**Next-phase target:** one deterministic application bootstrap that imports/initializes modules in a known order, then loads data, then mounts the permitted route.

## 3.3 Page navigation lifecycle

`gate-app-shell-controller.js` is the canonical shell owner. It:

1. resolves the permitted route;
2. changes active page state;
3. updates route-aware shell classes/navigation;
4. enforces role visibility;
5. emits `afterPageChange` unless invoked silently.

`gate-ui-hooks.js` also wraps legacy `showPage()` and `renderAll()` and emits lifecycle events. It retries wrapper installation for a short startup window because ownership can be replaced by later controllers.

This compatibility design works, but creates a possible duplicate `afterPageChange` fanout when a wrapped shell route also emits its own lifecycle event. Many consumers coalesce work with `requestAnimationFrame`, which reduces visible duplication, but the architecture still performs unnecessary scheduling.

---

# 4. Load time, timers, refresh cadence, and "live" behavior

## 4.1 Important distinction: measured time vs architectural latency

This repository does not contain current Real User Monitoring sufficient to state honest millisecond load times for each route. GitHub source review can determine request counts, timer cadence, and render triggers, but not production radio/Wi-Fi latency, Cloudflare POP latency, browser parse time, or tablet paint timing.

Therefore this audit reports **latency structure and cadence**, not invented milliseconds.

A next-phase performance baseline should capture at minimum:

- HTML TTFB;
- first usable shell;
- session request duration;
- records request duration and bytes;
- records JSON parse/stringify duration;
- time from remote D1 commit to another client rendering the change;
- page activation to stable paint;
- long tasks on representative tablets;
- SAT request/cache/provider duration;
- initialization and closeout total durations.

## 4.2 Global live records cadence

After a successful initial `dataSdk.init()`:

- `/api/records` is polled every **3 seconds**.
- Each poll requests the **entire role-visible record table**.
- The client serializes the records array to compare it to the previous payload.
- Changed data fans out through render/lifecycle controllers.

Thus a change made on Device A normally becomes visible on Device B within:

```text
0–3 seconds polling delay
+ network/API/D1 response time
+ JSON/render time
```

That is near-live polling, not push/realtime synchronization.

## 4.3 Page cadence matrix

| Page | Navigation network request | Data refresh cadence | Local live timers / auxiliary cadence | Main render trigger |
|---|---:|---|---|---|
| Status Board | None | Global records poll every 3s | Canonical open-dorm timer ~1s; local clock/metrics ~1s; hidden Build 2 shadow also scheduled on lifecycle + 30s | Record change, page change, direct-surface integrity repair, visibility/focus/fullscreen recovery |
| Airport | None for record data | Global records poll every 3s | SAT arrivals checks every 20 min and fetches only in configured auto window; manual Refresh available | Record change / workflow mutation / lifecycle hooks |
| Input | None | Global records poll every 3s | No display timer | Input controller schedules grid pass on multiple global lifecycle hooks |
| Processing | None | Global records poll every 3s | Processing open-dorm timer every 1s | Record/data/page hooks; canonical grid rebuild |
| Archives | None | Global records poll every 3s | No normal 1s timer | Archive controller refreshes from global record snapshot and lifecycle hooks |
| Squadron | None | Global records poll every 3s | Open-dorm timer every 1s through shared overtime/timer controller | Signature-based board refresh on lifecycle/data hooks |

## 4.4 Status Board timer ownership

Prior to this audit branch, two timer writers could touch Status Board timer DOM:

- `gate-status-board-controller.js` — canonical Status timer owner, intentionally removes flash behavior for visual stability;
- `prc-dash-overtime-audit.js` — shared 1-second timer loop that selected every `.timer-display[data-opened]` and could reapply warning/red/flash classes.

Those owners also used different visual thresholds. This is a real class-write race and a plausible source of timer flicker.

**Safe cull applied in this audit:** the shared overtime controller still performs overtime eligibility and sound-event processing, but its DOM timer painting and injected timer CSS are now scoped to Squadron Board only. Status Board and Processing keep their existing route-specific timer owners.

## 4.5 Processing timer ownership

Processing already has its own 1-second timer loop. Its thresholds differ from Status/Squadron. This audit does **not** normalize the thresholds because that could change operational semantics. The only change is removal of the competing shared timer painter.

## 4.6 Input initialization request cost

Input initialization is intentionally sequential:

1. create/update active Week Group config;
2. for each populated dorm row, create one dorm record;
3. each Data SDK mutation performs its own forced authoritative GET afterward.

For `N` dorms, the minimum records API traffic is approximately:

```text
(N + 1) mutation requests
+ (N + 1) authoritative GET refreshes
= 2(N + 1) records API requests
```

For 25 dorms, that is **52 records API requests**, executed mostly serially, before accounting for the normal 3-second poll.

This is the primary reason initialization can feel slow on weak networks. The workflow also allows partial completion: if some dorm creates fail, it reports how many were created and instructs the operator to verify records.

**Do not batch this during final beta.** The server currently declares `transactions: false` and `batchWrites: false`. A next-phase initialization endpoint should be designed transactionally rather than merely making the current loop concurrent.

## 4.7 Processing mutation request cost

A normal Processing update generally performs:

```text
PUT record
-> forced GET /api/records
```

Open/close operations also create persisted sound events. The dorm mutation's authoritative GET completes before the sound event is written, so record state is already refreshed, but modal/action completion can still wait on sound-event persistence in some Processing flows.

## 4.8 Archive closeout request cost

Closeout favors safety over speed:

1. create archive record;
2. authoritative Data SDK refresh;
3. direct `/api/records` verification that the archive exists;
4. sequentially delete live dorm/bus/sound-event records;
5. each Data SDK delete performs another full records GET;
6. clear relevant config records;
7. reset Input state/render.

This is the correct semantic ordering for “archive before destructive clear,” but it is expensive on degraded networks and is not atomic. If connectivity fails after archive verification but during deletion, the system may require operator verification/recovery.

**Next-phase target:** a server-owned closeout transaction/state machine with idempotent retry semantics.

---

# 5. Low-data and offline behavior

## 5.1 Active application is not offline-capable

Build 2 contains staged offline/service-worker work, but the currently activated Build 1 route does not register an operational service worker/offline shell. This is intentional under the current activation policy.

Consequences:

- A fresh load requires network access to the application shell and APIs.
- No durable record snapshot is stored for offline startup.
- No mutation queue exists.
- No background synchronization exists.
- A hard refresh while disconnected cannot be relied on.

## 5.2 Initial records failure is more severe than later polling failure

`dataSdk.init()` performs the first records refresh **before** it installs the 3-second poll.

If that first GET fails:

- `initApp()` catches the records initialization error;
- `allData` is set to an empty array;
- the app can continue rendering an empty-looking state;
- the normal polling interval was never installed because initialization threw before the interval setup.

Therefore a temporary network failure during first records load can leave the app looking empty until the user reloads, even after connectivity returns.

This is a **P1 resilience issue** for the next phase. It should be addressed with an explicit startup state (`loading`, `stale`, `offline`, `ready`) and a bounded reconnect loop. Do not silently represent a transport failure as “zero records.”

## 5.3 After a successful first load, temporary poll failure is safer

Once polling has been installed, later refresh failures are caught by the poll loop. Existing `allData` remains in memory, so the operator can continue seeing the last successful snapshot.

However:

- there is no prominent global stale/offline indicator;
- the age of the snapshot is not surfaced consistently;
- mutations can throw on network loss;
- retry UX varies by controller.

The next phase should visibly distinguish **fresh**, **reconnecting**, and **stale read-only** state.

## 5.4 Session bootstrap failure has no explicit recovery shell

`initApp()` awaits `loadSession()` before the records try/catch. A network error during session bootstrap can reject application initialization before the normal records fallback path.

The next phase should own session bootstrap through the same explicit connection-state machine.

## 5.5 External front-end dependencies amplify low-data risk

`public/index.html` currently loads:

- Tailwind runtime from CDN;
- Lucide from jsDelivr;
- DM Sans from Google Fonts.

This creates three extra third-party dependency paths before the app reaches a fully stable visual state. Tailwind CDN is the most consequential because the legacy markup relies heavily on utility classes.

Potential outcomes on constrained/filtered connectivity:

- delayed style application;
- font swap/layout shift;
- missing icons;
- partially unstyled legacy utility markup.

**Next-phase target:** compile required utility CSS and self-host/cache critical application assets. Do not add another runtime dependency.

## 5.6 SAT arrivals low-data behavior

SAT arrivals use a Cloudflare edge cache with a roughly 20-minute TTL. A valid cached response protects users from repeated provider calls.

If the cache is expired and the external provider fails, the current Function returns an error rather than serving an expired-but-known stale result. A future implementation should consider a bounded `stale-if-error` policy with an explicit stale timestamp.

---

# 6. UI flashing, overlapping layers, duplicate interfaces, and runtime ownership

## 6.1 Active runtime size

The recorded active middleware budget is currently:

- **13 direct stylesheets**;
- **3 imported stylesheets**;
- **27 direct scripts**.

Those numbers do not fully describe the actual number of style authorities because several active JavaScript controllers dynamically insert `<style>` elements or stylesheets.

Known active dynamic style owners include, among others:

- `gate-render-stability-fix.js`;
- `prc-dash-space-force.js`;
- `prc-dash-overtime-audit.js`;
- `prc-dash-dorm-reopen.js`;
- `gate-airport-bus-delete-controller.js`;
- Processing modal workspace stylesheet injection;
- legacy Status header stylesheet injection.

The runtime-budget document is therefore best understood as a **linked asset budget**, not a complete visual-authority count.

## 6.2 Middleware is still rewriting application source

The active middleware does more than authentication and static asset injection. It also rewrites legacy Status Board functions/markup so older `renderAll()` code has compatibility sinks.

This is explicitly temporary and is already identified in the Build 2 Status Board retirement manifest.

The next phase should move toward:

```text
source-owned route markup
+ source-owned route controller
+ shared shell primitives
+ middleware authentication/security only
```

rather than regex-transforming application functions at request time.

## 6.3 Z-index architecture: currently safe, structurally duplicated

There are conflicting historical z-index token declarations across active stylesheets:

- older modal layer: modal backdrop/window around 11000/11010;
- phone/tablet shell layers later rose above 11900–12100;
- final `gate-ui-ownership-correction.css` correctly reasserts modal backdrop/window at **13000/13010**.

Therefore the final active cascade currently keeps modals above the shell, including tablet/phone navigation. This is **not an active blocking bug** after the Phase 9 correction.

It is still fragile: the same conceptual layer is declared in multiple files and correctness depends on final cascade order.

**Next-phase cull:** define one z-index token scale in the design system and make every shell/modal/popover consume it. Remove the older competing declarations only after visual regression coverage.

## 6.4 Processing designation repair flash — corrected in this audit

Before this audit, Processing's canonical card renderer selected one border designation through a ternary:

```text
female OR Space Force OR Band
```

The dorm-flag validation controller later toggled Female, Space Force, and Band classes independently. A female Space Force dorm could therefore be:

1. rendered with only `border-female`;
2. repaired after render with `border-space-force`;
3. rebuilt canonically and lose `border-space-force` again;
4. repaired again.

That pattern is exactly the kind of brief marker flash seen during beta.

**Safe cull applied:** the canonical Processing renderer now emits independent designation classes in the first render. Space Force continues to suppress Band by contract, while Female can coexist with Space Force/Band presentation.

No record flag or persistence logic changed.

## 6.5 Shared timer class race — corrected in this audit

Before this audit, the shared overtime controller painted all `.timer-display[data-opened]`, while Status and Processing each had their own timer owner.

The owners used different warning thresholds and different flash behavior. Classes could therefore be added/removed by different 1-second loops.

**Safe cull applied:** shared timer DOM painting is now Squadron-only. Overtime record eligibility and sound-event processing remain unchanged.

## 6.6 Legacy Status header compatibility CSS — culled when inactive

`prc-dash-sat-arrivals.js` contains two responsibilities:

1. SAT arrivals board;
2. legacy Status Board header compatibility.

The canonical served Status Board no longer exposes the legacy `metric-arrived`/`metric-airport` elements, so the compatibility patch normally does nothing. However it previously requested `/css/prc-dash-board-header.css` before checking whether the legacy header existed.

**Safe cull applied:** the compatibility stylesheet is now requested only when the legacy header elements are actually present. The fallback remains available; the canonical route no longer pays for its CSS.

## 6.7 Processing modal workspace CSS can still arrive dynamically

The Processing modal validation controller dynamically appends its workspace stylesheet at runtime. On normal connections it starts early enough that users rarely see the pre-workspace geometry, but under low-data conditions a first modal open can race stylesheet arrival and produce a layout snap.

Do not solve this by adding another stylesheet to the middleware stack. During the next-phase cull, absorb this workspace contract into the canonical modal stylesheet and remove the dynamic loader, ideally reducing total active style owners.

## 6.8 Branding observer can react to high-frequency DOM updates

`gate-branding-controller.js` uses a broad MutationObserver to normalize legacy branding/text. Because timer and status text can change frequently, the observer remains in the mutation stream even when most changes do not require branding correction.

This is compatibility debt rather than a data bug.

**Next-phase target:** source-own the final GATE wording and remove post-render branding mutation.

## 6.9 Error-sound observer is broad

The operational sound system embedded in `prc-dash-dorm-reopen.js` observes the document body for visible error text/class/style changes so it can play error sounds.

It is defensive, but the file has become multi-purpose:

- closed-dorm reopen compatibility;
- operational sound assets/functions;
- global error observation.

This violates the desired cohesive-module direction.

**Next-phase target:** move sound ownership to one sound module; retain event semantics while removing DOM-wide error inference where explicit application error events are available.

## 6.10 Space Force compatibility layer is also multi-purpose

`prc-dash-space-force.js` currently owns more than Space Force compatibility:

- global `allData` bridge;
- injected Space Force fields/columns;
- dynamic Active Bus CSS;
- dorm final-time normalization/validation.

Do not delete it during beta; the responsibilities are operationally entangled. It should be decomposed only as the replacement routes/source fields become canonical.

## 6.11 Render-stability layer intentionally suppresses animation

`gate-render-stability-fix.js` uses GPU containment and disables some animations/transitions on Processing/Squadron surfaces to stop flicker.

This conflicts aesthetically with the desired future spring/liquid-glass micro-interactions, but it is the correct beta tradeoff while duplicate render ownership still exists.

**Do not add spring/jiggle effects broadly yet.** Retire duplicate render writers first, then add tactile motion to isolated controls with reduced-motion support and no layout-changing transform on operational cards.

---

# 7. Page-by-page final-beta posture

## Status Board

**Current posture:** stable enough for beta, but carries the most migration compatibility.

Strengths:

- canonical controller owns visible dorm columns and Active Bus surface;
- signature checks avoid unnecessary replacement of unchanged surfaces;
- direct-surface MutationObserver is narrow rather than observing the whole board subtree;
- timer loop can recover on focus/visibility/fullscreen transitions;
- bus dispatch rendering is no longer gated by auxiliary sound persistence.

Risks/debt:

- full records poll every 3 seconds;
- Build 2 hidden shadow observer remains intentionally active;
- middleware still rewrites Status Board source/metric compatibility;
- multiple stylesheets contain Status selectors;
- retained compatibility globals remain.

Audit action: duplicate timer DOM owner removed from this route.

## Airport

**Current posture:** operational, with two separate data domains.

- Bus records use the normal global D1/Data SDK path.
- SAT arrivals use `/api/sat-arrivals` and a separate edge-cached provider path.
- Remote bus updates remain bounded by 3-second record polling.
- Same-device bus create immediately refreshes visual surfaces after authoritative persistence.

Risks/debt:

- SAT board timer runs app-wide rather than only while Airport is active;
- provider failure after cache expiry has no stale fallback;
- some compatibility code for old Status header remains in the same file.

Audit action: inactive legacy Status header no longer requests its CSS.

## Input

**Current posture:** functionally careful but network-expensive.

Strengths:

- robust preflight checks for Week Group, receiving windows, duplicate dorm identity, incompatible Band/Space Force flags, existing live records, load 1–100, and record limit;
- initialization reports partial success rather than claiming all records were created.

Risks/debt:

- sequential mutation + authoritative refresh per dorm;
- 25 dorms imply at least 52 records API requests during initialization;
- Input grid refreshes on broad lifecycle/data hooks, including while page is hidden;
- no transactional server-side initialization.

Audit action: none; persistence/state guardrail retained.

## Processing

**Current posture:** primary operational mutation route, with good persistence confirmation but several compatibility layers.

Strengths:

- one canonical Processing controller owns cards and primary modal workflow;
- mutations use Data SDK and therefore authoritative server refresh;
- recent modal containment/tablet scroll fixes are scoped;
- closed-timer and reopen server semantics are protected;
- visible Space Force/female presentation now derives from canonical class state.

Risks/debt:

- full grid rebuild on multiple lifecycle hooks rather than signature/diff rendering;
- broad modal MutationObserver in the mobile-validation compatibility layer;
- multiple Escape handlers exist across canonical and safety layers;
- dynamic modal workspace stylesheet can cause low-data layout snap;
- sound-event persistence can extend completion time for open/close workflows.

Audit action: canonical multi-designation classes; shared timer writer removed from Processing.

## Archives

**Current posture:** semantically safe, high round-trip cost.

Strengths:

- archive is persisted before live clear;
- archive is directly verified before destructive deletion starts;
- closeout has operator messages and failure handling.

Risks/debt:

- no server transaction/batch primitive;
- sequential deletes each cause another full GET;
- a network interruption during delete phase can produce partial live cleanup;
- retained archives increase every instructor records payload over time.

Audit action: none; destructive workflow frozen during final beta.

## Squadron Board

**Current posture:** relatively narrow, sanitized read route.

Strengths:

- server sanitizes Squadron-visible records;
- signature-based rendering avoids some unnecessary DOM replacement;
- page is isolated by role routing.

Risks/debt:

- still consumes legacy global store/lifecycle infrastructure;
- timer presentation previously shared ownership with other routes.

Audit action: shared timer controller remains the Squadron timer painter, now without touching Status/Processing timer DOM.

---

# 8. UI design-system modernization posture

The desired Modern Industrial Glass / iOS-style direction is compatible with GATE, but the order of operations matters.

## Safe now

- consolidate existing token usage where it does not alter layout ownership;
- remove unused compatibility CSS requests;
- make visual state canonical at first render instead of repairing it after paint;
- keep modal/shell z-index in explicit bands;
- maintain strong light/dark parity;
- preserve GPU containment for known flicker surfaces.

## Defer until route ownership is singular

- new spring/jiggle card animations;
- broad backdrop-filter additions across large scrolling surfaces;
- removal of stability guards;
- global spacing rewrites across all pages;
- markup wrapper removal where legacy selectors/controllers still depend on structure;
- route-level CSS rewrites before the middleware source transforms are retired.

A premium visual layer should be added **after** page render ownership is reduced, otherwise motion will make underlying duplicate renders more visible rather than less.

---

# 9. Priority risk register

| Priority | Finding | Operational effect | Final-beta action |
|---|---|---|---|
| P1 | Initial records GET failure prevents normal poll installation | App can remain on empty snapshot after network recovers | Document; fix in next-phase startup state machine |
| P1 | Client does not use server `If-Match` versions | Multi-device last-write-wins conflict risk | Document; coordinated next-phase conflict UX |
| P1 | Server write role is broader than UI action matrix | Authenticated role can attempt mutations not exposed in UI | Document; enforce field/action policy server-side next phase |
| P1 | Full-table 3-second polling | Growing bandwidth/CPU cost; weak-network sensitivity | Document; filtered/delta/push architecture next phase |
| P1 | Sequential initialization / closeout | High request count and partial-workflow risk under degradation | Preserve beta; replace with idempotent transactional server workflows |
| P2 | Runtime compatibility ownership is large | Flashing, duplicate renders, hard-to-reason cascade | Begin net-negative cull; do not add patch layers |
| P2 | Third-party CDN critical front-end assets | FOUC/offline/filtered-network dependency | Compile/self-host next phase |
| P2 | Raw server exception messages in API responses | Internal telemetry disclosure | Opaque error IDs next phase |
| P2 | D1 binding not declared in repo config | Deployment reproducibility risk | Document binding contract next phase |
| P2 | No repo-declared HSTS policy | Security posture not reproducible from source | Verify Cloudflare zone and codify policy |
| P2 | Dynamic modal CSS | First-use layout snap on constrained network | Absorb into canonical modal CSS during net-negative cull |
| P3 | Broad branding/error MutationObservers | Extra DOM work; post-render correction model | Remove as source becomes canonical |
| P3 | Multiple historical z-index declarations | Cascade fragility despite correct final owner | Consolidate tokens after visual regression coverage |

---

# 10. Changes made by this audit branch

These changes are intentionally outside record persistence and state machinery.

## A. Remove duplicate timer DOM ownership

`public/js/prc-dash-overtime-audit.js`

- timer text/class painting is scoped to Squadron Board;
- timer CSS injection is scoped to Squadron Board;
- overtime eligibility logic remains intact;
- overtime sound-event logic remains intact;
- existing interval/state/event-hook machinery remains intact;
- Status Board and Processing keep their canonical timer owners.

## B. Emit Processing designation classes canonically

`public/js/gate-processing-controller.js`

- Female, Space Force, and Band presentation classes are composed on initial canonical card render;
- Space Force still excludes Band according to the existing flag contract;
- Female can coexist visually with Space Force/Band;
- no dorm field, mapping, persistence call, or event listener changed.

## C. Avoid obsolete legacy Status-header stylesheet request

`public/js/prc-dash-sat-arrivals.js`

- the compatibility stylesheet is requested only after the legacy Status header elements are confirmed present;
- SAT arrivals behavior is unchanged;
- legacy fallback remains available;
- canonical Status Board avoids an unnecessary CSS network/cascade owner.

## D. Regression coverage

`tests/runtime/record-display-integrity.test.mjs`

Added contracts for:

- canonical combined Processing designation classes;
- Squadron-only shared timer painting;
- preservation of overtime/sound processing;
- legacy Status-header stylesheet load ordering.

---

# 11. Recommended next-phase cull sequence

The safest migration sequence is net-negative and ownership-first:

1. **Freeze the current beta persistence contract.** Do not mix records API behavior changes with UI retirement.
2. **Instrument before optimizing.** Capture payload bytes, route activation-to-stable-paint, records round-trip time, long tasks, and remote-change propagation.
3. **Introduce an explicit bootstrap connection state.** Never display a failed initial records load as a legitimate empty dataset; add bounded reconnect and stale state.
4. **Make write authorization server-specific.** Add role + record type + action + field allowlists.
5. **Activate record-version conflict handling.** Use the server capability that already exists.
6. **Replace full-table polling.** At minimum, split active operational data from retained archive/history; ideally move to delta/event synchronization appropriate for Cloudflare architecture.
7. **Make initialization and closeout server-owned/idempotent.** Avoid dozens of client-orchestrated serial round trips.
8. **Complete Status Board strangler retirement.** Follow `docs/build-2/STATUS_BOARD_RETIREMENT_MANIFEST.md`; eliminate middleware Status rewrites and hidden shadow after acceptance.
9. **Retire DOM repair observers.** Move Space Force, branding, modal, and error state to source-owned components/events.
10. **Reduce active CSS/JS below the recorded Phase 3B exit targets.** Do not replace retired patches with new patches.
11. **Consolidate z-index and spacing tokens.** One design-system source for shell, popovers, modals, controls, and responsive spacing.
12. **Then add premium interaction physics.** Use transform/opacity-only micro-interactions, isolate them to controls, support `prefers-reduced-motion`, and never animate operational data card geometry.

---

# 12. Release decision for current beta

## Safe to continue weekly beta after regression gates

The core records path has no evidence in this audit of random persistence loss. The most important recent persistence-sensitive areas—bus creation ordering, closed-timer retention, authoritative post-mutation refresh, archive-before-clear ordering, and server-generated record identity—remain intact.

The audit branch intentionally changes no:

- Function/API route;
- D1 query;
- fetch structure;
- Data SDK mutation/refresh behavior;
- record mapping;
- database retention rule;
- authorization/session contract;
- client state variable;
- event listener registration/removal.

## Do not declare next-phase production-ready yet

The next phase should not be considered production-complete until the following are explicitly closed:

- startup reconnect/stale-state behavior;
- server action-level authorization;
- record-version conflict UX;
- active-data synchronization strategy;
- transactional/idempotent initialization and closeout;
- external CDN dependency reduction;
- opaque API telemetry;
- middleware Status source rewrite retirement;
- net-negative active runtime ownership;
- representative tablet/desktop/mobile browser performance and offline/stale validation.

---

## Final architectural verdict

**Data integrity posture:** good beta foundation, with known concurrency and transactional limitations.  
**Synchronization posture:** functional near-live polling, inefficient as history grows.  
**Offline posture:** insufficient for operational offline startup; stale in-memory continuity only after successful initialization.  
**UI ownership posture:** improved but still compatibility-heavy; duplicate writers are a larger current source of visual instability than the database.  
**Security posture:** authenticated and parameterized, but server write authorization/input validation needs finer Zero Trust enforcement.  
**Next-phase strategy:** retire ownership before adding effects; move persistence evolution behind explicit server contracts; keep every migration net-negative in runtime layers.
