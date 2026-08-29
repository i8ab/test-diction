# Bacaloria Cloud API — `/api/jsonbin`

Single Vercel serverless function. Backend: Supabase. Auth model: **no JWT**.
Writes send `actorCode` (personal code); the server loads the account from DB and uses **stored** `role` / `status`.

## Common

| Item | Detail |
|------|--------|
| Methods | `GET`, `PUT`, `OPTIONS` |
| Optimistic lock | Every `PUT` requires `expectedVersion` (number) |
| Conflict | `409` `{ ok:false, error:"conflict", version, … }` |
| Forbidden | `403` `{ ok:false, error:"forbidden", message }` |
| Rate limit | `429` + `Retry-After` + `X-RateLimit-*` |
| Request id | Echoed as `X-Request-Id` and often in JSON `requestId` |
| Max body | ~1.5MB JSON (avatar data-URLs) |

### Headers (response)

- `X-Request-Id`
- `X-Content-Type-Options: nosniff`
- `X-RateLimit-Limit` / `X-RateLimit-Remaining` (when limited)
- `ETag` on `version`, `bootstrap`, `accounts`

### CORS

Set `ALLOWED_ORIGINS` (comma-separated) in Vercel for production.  
If unset, origin is reflected (local/dev friendly).

---

## GET scopes (`?scope=`)

| scope | Query | Response |
|-------|-------|----------|
| `version` | — | `{ version }` + ETag / 304 |
| `bootstrap` | — | banner, exam, academicUnits, version |
| `account` | `code=` | `{ account }` full row |
| `accounts` | `fields=light\|full` | `{ accounts, fields }` |
| `entries` | `section`, `limit`, `after`, `fields=light` | list or `{ entries, nextCursor, hasMore }` |
| `entry` | `id=` | `{ entry }` full word |
| `logs` | — | `{ logs }` |
| `settings` | `keys=` | selected keys |
| `full` | — | entire record (rate-limited, discouraged) |

---

## PUT scopes (`body.scope`)

Always include: `expectedVersion`, and `actorCode` when signed in.

| scope | Who | Body highlights |
|-------|-----|-----------------|
| `accountStatus` | staff | `code`, `status` |
| `accountDelete` | staff | `code` |
| `accountPatch` | self or staff | `code`, `patch` (role/status stripped) |
| `entryPatch` | active user | `entry` with `id` |
| `entryDelete` | active user | `id` |
| `settingsPatch` | staff | `key`, `value` |
| `logsReplace` | staff | `logs[]` |
| `accounts` | staff full; public signup sanitized | `accounts`, optional `removeAccountCodes` / `approveAccountCodes` |
| _(none / full)_ | staff only | full record legacy path |

Public `accounts` merge (signup): new rows forced to `role=user`, `status=pending`; existing rows cannot elevate role/status.

---

## Client helpers (`cloudApi.js`)

Prefer scoped helpers: `fetchBootstrap`, `fetchMyAccount`, `fetchEntriesOnly`, `patchAccountFields`, `setAccountStatus`, …  
Avoid `fetchRecord` / full PUT on normal paths.

---

## Env

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | Data store |
| `UPSTASH_REDIS_REST_URL` + `TOKEN` | Locks, cache, rate limit |
| `ALLOWED_ORIGINS` | Production CORS (optional) |

Do **not** set `SESSION_SECRET` (JWT removed).
