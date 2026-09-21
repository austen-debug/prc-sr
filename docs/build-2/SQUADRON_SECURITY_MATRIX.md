# Squadron direct-request matrix

| Request | Squadron result |
|---|---|
| `GET /squadron/` | Authorized isolated board |
| `GET /`, `GET /index.html` | Redirect to Squadron board (never serve operational HTML) |
| `GET /api/session` | Only verified session role / username |
| `POST /api/logout` | Invalidate session cookie |
| `GET /api/squadron-board` | Restricted allowlisted aggregates |
| All other `/api/*` methods and paths | 403, including direct GET `/api/records` and mutation attempts |
| Non-Squadron `GET /squadron/` | Redirect to operational home |

For any HTML document, prevent caching of personalized output, never send unauthorized operational source in the initial response, and avoid exposing raw record JSON through browser scripts. Fail closed if session signing cannot use a configured `AUTH_SECRET`.
