# Bacaloria Community

Bilingual vocabulary dictionary + integrated study tools (Arabic ⇄ English).  
UI languages: **English** and **Arabic** (RTL supported).

Progressive Web App (PWA) with offline support, cloud sync, spaced repetition (SRS), XP & achievements, study timer, calendar, todos, and push notifications.

**Current version: 1.1.3**

---

## Local development

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build → dist/
npm run preview  # preview production build
npm test         # unit tests (Vitest)
npm run test:watch
```

### Deploy on Vercel

Push the repo as-is. Vercel detects Vite and turns `api/*.js` into serverless functions.

**Environment variables:**

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_ANON_KEY`) | Primary data store |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | Write locks, push subscriptions |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web Push |
| `CRON_SECRET` | Protect scheduled reminder endpoint |
| `GOOGLE_CLIENT_ID` / `FACEBOOK_APP_ID` + `FACEBOOK_APP_SECRET` | Optional social login |

---

## Project structure

```
├── api/                    # Vercel serverless functions
│   ├── jsonbin.js          # Supabase proxy (entries, accounts, settings)
│   ├── cambridge-audio.js  # Pronunciation audio proxy
│   ├── tts.js
│   ├── push*.js            # Web Push + reminders
│   └── auth.js             # Social token verification
├── public/
│   ├── sw.js               # Service worker (network-first shell)
│   ├── manifest.json
│   └── icons/ + backgrounds/
├── src/
│   ├── App.jsx             # Root orchestration (still large — see docs/REFACTOR_PLAN.md)
│   ├── components/         # UI (MainView, modals, timer, todo, calendar, …)
│   └── lib/
│       ├── config/         # i18n, theme, sections
│       ├── state/          # XP, achievements, cloud queue, vault, …
│       ├── hooks/
│       └── utils/          # SRS, speech, authUtils, quizHelpers, …
├── tests/                  # Vitest unit tests
├── docs/REFACTOR_PLAN.md   # Incremental plan for large files
├── SECURITY.md             # Auth model + hardening roadmap
├── vitest.config.js
└── vercel.json
```

---

## Main features

### Dictionary & study
- Fast search, manual add, auto definitions (dictionaryapi.dev)
- Simplified SM-2 spaced repetition
- Quizzes, flashcards, dictation, quick/weakness review, cloze, sentence practice
- TTS + Cambridge audio; optional on-device Whisper (lazy-loaded via `@huggingface/transformers`)
- Academic units, word lists, notes, priorities

### Motivation & progress
- XP with daily caps, levels, badges, frames, streaks
- Goals, challenges, leaderboard, weekly report

### Productivity
- Study timer (countdown / clock, floating bubble, PiP where supported, Screen Wake Lock)
- Study calendar + floating widget
- **Todo list** — localStorage only (per device / account code)
- Exam mode + admin settings

### Technical
- Full PWA (manifest + service worker)
- Offline-first with smart caching
- Cloud sync with optimistic locking and conflict handling
- RTL + theming + background images

---

## Changes in 1.1.3 (this pass)

| Issue | What was done |
|-------|----------------|
| **Duplicate files** | Removed leftover root `/components/modals/` (duplicates of `src/components/modals/`). |
| **Todos** | Kept **localStorage only** (per device / account code) — no cloud sync, as requested. |
| **i18n dead code** | Cleaned `tr()` — removed unused German/French parameters. Only `en` / `ar` are supported. Boolean `isAr` call sites remain compatible. |
| **Testing** | Added Vitest + unit tests for `authUtils`, `quizHelpers`, and `xp` (`tests/`). Run with `npm test` after `npm install`. |
| **Service worker** | Bumped cache version to `bacaloria-v1.1.3`. Documented a path to build-time automated versioning. |
| **Documentation** | New `SECURITY.md`, `docs/REFACTOR_PLAN.md`, updated this README. Version bumped to 1.1.3. |
| **Security** | Documented current model and a concrete hardening roadmap. No breaking auth rewrite (would invalidate existing accounts). |
| **Large files / sync complexity** | Full extraction of 2500-line files and redesign of the offline queue were **not** performed in this pass (high risk of regressions). A safe incremental plan is in `docs/REFACTOR_PLAN.md`. |

### Explicitly deferred (honest)

1. **Full modularization** of `App.jsx`, `MainView.jsx`, `index.css`, `api/jsonbin.js` — follow the phased plan.
2. **Production-grade auth** (JWT/sessions, rate limiting, Argon2, fully server-side authorization) — see `SECURITY.md`.
3. **Complete German/French UI** — would require translating hundreds of strings; not started.
4. **Automated SW version injection** at build time.
5. **Browser-compat polyfills / graceful degradation matrix** for PiP and Screen Wake Lock (feature detection already exists in the timer code; broader QA is manual).
6. **Deep simplification** of the multi-layer offline cache + queue (works; further simplification needs careful staging).

---

## Architecture notes (still valid)

- Prefer scoped fetches (`fetchMyAccount`, `fetchEntriesOnly`, …) over full-record loads.
- Partial saves + cloud queue are the primary write path.
- Mobile-first: test ≤ 768 px before considering a feature done.
- See `src/lib/ARCHITECTURE_ISOLATION.md` for data-fetch rules.

---

## Contributing / next steps

1. Run `npm test` and fix any failures after dependency install.
3. Execute Phase A of `docs/REFACTOR_PLAN.md` (extract more logic from `App.jsx`).
4. Implement the first two items of the security roadmap if the community grows beyond a trusted group.

If `npm run build` fails, send the full error output.


## Changes in this build (feature pass)

| Feature | What was done |
|---------|----------------|
| **Quiz customization** | Setup screen lets you choose **Studied / Not studied / Both**, and optionally **pick specific words** from a searchable list. |
| **Todo default date** | New tasks default the date field to **today**. |
| **Todo categories** | Create, edit, delete custom category tags and assign them to tasks; filter by category. |
| **Baccalaureate Curriculum** | The former **Academic** section is renamed everywhere in the UI. |
| **Day achievements + SRS** | New tool under Tools: log daily achievements, opt into spaced repetition, review when due, toggle notifications. Mastery-focused intervals (repeated success required to advance). |
| **Mastery focus** | SRS level promotion requires consecutive correct answers / higher accuracy thresholds. |

