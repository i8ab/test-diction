# JWT Session Design (Bacaloria Community)

Status: **Phase A partially live** (issue + attach + soft verify on `accounts` scope).

## Why

A stolen personal code could impersonate the user. Rate limits and `accountPatch`
privilege locks help; short-lived signed sessions are the next layer.

## Token shape

```json
{
  "sub": "<accountCode>",
  "role": "user|teacher|admin",
  "sid": "<sessionId>",
  "iat": 1710000000,
  "exp": 1710043200
}
```

- **Algorithm**: HS256 (`SESSION_SECRET`, 16+ chars).
- **TTL**: 12 hours.
- **Helpers**: `lib/sessionToken.js` (server), `src/lib/state/sessionAuth.js` (client).

## Phase A (implemented)

| Piece | Behavior |
|-------|----------|
| `POST /api/session` | Issues token given `code` + `passwordHash` |
| After password login | Client calls `requestSessionToken` (best-effort) |
| Cloud writes | `Authorization: Bearer …` attached when token exists |
| `scope: accounts` | If Bearer present → must verify; privilege ops need admin/teacher role in claims |
| Missing Bearer | Still allowed (legacy) |
| Logout | Clears token |

## Phase B / C (next)

- B: Always obtain token after login; log legacy writes.
- C: Reject privileged writes without valid token.

## Env

```
SESSION_SECRET=<long random string>
```

Without `SESSION_SECRET`, `/api/session` returns 503 and clients keep using legacy code-only auth.
