-- Rule of Life: schema + seed

create extension if not exists pgcrypto;

-- Enums
do $$
begin
  if not exists (select 1 from pg_type where typname = 'liturgical_season') then
    create type public.liturgical_season as enum (
      'ADVENT',
      'CHRISTMAS',
      'LENT',
      'HOLY_WEEK',
      'EASTER',
      'ORDINARY_TIME'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'practice_lane') then
    create type public.practice_lane as enum (
      'PRAYER',
      'ASCETIC',
      'CHARITY',
      'ATTENTION'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'practice_recurrence') then
    create type public.practice_recurrence as enum (
      'DAILY',
      'WEEKLY'
    );
  end if;
end $$;

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Liturgical calendar cache
create table if not exists public.liturgical_days (
  date date primary key,
  season public.liturgical_season not null,
  celebration_key text null,
  celebration_name text null,
  celebration_type text null,
  celebration_source text null,
  meta jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_updated_at on public.liturgical_days;
create trigger set_updated_at
before update on public.liturgical_days
for each row execute function public.set_updated_at();

-- Practice definitions (global)
create table if not exists public.practices (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  season public.liturgical_season not null,
  lane public.practice_lane not null,
  title text not null,
  description text not null default '',
  recurrence public.practice_recurrence not null,
  scheduled_weekday smallint null check (scheduled_weekday between 0 and 6),
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weekly_requires_weekday check (
    (recurrence = 'WEEKLY' and scheduled_weekday is not null)
    or
    (recurrence = 'DAILY' and scheduled_weekday is null)
  )
);

drop trigger if exists set_updated_at on public.practices;
create trigger set_updated_at
before update on public.practices
for each row execute function public.set_updated_at();

-- Per-user overrides (weekday + disable + optional copy tweaks)
create table if not exists public.user_practice_overrides (
  user_id uuid not null references auth.users(id) on delete cascade,
  practice_id uuid not null references public.practices(id) on delete cascade,
  scheduled_weekday smallint null check (scheduled_weekday between 0 and 6),
  is_enabled boolean not null default true,
  custom_title text null,
  custom_description text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, practice_id)
);

drop trigger if exists set_updated_at on public.user_practice_overrides;
create trigger set_updated_at
before update on public.user_practice_overrides
for each row execute function public.set_updated_at();

-- Per-user settings
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  wake_time time null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_updated_at on public.user_settings;
create trigger set_updated_at
before update on public.user_settings
for each row execute function public.set_updated_at();

-- Per-user completions (no persistent "unchecked" state)
create table if not exists public.practice_completions (
  user_id uuid not null references auth.users(id) on delete cascade,
  practice_id uuid not null references public.practices(id) on delete cascade,
  date_local date not null,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (user_id, practice_id, date_local)
);

create index if not exists practice_completions_user_date_idx
on public.practice_completions (user_id, date_local);

-- RLS
alter table public.liturgical_days enable row level security;
alter table public.practices enable row level security;
alter table public.user_practice_overrides enable row level security;
alter table public.user_settings enable row level security;
alter table public.practice_completions enable row level security;

-- Policies: read-only global tables (authenticated)
drop policy if exists "liturgical_days_select_authenticated" on public.liturgical_days;
create policy "liturgical_days_select_authenticated"
on public.liturgical_days
for select
to authenticated
using (true);

drop policy if exists "practices_select_authenticated" on public.practices;
create policy "practices_select_authenticated"
on public.practices
for select
to authenticated
using (true);

-- Policies: per-user tables
drop policy if exists "user_practice_overrides_select_own" on public.user_practice_overrides;
create policy "user_practice_overrides_select_own"
on public.user_practice_overrides
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "user_practice_overrides_upsert_own" on public.user_practice_overrides;
create policy "user_practice_overrides_upsert_own"
on public.user_practice_overrides
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "user_practice_overrides_update_own" on public.user_practice_overrides;
create policy "user_practice_overrides_update_own"
on public.user_practice_overrides
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "user_practice_overrides_delete_own" on public.user_practice_overrides;
create policy "user_practice_overrides_delete_own"
on public.user_practice_overrides
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "user_settings_select_own" on public.user_settings;
create policy "user_settings_select_own"
on public.user_settings
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "user_settings_insert_own" on public.user_settings;
create policy "user_settings_insert_own"
on public.user_settings
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "user_settings_update_own" on public.user_settings;
create policy "user_settings_update_own"
on public.user_settings
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "practice_completions_select_own" on public.practice_completions;
create policy "practice_completions_select_own"
on public.practice_completions
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "practice_completions_insert_own" on public.practice_completions;
create policy "practice_completions_insert_own"
on public.practice_completions
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "practice_completions_delete_own" on public.practice_completions;
create policy "practice_completions_delete_own"
on public.practice_completions
for delete
to authenticated
using (user_id = auth.uid());

-- Seed practices (idempotent via unique key)
insert into public.practices (key, season, lane, title, description, recurrence, scheduled_weekday, sort_order)
values
  -- Advent
  ('advent_silent_mental_prayer_before_phone', 'ADVENT', 'PRAYER', 'Silent mental prayer before any phone/content', 'Before opening your phone (or any content), pause for silent mental prayer.', 'DAILY', null, 10),
  ('advent_noise_fast', 'ADVENT', 'ASCETIC', 'Noise fast', 'Choose one day each week for a noise fast: no music/podcasts/background audio unless necessary.', 'WEEKLY', 3, 10),
  ('advent_hidden_act_service', 'ADVENT', 'CHARITY', 'Hidden act of service', 'Do one hidden act of service each week (unseen, uncredited).', 'WEEKLY', 6, 10),
  ('advent_no_phone_until_prayer', 'ADVENT', 'ATTENTION', 'No phone until prayer completed', 'No phone until your prayer is completed.', 'DAILY', null, 10),

  -- Christmas
  ('christmas_gratitude_after_prayer', 'CHRISTMAS', 'PRAYER', '3-line gratitude after prayer', 'After prayer, write (or speak) 3 short lines of gratitude.', 'DAILY', null, 10),
  ('christmas_sweets_only_with_meals', 'CHRISTMAS', 'ASCETIC', 'Sweets only with meals', 'If you have sweets, keep them to mealtimes.', 'DAILY', null, 10),
  ('christmas_gift_time_or_money', 'CHRISTMAS', 'CHARITY', 'Gift of time or money', 'Choose one weekly gift: time, money, or a concrete act of generosity.', 'WEEKLY', 6, 10),
  ('christmas_phone_away_meals', 'CHRISTMAS', 'ATTENTION', 'Phone away at meals and in-person conversations', 'Phone stays away during meals and in-person conversations.', 'DAILY', null, 10),

  -- Lent
  ('lent_stations_of_the_cross', 'LENT', 'PRAYER', 'Stations of the Cross', 'Pray the Stations of the Cross on Fridays.', 'WEEKLY', 5, 10),
  ('lent_audio_only_no_video', 'LENT', 'ASCETIC', 'Audio-only content, no video', 'Audio-only content; no video content.', 'DAILY', null, 10),
  ('lent_weekly_almsgiving', 'LENT', 'CHARITY', 'Weekly almsgiving', 'Give alms once each week (money or concrete support).', 'WEEKLY', 0, 10),
  ('lent_weekly_act_of_mercy', 'LENT', 'CHARITY', 'Weekly act of mercy', 'Choose one weekly act of mercy (spiritual or corporal).', 'WEEKLY', 3, 20),
  ('lent_nightly_screen_cutoff', 'LENT', 'ATTENTION', 'Hard nightly screen cutoff', 'Set a hard nightly screen cutoff and keep it.', 'DAILY', null, 10),

  -- Easter
  ('easter_prayer_and_scripture_acts', 'EASTER', 'PRAYER', 'Silent mental prayer then short Scripture read (Acts)', 'Silent mental prayer, then a short Scripture read (Acts is a good default).', 'DAILY', null, 10),
  ('easter_fixed_wake_time', 'EASTER', 'ASCETIC', 'Fixed wake time daily', 'Wake at a consistent time (set in Settings).', 'DAILY', null, 10),
  ('easter_intentional_reach_out', 'EASTER', 'CHARITY', 'Intentional reach-out', 'Each week, reach out intentionally to one person (text/call/in-person).', 'WEEKLY', 0, 10),
  ('easter_go_outside_phone_pocket', 'EASTER', 'ATTENTION', 'Go outside daily, phone stays in pocket', 'Go outside daily; phone stays in your pocket.', 'DAILY', null, 10),

  -- Ordinary Time
  ('ordinary_lectio_divina_gospel', 'ORDINARY_TIME', 'PRAYER', 'Daily Lectio Divina (10 min) using the day’s Gospel', '10 minutes of Lectio Divina using the day’s Gospel.', 'DAILY', null, 10),
  ('ordinary_abstain_meat_friday', 'ORDINARY_TIME', 'ASCETIC', 'Abstain from meat on Friday', 'Abstain from meat on Fridays (optional add-on: no dessert Friday).', 'WEEKLY', 5, 10),
  ('ordinary_daily_practical_help', 'ORDINARY_TIME', 'CHARITY', 'Daily practical help act', 'Do one practical act of help each day.', 'DAILY', null, 10),
  ('ordinary_nightly_examen', 'ORDINARY_TIME', 'ATTENTION', 'Nightly 3-minute examen', 'A simple 3-minute examen each night.', 'DAILY', null, 10)
on conflict (key) do nothing;

