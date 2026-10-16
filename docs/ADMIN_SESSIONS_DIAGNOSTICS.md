# GATE Admin — Sessions & System Issues

## Browser-only operations
The Admin workspace gains two independently useful sections:

- **Live Sessions & Devices** lists unexpired, server-registered sessions; device and
  browser are approximate User-Agent classifications, not an attested device identity.
  Last activity is the last authenticated request (updated at most once per minute).
  Recently active means within five minutes, not an open network connection.
  An Admin can revoke a selected session by exact ID with a reason and a fresh login.
  Revocation is checked on every subsequent authenticated request. It does not prevent
  a person with valid shared credentials from signing in again.
- **System Issues & Debugging** shows live D1 and record/mirror integrity checks plus
  safely classified observed API errors, client runtime errors, and connectivity
  failures. Inspect an entry in a read-only modal with route, status, category,
  timestamp, and recommended investigation. Logged events are not automatically
  considered still open. Credentials, IP addresses, request bodies, and browser stack
  traces are not stored.

## Installation / compatibility
- `migrations/0008_gate_live_session_registry.sql` creates an additive session
  registry and append-only sign-in / revocation events, independently of `0007`.
  Before installation, legacy signed cookies continue functioning but cannot be
  enumerated or individually revoked. After installation, *new* sign-ins are tracked;
  earlier cookies expire within 12 hours (30 minutes for Admin).
- `migrations/0009_gate_diagnostic_events.sql` creates the optional diagnostic log.
  Until installed, the Admin issues page still performs live health checks, but
  stored incident history cannot be displayed.
- Neither migration modifies receiving `records`, Week Group lifecycle, archives,
  existing audit events or Squadron publications.
- Session revocation and client telemetry do not depend on
  `GATE_ADMIN_WRITES_ENABLED`, which remains disabled for archive and other
  operational Admin changes until the separate Admin provenance migration is safe.
- The application does not apply migrations by itself. Deploy source only with the
  understanding that these UI sections will say "not installed" until D1 receives
  their corresponding additive migrations.
- Shared-role credentials cannot distinguish people who use the same role; devices
  and roles are therefore not claims of unique personal identity.
