# Security Notes — Bacaloria Community

## Current model (intentional, no JWT)

- **Authentication**: Username + password. Passwords are hashed client-side with SHA-256 (`salt::password`) before being stored in the cloud record. The server never sees plaintext passwords for the classic flow.
- **Social sign-in**: Optional Google verification happens server-side in `api/auth.js`.
- **No server-side session tokens / JWT**: Intentional. Identity is the account `code` plus role flags stored in Supabase.
- **Write authorization**: Every PUT sends `actorCode` (from client `loadPersonalCode`). The server loads that account from the DB and uses **stored** `role` / `status` only — never `body.role`.
- **Data access**: All cloud reads/writes go through `/api/jsonbin`. Service-role key stays on the server.
- **Write locking**: Redis distributed lock.
- **Rate limiting**: Upstash sliding window on auth and write endpoints.

## Write rules (`lib/jsonbinAuthz.js`)

| Scope | Who |
|-------|-----|
| `accountStatus`, `accountDelete` | admin or teacher (active) |
| `settingsPatch`, `logsReplace` | admin or teacher |
| `accountPatch` | own account **or** staff |
| `entryPatch`, `entryDelete` | any active signed-in actor |
| `accounts` bulk with approve/remove | staff |
| `accounts` bulk without approve/remove | public/signup allowed; server sanitizes (new rows → `role=user`, `status=pending`; existing rows lock role/status) |
| Full/legacy `saveRecord` | staff only |

Denied writes return `403 { ok:false, error:"forbidden", message }`.

## Done

- Rate limiting, accountPatch privilege strip, partial cloud paths.
- JWT removed.
- **Server-side ownership checks via actorCode** (this pass).
- Indexes SQL: `docs/SUPABASE_INDEXES.sql` (apply in Supabase if not already).

## Still open

1. Optional Argon2/scrypt password hashing with re-hash on login.
2. CSP + stricter CORS for production origin.
3. Further Phase D split of `api/jsonbin.js` (authz already extracted to `lib/jsonbinAuthz.js`).

## Env

Do **not** set `SESSION_SECRET`. Keep `SUPABASE_*`, `UPSTASH_*`, `VAPID_*`, `CRON_SECRET`, `GOOGLE_CLIENT_ID`.

## HTTP hardening (`lib/jsonbinHttp.js`)

- Security headers: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `X-Request-Id`
- Optional CORS via `ALLOWED_ORIGINS`
- PUT body size guard (~1.5MB)
- `actorCode` shape validation
- Rate-limit response headers on limited routes
