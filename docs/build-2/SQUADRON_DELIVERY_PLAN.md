# GATE Packages 04–05 — Squadron release gate

## Security boundary

- Require configured `AUTH_SECRET`, `SQUADRON_USERNAME`, and `SQUADRON_PASSWORD` for login. Do not use a session signing fallback; reject unknown roles and expired/invalid session tokens.
- Direct Squadron sessions to `/squadron/`, an independent read-only document. Never serve `/` or the operational application HTML/JS to Squadron sessions.
- Middleware must deny Squadron requests to every API except GET `/api/session`, GET `/api/squadron-board`, and POST `/api/logout`, even when a path is entered directly; deny any mutation on the board endpoint. Avoid trusting browser role state.
- Construct board JSON using a positive allowlist, sourced from the single current configured active week group. No complete raw records or internal notes, assignments, auditorium locations, archive/config objects, or mutable metadata.
- Confirm a valid production `AUTH_SECRET` is configured; replacing the old fallback invalidates sessions signed with that fallback and users must sign in again.

## Board contract and accuracy

- ARRIVED means airport buses marked arrived, summed using trainee counts; local arrivals are excluded. EXPECTED is the sum of active-week dorm maximum loads. Do not mistake an absence of data or a failed refresh for an actual zero.
- Tempo is distinct airport buses dispatched in the rolling 60 minutes using valid `departed_at`: 0–1 SLOW, 2 MEDIUM, 3+ HEAVY. Count arrived buses too. Invalid or absent timestamps never count as recently dispatched.
- Active bus strip shows only airport buses that remain en route, with approved identifiers, counts and times. Three dorm columns are Empty, Open and Closed and use approved dorm metadata only.
- Provide accessible info buttons with descriptive labels, focus/hover/touch support, no hover-only critical information, and mobile stacking without horizontal page overflow. Preserve unchanged DOM between successful polls and show a stale/unavailable state if refresh fails.

## Verification and deployment

- Test login and all verification paths, missing-secret failure, invalid tokens and unsupported roles, routing to the dedicated page, direct request denial for all other APIs, data allowlisting, metric arithmetic, tempo boundaries, and responsive presentation.
- Require complete CI on the final PR commit. Merging these files is separate from deployment verification and D1 persistence enablement. Avoid claiming real-viewport or live-Cloudflare tests from source-only checks.
