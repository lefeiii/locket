create extension if not exists "pgcrypto";

alter table public.stories add column if not exists status text;
alter table public.stories add column if not exists status_updated_at timestamptz;
alter table public.stories add column if not exists has_active_poll boolean not null default false;

create table if not exists public.story_polls (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  question text not null,
  options jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  closes_at timestamptz,
  is_active boolean not null default true
);

create table if not exists public.story_poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.story_polls(id) on delete cascade,
  user_or_device_id text not null,
  selected_option text not null,
  created_at timestamptz not null default now(),
  unique (poll_id, user_or_device_id)
);

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_or_device_id text not null unique,
  update_alarms_enabled boolean not null default false,
  followed_story_updates boolean not null default true,
  followed_persona_updates boolean not null default true,
  poll_result_reminders boolean not null default true,
  seasonal_wrapped_reminders boolean not null default true,
  browser_push_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.in_app_notifications (
  id uuid primary key default gen_random_uuid(),
  user_or_device_id text not null,
  type text not null,
  title text not null,
  body text not null,
  story_id uuid references public.stories(id) on delete cascade,
  persona_id text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.seasonal_wrapped (
  id uuid primary key default gen_random_uuid(),
  user_or_device_id text not null,
  season_name text not null check (season_name in ('Winter Wildin''', 'Summer Special')),
  period_start date not null,
  period_end date not null,
  recap_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.persona_badges (
  id uuid primary key default gen_random_uuid(),
  persona_id text not null,
  badge_name text not null,
  badge_description text,
  unlocked_at timestamptz not null default now(),
  is_equipped boolean not null default false
);

alter table public.story_polls enable row level security;
alter table public.story_poll_votes enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.in_app_notifications enable row level security;
alter table public.seasonal_wrapped enable row level security;
alter table public.persona_badges enable row level security;

create policy "Anyone can read story polls" on public.story_polls for select using (true);
create policy "Anyone can create story polls" on public.story_polls for insert with check (true);
create policy "Anyone can read poll votes" on public.story_poll_votes for select using (true);
create policy "Anyone can vote once per device" on public.story_poll_votes for insert with check (true);
create policy "Anyone can manage notification preferences" on public.notification_preferences for all using (true) with check (true);
create policy "Anyone can read in-app notifications" on public.in_app_notifications for select using (true);
create policy "Anyone can create in-app notifications" on public.in_app_notifications for insert with check (true);
create policy "Anyone can read seasonal wrapped" on public.seasonal_wrapped for select using (true);
create policy "Anyone can create seasonal wrapped" on public.seasonal_wrapped for insert with check (true);
create policy "Anyone can read persona badges" on public.persona_badges for select using (true);

create index if not exists stories_status_idx on public.stories(status, status_updated_at desc);
create index if not exists stories_active_poll_idx on public.stories(has_active_poll, created_at desc);
create index if not exists story_polls_story_id_idx on public.story_polls(story_id, is_active);
create index if not exists story_poll_votes_poll_id_idx on public.story_poll_votes(poll_id);
create index if not exists in_app_notifications_user_idx on public.in_app_notifications(user_or_device_id, created_at desc);
create index if not exists seasonal_wrapped_user_idx on public.seasonal_wrapped(user_or_device_id, season_name);
create index if not exists persona_badges_persona_idx on public.persona_badges(persona_id, is_equipped);
