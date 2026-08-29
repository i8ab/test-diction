# API Performance Optimizations (applied)

## What changed

### Server (`api/jsonbin.js` + `lib/redis.js`)

1. **Minimal 409 conflict payloads** (`buildConflictPayload`)
   - Partial scopes no longer call `loadRecord()` (full entries + logs).
   - Account scopes return only `{ version, accounts }`.
   - Entry/settings/logs scopes return only `{ version }`.
   - Full legacy path still returns the complete record.

2. **New fast write scopes**
   - `accountStatus` — change one account status (approve / block).
   - `accountDelete` — delete one account (reject / remove).
   - Both skip loading/rewriting the full accounts list.

3. **Redis hot cache** (no-op if Upstash env missing)
   - Keys: `tt:version`, `tt:bootstrap`, `tt:accounts`
   - Invalidated on every successful version bump / full save / settingsPatch.

4. **Entries cursor pagination**
   - `GET ?scope=entries&limit=40&after=<id>&section=en-ar`
   - Response: `{ entries, nextCursor, hasMore }`
   - Without `limit` → same full-list behavior as before (backward compatible).

5. **Better Cache-Control** for `bootstrap` and `version`.

### Client (`cloudApi.js` + `adminLifecycle.js`)

- `setAccountStatus(code, status, expectedVersion)`
- `deleteAccount(code, expectedVersion)` (API helper)
- `fetchEntriesOnly` supports optional `{ limit, after }` for pagination
- Approve / reject / admin delete use the fast single-account paths when only one code is involved; fall back to `saveAccountsOnly` for sticky multi-code batches.

## Expected impact

| Flow | Effect |
|------|--------|
| Approve account | Much faster (single row update) |
| Reject / delete account | Much faster (single row delete) |
| Any small patch + 409 | No more full dictionary download |
| Polling version / bootstrap | Redis + short browser cache |
| Large dictionary reads | Optional pagination |

## Compatibility

- Existing callers of `fetchEntriesOnly()` without `limit` still get an array.
- Existing `scope: "accounts"` / `accountPatch` / full PUT still work.
- No env vars required beyond existing Redis (optional for extra speed).

## Round 2 (Vercel-safe — no extra API files)

- **UPSERT accounts** via `on_conflict=code` (fallback to delete+insert)
- **Batch upsert** for changed accounts only
- **ETag + 304** on `scope=version` and `scope=bootstrap`
- Client `fetchVersionOnly` sends `If-None-Match`
- SQL indexes: `docs/SUPABASE_INDEXES.sql` (run in Supabase)

Still one main function: `/api/jsonbin` (plus existing push/auth/tts). No new serverless routes.

## Round 3 — Bandwidth + list/detail split

### Server
- `fields=light` on `scope=entries` → strips heavy text (notes/long examples)
- `scope=entry&id=` → one full entry for detail/edit
- `X-Deprecated-Scope: full` + Warning header on full GET
- ETag on `scope=accounts`

### Client
- `fetchEntriesOnly({ fields: "light" })`
- `fetchEntryById(id)`
- `fetchRecord` warns in console (discourage accidental full pulls)

### Logs
- Account approve/reject/delete fast paths already do **not** write logs on the server; use `saveLogsOnly` / `scope=logs` only when the activity UI needs it.

### Expected impact
- List of 500 words: often **50–70% smaller** JSON with `fields=light`
- Opening one word: one tiny request instead of re-downloading the list
- Accidental full fetches: visible Warning header + client console warn
