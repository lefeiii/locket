-- Run this entire file once in Supabase SQL Editor. Safe to run again.
create extension if not exists pgcrypto;
create table if not exists public.email_delivery_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 story_updates boolean not null default false,
 replies boolean not null default false,
 unsubscribe_token text not null default encode(gen_random_bytes(32), 'hex') unique
);
alter table public.email_delivery_preferences enable row level security;
revoke all on public.email_delivery_preferences from anon, authenticated;
grant select, insert(user_id,story_updates,replies), update(user_id,story_updates,replies) on public.email_delivery_preferences to authenticated;
drop policy if exists "Own email preferences" on public.email_delivery_preferences;
create policy "Own email preferences" on public.email_delivery_preferences for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.email_delivery_queue (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 story_id uuid not null references public.stories(id) on delete cascade,
 kind text not null check(kind in ('story_updates','replies')),
 event_count integer not null default 1,
 due_at timestamptz not null,
 status text not null default 'pending' check(status in ('pending','claimed','sent','uncertain')),
 claimed_at timestamptz
);
alter table public.email_delivery_queue enable row level security;
revoke all on public.email_delivery_queue from anon, authenticated;
grant all on public.email_delivery_queue, public.email_delivery_preferences to service_role;
create unique index if not exists email_pending_group on public.email_delivery_queue(user_id,story_id,kind) where status='pending';

create or replace function public.queue_locket_email() returns trigger
language plpgsql security definer set search_path = '' as $$
declare s public.stories; recipient uuid; kind_name text;
begin
 if tg_table_name='stories' then
  s := new;
  if not coalesce(s.is_update,false) or coalesce(s.part_number,1)<=1 then return new; end if;
  kind_name := 'story_updates';
 else
  select * into s from public.stories where id=new.story_id;
  kind_name := 'replies';
 end if;
 if s.id is null or coalesce((to_jsonb(s)->>'is_hidden')::boolean,false) or coalesce((to_jsonb(s)->>'is_private')::boolean,false) or coalesce((to_jsonb(s)->>'is_diary_only')::boolean,false) then return new; end if;
 for recipient in
  select p.user_id from public.email_delivery_preferences p where
   (kind_name='replies' and p.replies and (p.user_id=s.user_id or (s.user_id is null and exists(select 1 from public.users owner where owner.id=p.user_id and owner.username=s.anonymous_name))) and
      exists(select 1 from public.users u where u.id=auth.uid() and u.username=new.anonymous_name) and auth.uid()<>p.user_id)
   or (kind_name='story_updates' and p.story_updates and p.user_id<>s.user_id and exists(
    select 1 from public.story_follows f join public.stories followed on followed.id::text=f.story_id::text
    where f.user_id::text=p.user_id::text and followed.anonymous_name=s.anonymous_name
      and coalesce(nullif(followed.story_arc_id::text,''),followed.id::text)=s.story_arc_id::text))
 loop
  insert into public.email_delivery_queue(user_id,story_id,kind,due_at)
  values(recipient,s.id,kind_name,now()+case when kind_name='replies' then interval '1 hour' else interval '0 minutes' end)
  on conflict(user_id,story_id,kind) where status='pending' do update set event_count=public.email_delivery_queue.event_count+1;
 end loop;
 return new;
end $$;
drop trigger if exists locket_story_email on public.stories;
create trigger locket_story_email after insert on public.stories for each row execute function public.queue_locket_email();
drop trigger if exists locket_reply_email on public.comments;
create trigger locket_reply_email after insert on public.comments for each row execute function public.queue_locket_email();
revoke all on function public.queue_locket_email() from public, anon, authenticated;

create or replace function public.unsubscribe_locket_email(token text) returns void
language sql security definer set search_path='' as $$
 update public.email_delivery_preferences set story_updates=false,replies=false where unsubscribe_token=token and length(token)=64;
$$;
revoke all on function public.unsubscribe_locket_email(text) from public;
grant execute on function public.unsubscribe_locket_email(text) to anon,authenticated;

-- Claims are never automatically retried: an interrupted SMTP send may have succeeded.
create or replace function public.claim_locket_emails() returns table(id uuid, email text, token text, story_id uuid, kind text, event_count integer)
language sql security definer set search_path='' as $$
 with picked as (
 select q.id from public.email_delivery_queue q
 join public.email_delivery_preferences p on p.user_id=q.user_id
 join auth.users u on u.id=q.user_id
 join public.stories s on s.id=q.story_id
 where q.status='pending' and q.due_at<=now() and u.email_confirmed_at is not null and u.email is not null
 and case when q.kind='replies' then p.replies else p.story_updates end
 and not coalesce((to_jsonb(s)->>'is_hidden')::boolean,false)
 and not coalesce((to_jsonb(s)->>'is_private')::boolean,false)
 and not coalesce((to_jsonb(s)->>'is_diary_only')::boolean,false)
 and (q.kind='replies' or exists(select 1 from public.story_follows f join public.stories fs on fs.id::text=f.story_id::text where f.user_id::text=q.user_id::text and fs.anonymous_name=s.anonymous_name and coalesce(nullif(fs.story_arc_id::text,''),fs.id::text)=s.story_arc_id::text))
 order by q.due_at limit 20 for update of q skip locked
 ), claimed as (
 update public.email_delivery_queue q set status='claimed',claimed_at=now() from picked where q.id=picked.id returning q.*
 ) select c.id,u.email,p.unsubscribe_token,c.story_id,c.kind,c.event_count from claimed c join auth.users u on u.id=c.user_id join public.email_delivery_preferences p on p.user_id=c.user_id;
$$;
revoke all on function public.claim_locket_emails() from public,anon,authenticated;
grant execute on function public.claim_locket_emails() to service_role;

create or replace function public.locket_email_still_allowed(job_id uuid) returns boolean
language sql security definer set search_path='' as $$
 select exists(select 1 from public.email_delivery_queue q
 join public.email_delivery_preferences p on p.user_id=q.user_id
 join public.stories s on s.id=q.story_id
 join auth.users u on u.id=q.user_id
 where q.id=job_id and q.status='claimed' and u.email_confirmed_at is not null
 and case when q.kind='replies' then p.replies else p.story_updates end
 and not coalesce((to_jsonb(s)->>'is_hidden')::boolean,false)
 and not coalesce((to_jsonb(s)->>'is_private')::boolean,false)
 and not coalesce((to_jsonb(s)->>'is_diary_only')::boolean,false)
 and (q.kind='replies' or exists(select 1 from public.story_follows f join public.stories fs on fs.id::text=f.story_id::text where f.user_id::text=q.user_id::text and fs.anonymous_name=s.anonymous_name and coalesce(nullif(fs.story_arc_id::text,''),fs.id::text)=s.story_arc_id::text)));
$$;
revoke all on function public.locket_email_still_allowed(uuid) from public,anon,authenticated;
grant execute on function public.locket_email_still_allowed(uuid) to service_role;

-- Discard pending mail when a choice is turned off; re-enabling never sends old mail.
create or replace function public.clear_disabled_locket_emails() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 delete from public.email_delivery_queue where user_id=new.user_id and status='pending'
 and ((kind='replies' and not new.replies) or (kind='story_updates' and not new.story_updates));
 return new;
end $$;
revoke all on function public.clear_disabled_locket_emails() from public,anon,authenticated;
drop trigger if exists clear_disabled_locket_emails on public.email_delivery_preferences;
create trigger clear_disabled_locket_emails after update on public.email_delivery_preferences for each row execute function public.clear_disabled_locket_emails();
