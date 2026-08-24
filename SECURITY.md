# Security Notes — Bacaloria Community

## Current model (v1.1.3+)

- **Authentication**: Username + password. Passwords are hashed client-side with SHA-256 (`salt::password`) before being stored in the cloud record. The server never sees plaintext passwords for the classic flow.
- **Social sign-in**: Optional Google / Facebook verification happens server-side in `api/auth.js` (token audience / app-secret checks).
- **Authorization**: Role field (`user` | `admin` | teacher flags). Admin-only operations are gated in the client; `accountPatch` can no longer elevate `role` / `isAdmin` / `status`.
- **Data access**: All cloud reads/writes go through `/api/jsonbin` (Supabase proxy). Service-role key stays on the server.
- **Write locking**: Redis distributed lock reduces concurrent overwrite races.
- **Rate limiting**: Upstash sliding window on auth and write endpoints (see below).

## Done in this hardening pass

- **Rate limiting** (`lib/rateLimit.js`):
  - `/api/auth` → 20 requests / minute / IP
  - `/api/jsonbin` PUT → 60 requests / minute / IP
  - Fail-open when Redis env vars are missing (local development).
- **accountPatch privilege lock**: server strips `role`, `isAdmin`, and `status` from client patches.
- **Partial cloud paths**: `logsReplace` scope; auth uses `fetchAccountsBundle` instead of full `fetchRecord`.

## Still open

1. **No server-side session tokens / JWT** — client still stores account / personal code.
2. **Password hashing** is SHA-256, not a modern KDF.
3. Full ownership checks on every write path (user may only mutate their own account unless admin).
4. CSP + stricter CORS for a fixed production origin.

## Remaining roadmap

1. Short-lived JWT after password verification.
2. Require session + role for every privileged API scope.
3. Upgrade to Argon2/scrypt and re-hash on next login.
4. Ownership audit on all write paths in `api/jsonbin.js`.
5. CSP headers and tighter CORS.
