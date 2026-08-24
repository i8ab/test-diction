# Refactor Plan — Large Files & Architectural Debt

Status as of post–Phase A extraction.

## Current sizes (approx.)

| File | Lines | Notes |
|------|------:|-------|
| `src/App.jsx` | ~2141 | Was ~2549; boot extracted to `cloudBootstrap.js` |
| `src/lib/state/cloudBootstrap.js` | ~502 | **New** — `runAppBoot` |
| `src/components/MainView.jsx` | ~1461 | Phase B |
| `src/index.css` | ~2904 | Phase C |
| `api/jsonbin.js` | ~1300+ | Phase D |

## Done

- Phase A (partial): `runAppBoot` + `ensureMigratedAccounts` out of App.
- Partial-save enforcement: no app-level `fetchRecord`; `saveLogsOnly`; auth scoped fetches.
- Rate limit + accountPatch privilege lock + JWT design + `/api/session` scaffold.

## Remaining

### Phase A (finish)
1. Extract remaining auth-stage transitions still inline in App.
2. Target App.jsx &lt; 800 lines over multiple PRs.

### Phase B — MainView.jsx
Finish moving render branches into existing panel/overlay components.

### Phase C — index.css
Split tokens / layout / components.

### Phase D — api/jsonbin.js
Split banner helpers and CRUD handlers.

## Rules

- No new feature may increase App.jsx or MainView.jsx by more than ~50 net lines without extraction.
- Mobile ≤768px before merge.
