-- Run once in Supabase SQL Editor to speed up Bacaloria API queries.
-- Safe to re-run (IF NOT EXISTS).

-- 1) Unique account code → enables real UPSERT (1 round-trip instead of DELETE+INSERT)
CREATE UNIQUE INDEX IF NOT EXISTS accounts_code_uidx ON public.accounts (code);

-- 2) Faster single-account lookup
-- (covered by unique index above)

-- 3) Entries by section (scoped dictionary loads)
CREATE INDEX IF NOT EXISTS entries_section_idx
  ON public.entries ((data->>'section'));

-- 4) Entries cursor pagination by id
CREATE INDEX IF NOT EXISTS entries_id_idx
  ON public.entries ((data->>'id'));

-- 5) Logs ordered by time (already limited to 500 newest)
CREATE INDEX IF NOT EXISTS logs_at_desc_idx ON public.logs (at DESC);

-- 6) Settings primary key is already `key` — no action needed
