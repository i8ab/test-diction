# Security Notes — Bacaloria Community

## Current model (intentional, no JWT)

- **Authentication**: Username + password. Passwords are hashed client-side with SHA-256 (`salt::password`) before being stored in the cloud record. The server never sees plaintext passwords for the classic flow.
- **Social sign-in**: Optional Google verification happens server-side in `api/auth.js` (token audience / app-secret checks).
- **No server-side session tokens / JWT**: This is intentional. Identity on the cloud is the account `code` plus role flags stored in the accounts record. The client keeps the personal code in local storage / vault after login.
- **Authorization**: Role field (`user` | `admin` | teacher flags). Admin-only UI is gated on the client; `accountPatch` on the server strips `role`, `isAdmin`, and `status` so clients cannot elevate privileges via that scope.
- **Data access**: All cloud reads/writes go through `/api/jsonbin` (Supabase proxy). Service-role key stays on the server.
- **Write locking**: Redis distributed lock reduces concurrent overwrite races.
- **Rate limiting**: Upstash sliding window on auth and write endpoints (see below).

## Done

- **Rate limiting** (`lib/rateLimit.js`):
  - `/api/auth` → 20 requests / minute / IP
  - `/api/jsonbin` PUT → 60 requests / minute / IP
  - Fail-open when Redis env vars are missing (local development).
- **accountPatch privilege lock**: server strips `role`, `isAdmin`, and `status` from client patches.
- **Partial cloud paths**: scoped fetches/saves; auth uses `fetchAccountsBundle` instead of full `fetchRecord`.
- **JWT / `/api/session` removed**: design abandoned; no `SESSION_SECRET`, no Bearer user tokens, no session issuance.

## Still open (priority order)

1. **Ownership checks** on every write path in `api/jsonbin.js` (user may only mutate their own account unless admin/teacher — verified server-side from the stored account record, not from client claims).
2. **Password hashing**: SHA-256 is not a modern KDF; optional future upgrade to Argon2/scrypt with re-hash on next login.
3. **CSP + stricter CORS** for a fixed production origin.

## Explicitly not planned

- Short-lived JWT after password verification.
- Requiring a session token for privileged API scopes.
- Re-adding `api/session`, `lib/sessionToken.js`, or `src/lib/state/sessionAuth.js`.

## Env notes

Do **not** set `SESSION_SECRET`. User auth does not use it. Keep existing `SUPABASE_*`, `UPSTASH_*`, `VAPID_*`, `CRON_SECRET`, `GOOGLE_CLIENT_ID` as needed.
