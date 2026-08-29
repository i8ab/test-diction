# Refactor Plan — Large Files & Architectural Debt

## API Phase D — Done (this pass)

`api/jsonbin.js` split without changing the public `/api/jsonbin` contract:

| Module | Role |
|--------|------|
| `api/jsonbin.js` | HTTP handler only (~950 lines) — GET/PUT router |
| `lib/jsonbinMappers.js` | Pure mappers (banner, exam, light entry/account, logs) |
| `lib/jsonbinDb.js` | Supabase I/O, version, upsert, save full/entries |
| `lib/jsonbinAuthz.js` | Ownership rules (`actorCode`, staff vs public) |

## Still remaining (client)

### Phase A (finish)
1. Extract remaining auth-stage transitions still inline in App.
2. Target App.jsx < 800 lines over multiple PRs.

### Phase B — MainView.jsx
Finish moving render branches into panel/overlay components.

### Phase C — index.css
Split tokens / layout / components.

## Rules
- No new feature may increase App.jsx or MainView.jsx by more than ~50 net lines without extraction.
- Mobile ≤768px before merge.
- Do not reintroduce JWT/session scaffolding.
