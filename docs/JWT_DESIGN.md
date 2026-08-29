# JWT Session Design — ABANDONED

**Status: intentionally not used.**

Server-side session tokens / JWT were explored and then removed from the project.
Do not re-add `api/session`, `lib/sessionToken.js`, or `src/lib/state/sessionAuth.js`
unless product requirements change.

Auth model is documented in `SECURITY.md`:
username + password (client SHA-256 hash), optional Google verification via `api/auth.js`,
account `code` + role stored in Supabase, rate limits + privilege lock on `accountPatch`.

Next hardening step (if needed): ownership checks on write scopes inside `api/jsonbin.js`.
