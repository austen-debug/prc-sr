# Squadron release checklist

This package is implemented as a read-only, server-isolated Squadron view. A GitHub merge is not proof of live Cloudflare deployment or database activation.

1. Confirm `AUTH_SECRET`, `SQUADRON_USERNAME`, and `SQUADRON_PASSWORD` exist in the intended deployment environment. Never copy credential values into GitHub or frontend assets. The fail-closed secret correction invalidates historical fallback-signed sessions; affected users sign in again.
2. Run direct-request authorization tests for Squadron: `/`, `/index.html`, `/api/records`, `/api/persistence`, `/api/archive-delete`, and `/api/sat-arrivals` must not expose operational HTML or data. Allow only the dedicated board GET, session GET and logout POST; block write verbs.
3. Inspect the allowlisted board JSON for absence of notes, assigned personnel, auditorium assignments, complete raw record data and archival information. Confirm only one active Week Group supplies counts.
4. Verify actual browser layout on desktop, tablet, and phone. Validate keyboard-focus and touch access to tooltips, correct tempo thresholds, stale-data indicator, and no DOM rebuild on unchanged polls.
5. Verify production D1 trigger installation and source/mirror parity separately before enabling persistence. Do not confuse this Squadron release with persistence cutover.
