# Bacaloria — next development roadmap

## Done (API / backend)
- Scoped cloud API, ownership, no JWT
- Phase D module split (`jsonbin*`)
- Profile fields survive refresh (bac / Google link)
- HTTP hardening, CORS, rate-limit headers, health scope
- Shared bootstrap on auth / tts / cambridge / push
- Audit logs (stdout) for accountStatus / accountDelete
- Supabase indexes applied

## Next (recommended order)

### 1) Client maintainability
- Finish extracting auth stages from `App.jsx`
- Shrink `MainView.jsx` into panel components
- Split `index.css`

### 2) UX polish
- Mobile pass ≤768px on login, dictionary, admin
- Surface API `403` / `409` / `429` messages in toasts
- Bump service worker cache version on each release

### 3) Optional deeper security
- Argon2 password hashing (migration on login)
- Stricter CSP once third-party scripts are inventoried

### 4) Product features
- Only after (1) is stable; always use scoped cloud writes

## Ops
- Health: `GET /api/jsonbin?scope=health`
- Set `ALLOWED_ORIGINS` in Vercel for production
- Watch Vercel logs for `bacaloria_audit` JSON lines
