-- Run once in the Supabase SQL editor before enabling feeling saves.
-- Nullable so existing stories and skipped choices need no backfill.
alter table public.stories add column if not exists feeling text;
alter table public.stories drop constraint if exists stories_feeling_check;
alter table public.stories add constraint stories_feeling_check check (
  feeling is null or feeling in ('Feeling replaced', 'Confused', 'Betrayed', 'Feeling left out', 'Hopeful', 'Just needed to vent')
);
