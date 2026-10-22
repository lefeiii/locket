-- Public-story discovery. Run AFTER someone_like_me.sql; chat SQL is NOT needed.
-- Installation enables voluntary intake only when an existing moderator is assigned.
begin;
create table if not exists public.slm_public_config(id boolean primary key default true check(id),enabled boolean not null default true);
insert into public.slm_public_config(id) values(true) on conflict do nothing;
create table if not exists public.slm_public_preferences(
 user_id uuid primary key references auth.users(id) on delete cascade,
 connection_preference text not null check(connection_preference in('now','been_through','both')),
 topics text[] not null check(cardinality(topics) between 1 and 3 and array_position(topics,null) is null and topics <@ array['friendship_fallout','feeling_left_out','family','relationships','school_stress','loneliness']::text[]),
 consent_version text not null default 'slm-public-reader-v1' check(consent_version='slm-public-reader-v1'),
 consented_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists public.slm_public_stories(
 story_id uuid primary key references public.stories(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 topics text[] not null check(cardinality(topics) between 1 and 3 and array_position(topics,null) is null and topics <@ array['friendship_fallout','feeling_left_out','family','relationships','school_stress','loneliness']::text[]),
 experience_stage text not null check(experience_stage in('going_through','been_through','both')),
 offer_encouragement boolean not null default false,
 consent_version text not null default 'slm-public-author-v1' check(consent_version='slm-public-author-v1'),
 consented_at timestamptz not null default now(),updated_at timestamptz not null default now(),revision uuid not null default gen_random_uuid(),
 review_status text not null default 'pending' check(review_status in('pending','approved','paused')),
 reviewed_at timestamptz,reviewed_by uuid references auth.users(id) on delete set null,
 check(not offer_encouragement or experience_stage in('been_through','both'))
);
create table if not exists public.slm_public_visits(
 user_id uuid not null references public.slm_public_preferences(user_id) on delete cascade,visited_on date not null,primary key(user_id,visited_on)
);
create table if not exists public.slm_public_impressions(
 user_id uuid not null references auth.users(id) on delete cascade,story_id uuid not null references public.stories(id) on delete cascade,primary key(user_id,story_id)
);
create table if not exists public.slm_public_feedback(
 user_id uuid not null references public.slm_public_preferences(user_id) on delete cascade,
 story_id uuid not null references public.slm_public_stories(story_id) on delete cascade,
 answer text not null check(answer in('yes','somewhat','no')),primary key(user_id,story_id)
);
create table if not exists public.slm_public_daily_counts(
 day date primary key,impressions integer not null default 0,optins integer not null default 0,story_optins integer not null default 0,withdrawals integer not null default 0
);
alter table public.slm_public_config enable row level security;
alter table public.slm_public_preferences enable row level security;
alter table public.slm_public_stories enable row level security;
alter table public.slm_public_visits enable row level security;
alter table public.slm_public_impressions enable row level security;
alter table public.slm_public_feedback enable row level security;
alter table public.slm_public_daily_counts enable row level security;
revoke all on public.slm_public_config,public.slm_public_preferences,public.slm_public_stories,public.slm_public_visits,public.slm_public_impressions,public.slm_public_feedback,public.slm_public_daily_counts from public,anon,authenticated;
grant all on public.slm_public_config,public.slm_public_preferences,public.slm_public_stories,public.slm_public_visits,public.slm_public_impressions,public.slm_public_feedback,public.slm_public_daily_counts to service_role;

create or replace function public.slm_public_open() returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select enabled from public.slm_public_config where id),false) and exists(select 1 from public.slm_moderators);
$$;
create or replace function public.slm_public_visible(s public.stories) returns boolean language sql immutable set search_path='' as $$
 select not coalesce((to_jsonb(s)->>'is_private')::boolean,false) and not coalesce((to_jsonb(s)->>'is_diary_only')::boolean,false) and not coalesce((to_jsonb(s)->>'is_hidden')::boolean,false);
$$;
create or replace function public.slm_public_owned(s public.stories,person uuid) returns boolean language sql stable security definer set search_path='' as $$
 select person is not null and (s.user_id::text=person::text or (s.user_id is null and exists(select 1 from public.users u where u.id::text=person::text and u.username=s.anonymous_name)));
$$;
create or replace function public.slm_public_topics_valid(choices text[]) returns boolean language sql immutable set search_path='' as $$
 select coalesce(cardinality(choices) between 1 and 3 and array_position(choices,null) is null and choices <@ array['friendship_fallout','feeling_left_out','family','relationships','school_stress','loneliness']::text[] and cardinality(choices)=(select count(distinct t) from unnest(choices)t),false);
$$;
create or replace function public.slm_public_fits(story_uuid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.slm_public_open() and exists(select 1 from public.slm_public_preferences p join public.slm_public_stories l on l.story_id=story_uuid join public.stories s on s.id=l.story_id
 where p.user_id=auth.uid() and l.owner_id<>auth.uid() and l.review_status='approved' and l.topics&&p.topics and public.slm_public_visible(s) and public.slm_public_owned(s,l.owner_id)
 and ((p.connection_preference in('now','both') and l.experience_stage in('going_through','both')) or (p.connection_preference in('been_through','both') and l.experience_stage in('been_through','both') and l.offer_encouragement)));
$$;
create or replace function public.slm_public_recommendations() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501';end if;
 return coalesce((with ranked as(
 select s.id,s.title,s.created_at,l.experience_stage,l.offer_encouragement,
 array(select unnest(l.topics) intersect select unnest(p.topics)) shared_topics,
 row_number() over(partition by l.owner_id order by cardinality(array(select unnest(l.topics) intersect select unnest(p.topics))) desc,s.created_at desc,s.id) author_rank
 from public.slm_public_stories l join public.stories s on s.id=l.story_id join public.slm_public_preferences p on p.user_id=auth.uid() where public.slm_public_fits(s.id)
 ), chosen as(select * from ranked where author_rank=1 order by cardinality(shared_topics) desc,created_at desc,id limit 6)
 select jsonb_agg(jsonb_build_object('id',id,'title',title,'topics',shared_topics,'stage',experience_stage,'offers_encouragement',offer_encouragement) order by cardinality(shared_topics) desc,created_at desc,id) from chosen),'[]'::jsonb);
end $$;
create or replace function public.slm_public_state(focus_story uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501';end if;
 return jsonb_build_object('available',public.slm_public_open(),'moderator',public.slm_is_moderator(),
 'preferences',(select to_jsonb(p)-'user_id' from public.slm_public_preferences p where p.user_id=auth.uid()),
 'stories',coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title,'public',visible,'listing',listing) order by created_at desc) from(
 select s.id,s.title,s.created_at,public.slm_public_visible(s) visible,(select to_jsonb(l)-'owner_id'-'reviewed_by' from public.slm_public_stories l where l.story_id=s.id and l.owner_id=auth.uid()) listing
 from public.stories s where public.slm_public_owned(s,auth.uid()) and (public.slm_public_visible(s) or exists(select 1 from public.slm_public_stories l where l.story_id=s.id and l.owner_id=auth.uid()))
 order by (s.id=focus_story) desc,s.created_at desc limit 30)x),'[]'::jsonb),
 'recommendations',public.slm_public_recommendations());
end $$;
create or replace function public.slm_public_save(connection_choice text,topic_choices text[],consent boolean) returns void language plpgsql security definer set search_path='' as $$
declare inserted integer;
begin
 if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'Verified login required' using errcode='42501';end if;
 if not public.slm_public_open() then raise exception 'Story discovery is paused' using errcode='22023';end if;
 if consent is distinct from true or not public.slm_public_topics_valid(topic_choices) or connection_choice is null or connection_choice not in('now','been_through','both') then raise exception 'Explicit consent and valid selections required' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 insert into public.slm_public_preferences(user_id,connection_preference,topics) values(auth.uid(),connection_choice,topic_choices) on conflict do nothing;
 get diagnostics inserted=row_count;
 update public.slm_public_preferences set connection_preference=connection_choice,topics=topic_choices,updated_at=now() where user_id=auth.uid();
 if inserted=1 then insert into public.slm_public_daily_counts(day,optins) values((now() at time zone 'UTC')::date,1) on conflict(day) do update set optins=public.slm_public_daily_counts.optins+1;end if;
end $$;
create or replace function public.slm_public_offer(story_uuid uuid,topic_choices text[],stage_choice text,encouragement boolean,consent boolean) returns void language plpgsql security definer set search_path='' as $$
declare inserted integer;
begin
 if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'Verified login required' using errcode='42501';end if;
 if not public.slm_public_open() then raise exception 'Story discovery is paused' using errcode='22023';end if;
 if consent is distinct from true or not public.slm_public_topics_valid(topic_choices) or stage_choice is null or stage_choice not in('going_through','been_through','both') or encouragement is null or (encouragement and stage_choice='going_through') then raise exception 'Explicit story consent and valid selections required' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 perform 1 from public.stories s where s.id=story_uuid and public.slm_public_visible(s) and public.slm_public_owned(s,auth.uid()) for update;
 if not found then raise exception 'Your own visible public story required' using errcode='42501';end if;
 if not exists(select 1 from public.slm_public_stories where story_id=story_uuid) and (select count(*) from public.slm_public_stories where owner_id=auth.uid())>=20 then raise exception 'At most twenty opted-in stories per author' using errcode='22023';end if;
 insert into public.slm_public_stories(story_id,owner_id,topics,experience_stage,offer_encouragement) values(story_uuid,auth.uid(),topic_choices,stage_choice,encouragement) on conflict do nothing;
 get diagnostics inserted=row_count;
 update public.slm_public_stories set topics=topic_choices,experience_stage=stage_choice,offer_encouragement=encouragement,revision=gen_random_uuid(),updated_at=now(),review_status=case when review_status='paused' then 'paused' else 'pending' end,reviewed_at=null,reviewed_by=null where story_id=story_uuid and owner_id=auth.uid();
 if not found then raise exception 'Story ownership changed' using errcode='42501';end if;
 if inserted=1 then insert into public.slm_public_daily_counts(day,story_optins) values((now() at time zone 'UTC')::date,1) on conflict(day) do update set story_optins=public.slm_public_daily_counts.story_optins+1;end if;
end $$;
create or replace function public.slm_public_unshare(story_uuid uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501';end if;
 delete from public.slm_public_stories where story_id=story_uuid and owner_id=auth.uid();
end $$;
create or replace function public.slm_public_withdraw() returns void language plpgsql security definer set search_path='' as $$
declare changed integer;removed integer;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 delete from public.slm_public_stories where owner_id=auth.uid();get diagnostics changed=row_count;
 delete from public.slm_public_preferences where user_id=auth.uid();get diagnostics removed=row_count;
 delete from public.slm_public_impressions where user_id=auth.uid();
 if changed+removed>0 then insert into public.slm_public_daily_counts(day,withdrawals) values((now() at time zone 'UTC')::date,1) on conflict(day) do update set withdrawals=public.slm_public_daily_counts.withdrawals+1;end if;
end $$;
create or replace function public.slm_public_impression(story_uuid uuid) returns void language plpgsql security definer set search_path='' as $$
declare inserted integer;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501';end if;
 if not public.slm_public_open() then return;end if;
 if not exists(select 1 from public.stories s where s.id=story_uuid and public.slm_public_owned(s,auth.uid()) and public.slm_public_visible(s) and s.created_at>=now()-interval '24 hours') then raise exception 'Recent own public story required' using errcode='42501';end if;
 insert into public.slm_public_impressions(user_id,story_id) values(auth.uid(),story_uuid) on conflict do nothing;get diagnostics inserted=row_count;
 if inserted=1 then insert into public.slm_public_daily_counts(day,impressions) values((now() at time zone 'UTC')::date,1) on conflict(day) do update set impressions=public.slm_public_daily_counts.impressions+1;end if;
end $$;
create or replace function public.slm_public_record_return() returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.slm_public_open() then return;end if;
 insert into public.slm_public_visits(user_id,visited_on) select user_id,(now() at time zone 'UTC')::date from public.slm_public_preferences where user_id=auth.uid() and (now() at time zone 'UTC')::date<=(consented_at at time zone 'UTC')::date+7 on conflict do nothing;
end $$;
create or replace function public.slm_public_feedback_state(story_uuid uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501';end if;
 return jsonb_build_object('available',public.slm_public_fits(story_uuid),'answer',(select answer from public.slm_public_feedback where user_id=auth.uid() and story_id=story_uuid));
end $$;
create or replace function public.slm_public_feedback_save(story_uuid uuid,choice text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.slm_public_fits(story_uuid) then raise exception 'Opted-in public story and reader preferences required' using errcode='42501';end if;
 if choice is null or choice not in('yes','somewhat','no') then raise exception 'Choose valid feedback' using errcode='22023';end if;
 insert into public.slm_public_feedback(user_id,story_id,answer) values(auth.uid(),story_uuid,choice) on conflict(user_id,story_id) do update set answer=excluded.answer;
end $$;
create or replace function public.slm_public_review_story(story_uuid uuid,decision text,expected_revision uuid) returns void language plpgsql security definer set search_path='' as $$
declare l public.slm_public_stories;
begin
 if not public.slm_is_moderator() then raise exception 'Moderator required' using errcode='42501';end if;
 perform 1 from public.stories where id=story_uuid for update;
 select * into l from public.slm_public_stories where story_id=story_uuid for update;
 if l.story_id is null or l.revision is distinct from expected_revision then raise exception 'Story changed or withdrawn; refresh' using errcode='22023';end if;
 if l.owner_id=auth.uid() then raise exception 'Independent reviewer required' using errcode='42501';end if;
 if decision is null or decision not in('approved','paused') then raise exception 'Choose approve or pause' using errcode='22023';end if;
 if decision='approved' and not exists(select 1 from public.stories s where s.id=story_uuid and public.slm_public_visible(s) and public.slm_public_owned(s,l.owner_id)) then raise exception 'Visible public story and current owner required' using errcode='22023';end if;
 update public.slm_public_stories set review_status=decision,reviewed_at=now(),reviewed_by=auth.uid(),revision=gen_random_uuid(),updated_at=now() where story_id=story_uuid;
end $$;
create or replace function public.slm_public_review() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.slm_is_moderator() then raise exception 'Moderator required' using errcode='42501';end if;
 return jsonb_build_object('available',public.slm_public_open(),
 'stories',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'body',s.body,'topics',l.topics,'stage',l.experience_stage,'offers_encouragement',l.offer_encouragement,'status',l.review_status,'revision',l.revision,'public',public.slm_public_visible(s)) order by l.updated_at) from public.slm_public_stories l join public.stories s on s.id=l.story_id where l.owner_id<>auth.uid() and public.slm_public_visible(s) and public.slm_public_owned(s,l.owner_id)),'[]'::jsonb),
 'metrics',jsonb_build_object('invitation_impressions',coalesce((select sum(impressions) from public.slm_public_daily_counts),0),'reader_optins',coalesce((select sum(optins) from public.slm_public_daily_counts),0),'story_optins',coalesce((select sum(story_optins) from public.slm_public_daily_counts),0),'withdrawals',coalesce((select sum(withdrawals) from public.slm_public_daily_counts),0),
 'current_readers',(select count(*) from public.slm_public_preferences),'approved_stories',(select count(*) from public.slm_public_stories where review_status='approved'),
 'connection_preferences',(select coalesce(jsonb_object_agg(connection_preference,n),'{}'::jsonb) from(select connection_preference,count(*) n from public.slm_public_preferences group by 1)x),
 'topics',(select coalesce(jsonb_object_agg(topic,n),'{}'::jsonb) from(select topic,count(*) n from public.slm_public_preferences p cross join lateral unnest(p.topics) topic group by 1)x),
 'seven_day_mature_cohort',(select count(*) from public.slm_public_preferences where consented_at<=now()-interval '7 days'),
 'seven_day_mature_returners',(select count(*) from public.slm_public_preferences p where consented_at<=now()-interval '7 days' and exists(select 1 from public.slm_public_visits v where v.user_id=p.user_id and v.visited_on>(p.consented_at at time zone 'UTC')::date and v.visited_on<=(p.consented_at at time zone 'UTC')::date+7)),
 'feeling_understood',(select coalesce(jsonb_object_agg(answer,n),'{}'::jsonb) from(select answer,count(*) n from public.slm_public_feedback group by 1)x),'private_conversations_enabled',false));
end $$;
-- Changes to a story or its response boundaries invalidate the specific review.
create or replace function public.slm_public_story_changed() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (to_jsonb(new)-array['reactions','status','status_updated_at','has_active_poll']) is distinct from (to_jsonb(old)-array['reactions','status','status_updated_at','has_active_poll']) then
  update public.slm_public_stories set revision=gen_random_uuid(),updated_at=now(),review_status=case when review_status='paused' then 'paused' else 'pending' end,reviewed_at=null,reviewed_by=null where story_id=new.id;
 end if;return new;
end $$;
drop trigger if exists slm_public_story_changed on public.stories;
create trigger slm_public_story_changed after update on public.stories for each row execute function public.slm_public_story_changed();
create or replace function public.slm_public_profile_deleted() returns trigger language plpgsql security definer set search_path='' as $$
begin
 delete from public.slm_public_stories where owner_id::text=old.id::text;
 delete from public.slm_public_preferences where user_id::text=old.id::text;
 delete from public.slm_public_impressions where user_id::text=old.id::text;return old;
end $$;
drop trigger if exists slm_public_profile_deleted on public.users;
create trigger slm_public_profile_deleted after delete on public.users for each row execute function public.slm_public_profile_deleted();
-- The public-story launch never opens the separate private-chat pilot.
do $$ begin if to_regclass('public.slm_contact_config') is not null then execute 'update public.slm_contact_config set enabled=false where id=true';end if;end $$;
revoke all on function public.slm_public_open(),public.slm_public_visible(public.stories),public.slm_public_owned(public.stories,uuid),public.slm_public_topics_valid(text[]),public.slm_public_fits(uuid),public.slm_public_story_changed(),public.slm_public_profile_deleted() from public,anon,authenticated;
revoke all on function public.slm_public_state(uuid),public.slm_public_recommendations(),public.slm_public_save(text,text[],boolean),public.slm_public_offer(uuid,text[],text,boolean,boolean),public.slm_public_unshare(uuid),public.slm_public_withdraw(),public.slm_public_impression(uuid),public.slm_public_record_return(),public.slm_public_feedback_state(uuid),public.slm_public_feedback_save(uuid,text),public.slm_public_review_story(uuid,text,uuid),public.slm_public_review() from public,anon,authenticated;
grant execute on function public.slm_public_state(uuid),public.slm_public_recommendations(),public.slm_public_save(text,text[],boolean),public.slm_public_offer(uuid,text[],text,boolean,boolean),public.slm_public_unshare(uuid),public.slm_public_withdraw(),public.slm_public_impression(uuid),public.slm_public_record_return(),public.slm_public_feedback_state(uuid),public.slm_public_feedback_save(uuid,text),public.slm_public_review_story(uuid,text,uuid),public.slm_public_review() to authenticated;
commit;
