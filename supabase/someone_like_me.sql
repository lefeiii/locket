-- Someone Like Me: waitlist ONLY. No matches, invitations, conversations or messages.
-- Run the whole file in Supabase SQL Editor. Existing Locket tables are not changed.
begin;
create table if not exists public.slm_config (
 id boolean primary key default true check(id), enabled boolean not null default false
);
insert into public.slm_config(id) values(true) on conflict do nothing;
create table if not exists public.slm_moderators (
 user_id uuid primary key references auth.users(id) on delete cascade
);
create table if not exists public.slm_enrollments (
 user_id uuid primary key references auth.users(id) on delete cascade,
 connection_preference text not null check(connection_preference in ('now','been_through','both')),
 experience_stage text not null check(experience_stage in ('going_through','been_through','both')),
 topics text[] not null check(cardinality(topics) between 1 and 3 and topics <@ array['friendship_fallout','feeling_left_out','family','relationships','school_stress','loneliness']::text[] and array_position(topics,null) is null),
 offer_encouragement boolean not null default false,
 age_band text not null check(age_band in ('13_15','16_17','18_plus')),
 consent_version text not null default 'slm-waitlist-v1' check(consent_version='slm-waitlist-v1'),
 consented_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 review_status text not null default 'pending' check(review_status in ('pending','reviewed_waitlist','paused')),
 check(not offer_encouragement or experience_stage in ('been_through','both'))
);
create table if not exists public.slm_impressions (
 user_id uuid not null references auth.users(id) on delete cascade,
 story_id uuid not null references public.stories(id) on delete cascade,
 seen_at timestamptz not null default now(), primary key(user_id,story_id)
);
create table if not exists public.slm_visits (
 user_id uuid not null references public.slm_enrollments(user_id) on delete cascade,
 visited_on date not null, first_seen_at timestamptz not null default now(), primary key(user_id,visited_on)
);
create table if not exists public.slm_daily_counts (
 day date primary key, impressions integer not null default 0,
 optins integer not null default 0, withdrawals integer not null default 0
);
create table if not exists public.slm_safety_reports (
 id uuid primary key default gen_random_uuid(),
 reporter_id uuid not null references auth.users(id) on delete cascade,
 category text not null check(category in ('privacy','unwanted_contact','harassment','urgent_safety','other')),
 created_at timestamptz not null default now(), status text not null default 'open' check(status in ('open','closed')),
 closed_at timestamptz, closed_by uuid references auth.users(id) on delete set null
);
create table if not exists public.slm_review_log (
 id uuid primary key default gen_random_uuid(),
 participant_id uuid not null references public.slm_enrollments(user_id) on delete cascade,
 moderator_id uuid references auth.users(id) on delete set null,
 decision text not null check(decision in ('pending','reviewed_waitlist','paused')),
 created_at timestamptz not null default now()
);

alter table public.slm_config enable row level security;
alter table public.slm_moderators enable row level security;
alter table public.slm_enrollments enable row level security;
alter table public.slm_impressions enable row level security;
alter table public.slm_visits enable row level security;
alter table public.slm_daily_counts enable row level security;
alter table public.slm_safety_reports enable row level security;
alter table public.slm_review_log enable row level security;
-- Never inherit the permissive policies used by older public Locket tables.
revoke all on public.slm_config,public.slm_moderators,public.slm_enrollments,public.slm_impressions,public.slm_visits,public.slm_daily_counts,public.slm_safety_reports,public.slm_review_log from public,anon,authenticated;
grant all on public.slm_config,public.slm_moderators,public.slm_enrollments,public.slm_impressions,public.slm_visits,public.slm_daily_counts,public.slm_safety_reports,public.slm_review_log to service_role;
-- All participant and moderator access goes through the narrowly scoped functions below.

-- Intake fails closed if the operator has not assigned a moderator yet.
create or replace function public.slm_pilot_open() returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((select enabled from public.slm_config where id),false)
 and exists(select 1 from public.slm_moderators);
$$;
revoke all on function public.slm_pilot_open() from public,anon,authenticated;

create or replace function public.slm_is_moderator() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.slm_moderators where user_id=auth.uid());
$$;
create or replace function public.slm_state() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 return jsonb_build_object(
  'available',public.slm_pilot_open(),
  'moderator',public.slm_is_moderator(),
  'enrollment',(select to_jsonb(e)-'user_id' from public.slm_enrollments e where e.user_id=auth.uid()),
  'reports',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'category',r.category,'status',r.status,'created_at',r.created_at)) from public.slm_safety_reports r where reporter_id=auth.uid()),'[]'::jsonb)
 );
end $$;

create or replace function public.slm_record_impression(story_uuid uuid) returns void
language plpgsql security definer set search_path='' as $$
declare inserted integer;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if not public.slm_pilot_open() then return; end if;
 if not exists(select 1 from public.stories s where s.id=story_uuid
  and (s.user_id::text=auth.uid()::text or (s.user_id is null and exists(select 1 from public.users u where u.id::text=auth.uid()::text and u.username=s.anonymous_name)))
  and s.created_at>=now()-interval '24 hours'
  and not coalesce((to_jsonb(s)->>'is_hidden')::boolean,false)
  and not coalesce((to_jsonb(s)->>'is_private')::boolean,false)
  and not coalesce((to_jsonb(s)->>'is_diary_only')::boolean,false))
 then raise exception 'Recent own public story required' using errcode='42501'; end if;
 insert into public.slm_impressions(user_id,story_id) values(auth.uid(),story_uuid) on conflict do nothing;
 get diagnostics inserted=row_count;
 if inserted=1 then
  insert into public.slm_daily_counts(day,impressions) values((now() at time zone 'UTC')::date,1)
  on conflict(day) do update set impressions=public.slm_daily_counts.impressions+1;
 end if;
end $$;

create or replace function public.slm_join(connection_choice text,stage_choice text,topic_choices text[],encouragement boolean,age_choice text,consent boolean) returns void
language plpgsql security definer set search_path='' as $$
declare was_enrolled boolean;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if not public.slm_pilot_open() then raise exception 'Pilot is paused' using errcode='22023'; end if;
 if not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'Verified account required' using errcode='42501'; end if;
 if consent is distinct from true then raise exception 'Explicit consent required' using errcode='22023'; end if;
 if connection_choice is null or connection_choice not in ('now','been_through','both')
  or stage_choice is null or stage_choice not in ('going_through','been_through','both')
  or age_choice is null or age_choice not in ('13_15','16_17','18_plus')
  or topic_choices is null or cardinality(topic_choices) not between 1 and 3
  or array_position(topic_choices,null) is not null
  or not topic_choices <@ array['friendship_fallout','feeling_left_out','family','relationships','school_stress','loneliness']::text[]
  or cardinality(topic_choices)<>(select count(distinct x) from unnest(topic_choices) x)
  or encouragement is null or (encouragement and stage_choice='going_through')
 then raise exception 'Choose valid preferences and age band' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 if exists(select 1 from public.slm_enrollments where user_id=auth.uid() and updated_at>now()-interval '2 seconds') then raise exception 'Please wait a moment before saving again' using errcode='22023'; end if;
 select exists(select 1 from public.slm_enrollments where user_id=auth.uid()) into was_enrolled;
 insert into public.slm_enrollments(user_id,connection_preference,experience_stage,topics,offer_encouragement,age_band)
 values(auth.uid(),connection_choice,stage_choice,topic_choices,encouragement,age_choice)
 on conflict(user_id) do update set connection_preference=excluded.connection_preference,experience_stage=excluded.experience_stage,
 topics=excluded.topics,offer_encouragement=excluded.offer_encouragement,age_band=excluded.age_band,updated_at=now(),review_status=case when public.slm_enrollments.review_status='paused' then 'paused' else 'pending' end;
 if not was_enrolled then
  insert into public.slm_daily_counts(day,optins) values((now() at time zone 'UTC')::date,1)
  on conflict(day) do update set optins=public.slm_daily_counts.optins+1;
 end if;
 insert into public.slm_visits(user_id,visited_on) values(auth.uid(),(now() at time zone 'UTC')::date) on conflict do nothing;
end $$;

create or replace function public.slm_record_return() returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if not public.slm_pilot_open() then return; end if;
 if exists(select 1 from public.slm_enrollments where user_id=auth.uid() and review_status<>'paused' and (now() at time zone 'UTC')::date<=(consented_at at time zone 'UTC')::date+7) then
  insert into public.slm_visits(user_id,visited_on) values(auth.uid(),(now() at time zone 'UTC')::date) on conflict do nothing;
 end if;
end $$;

create or replace function public.slm_withdraw() returns void
language plpgsql security definer set search_path='' as $$
declare removed integer;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 delete from public.slm_enrollments where user_id=auth.uid();
 get diagnostics removed=row_count;
 delete from public.slm_impressions where user_id=auth.uid();
 if removed=1 then
  insert into public.slm_daily_counts(day,withdrawals) values((now() at time zone 'UTC')::date,1)
  on conflict(day) do update set withdrawals=public.slm_daily_counts.withdrawals+1;
 end if;
 -- Visits and review logs cascade. Non-identifying daily totals and safety reports remain.
end $$;

create or replace function public.slm_report_concern(reason text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if reason is null or reason not in ('privacy','unwanted_contact','harassment','urgent_safety','other') then raise exception 'Choose a concern' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 if (select count(*) from public.slm_safety_reports where reporter_id=auth.uid() and created_at>now()-interval '1 day')>=3 then raise exception 'Please wait before sending another concern' using errcode='22023'; end if;
 insert into public.slm_safety_reports(reporter_id,category) values(auth.uid(),reason);
end $$;

create or replace function public.slm_review_queue() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.slm_is_moderator() then raise exception 'Moderator access required' using errcode='42501'; end if;
 return jsonb_build_object(
 'enrollments',coalesce((select jsonb_agg(to_jsonb(e) order by e.consented_at) from (select user_id as participant_id,connection_preference,experience_stage,topics,offer_encouragement,age_band,review_status,consented_at,updated_at from public.slm_enrollments) e),'[]'::jsonb),
 'reports',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'participant_id',r.reporter_id,'category',r.category,'status',r.status,'created_at',r.created_at) order by (r.category='urgent_safety') desc,r.created_at) from public.slm_safety_reports r where r.status='open'),'[]'::jsonb)
 );
end $$;
create or replace function public.slm_review_participant(participant uuid,decision text,expected_updated_at timestamptz) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.slm_is_moderator() then raise exception 'Moderator access required' using errcode='42501'; end if;
 if decision is null or decision not in ('pending','reviewed_waitlist','paused') then raise exception 'Invalid review decision' using errcode='22023'; end if;
 update public.slm_enrollments set review_status=decision,updated_at=now() where user_id=participant and updated_at=expected_updated_at;
 if not found then raise exception 'Entry changed or was withdrawn; refresh the queue' using errcode='22023'; end if;
 insert into public.slm_review_log(participant_id,moderator_id,decision) values(participant,auth.uid(),decision);
end $$;
create or replace function public.slm_close_report(report_uuid uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.slm_is_moderator() then raise exception 'Moderator access required' using errcode='42501'; end if;
 update public.slm_safety_reports set status='closed',closed_at=now(),closed_by=auth.uid() where id=report_uuid and status='open';
 if not found then raise exception 'Report is no longer open' using errcode='22023'; end if;
end $$;

create or replace function public.slm_metrics() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.slm_is_moderator() then raise exception 'Moderator access required' using errcode='42501'; end if;
 return jsonb_build_object(
 'invitation_impressions',coalesce((select sum(impressions) from public.slm_daily_counts),0),
 'unique_invitation_viewers_retained',(select count(distinct user_id) from public.slm_impressions),
 'optin_events',coalesce((select sum(optins) from public.slm_daily_counts),0),
 'withdrawal_events',coalesce((select sum(withdrawals) from public.slm_daily_counts),0),
 'current_participants',(select count(*) from public.slm_enrollments),
 'connection_preferences',(select coalesce(jsonb_object_agg(connection_preference,n),'{}'::jsonb) from (select connection_preference,count(*) n from public.slm_enrollments group by 1) x),
 'experience_stages',(select coalesce(jsonb_object_agg(experience_stage,n),'{}'::jsonb) from (select experience_stage,count(*) n from public.slm_enrollments group by 1) x),
 'topics',(select coalesce(jsonb_object_agg(topic,n),'{}'::jsonb) from (select topic,count(*) n from public.slm_enrollments e cross join lateral unnest(e.topics) topic group by 1) x),
 'offering_encouragement',(select count(*) from public.slm_enrollments where offer_encouragement),
 'review_status',(select coalesce(jsonb_object_agg(review_status,n),'{}'::jsonb) from (select review_status,count(*) n from public.slm_enrollments group by 1) x),
 'seven_day_mature_cohort',(select count(*) from public.slm_enrollments where consented_at<=now()-interval '7 days'),
 'seven_day_mature_returners',(select count(*) from public.slm_enrollments e where consented_at<=now()-interval '7 days' and exists(select 1 from public.slm_visits v where v.user_id=e.user_id and v.visited_on>(e.consented_at at time zone 'UTC')::date and v.visited_on<=(e.consented_at at time zone 'UTC')::date+7)),
 'safety_reports',(select count(*) from public.slm_safety_reports),
 'unwanted_contact_reports',(select count(*) from public.slm_safety_reports where category='unwanted_contact'),
 'open_urgent_reports',(select count(*) from public.slm_safety_reports where category='urgent_safety' and status='open'),
 'mutual_acceptances',null,'feeling_understood',null,'conversations_enabled',false
 );
end $$;


-- Locket's current delete-account flow deletes public.users before signing out.
-- Clean up pilot records on that path as well as on auth.users deletion.
create or replace function public.slm_profile_deleted() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 delete from public.slm_enrollments where user_id::text=old.id::text;
 delete from public.slm_impressions where user_id::text=old.id::text;
 delete from public.slm_safety_reports where reporter_id::text=old.id::text;
 delete from public.slm_moderators where user_id::text=old.id::text;
 return old;
end $$;
drop trigger if exists slm_profile_deleted on public.users;
create trigger slm_profile_deleted after delete on public.users for each row execute function public.slm_profile_deleted();
revoke all on function public.slm_profile_deleted() from public,anon,authenticated;

-- Functions otherwise default to PUBLIC EXECUTE. Explicitly remove it on every RPC.
revoke all on function public.slm_is_moderator(),public.slm_state(),public.slm_record_impression(uuid),public.slm_join(text,text,text[],boolean,text,boolean),public.slm_record_return(),public.slm_withdraw(),public.slm_report_concern(text),public.slm_review_queue(),public.slm_review_participant(uuid,text,timestamptz),public.slm_close_report(uuid),public.slm_metrics() from public,anon,authenticated;
grant execute on function public.slm_is_moderator(),public.slm_state(),public.slm_record_impression(uuid),public.slm_join(text,text,text[],boolean,text,boolean),public.slm_record_return(),public.slm_withdraw(),public.slm_report_concern(text),public.slm_review_queue(),public.slm_review_participant(uuid,text,timestamptz),public.slm_close_report(uuid),public.slm_metrics() to authenticated;
commit;
