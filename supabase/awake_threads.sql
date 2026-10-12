-- Complete Everyone’s Awake setup. Safe to rerun; no existing posts are deleted.
begin;
create table if not exists public.host_invite_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false
);
alter table public.host_invite_preferences enable row level security;
revoke all on public.host_invite_preferences from anon;
grant select, insert, update on public.host_invite_preferences to authenticated;
grant all on public.host_invite_preferences to service_role;
drop policy if exists own_host_preferences on public.host_invite_preferences;
create policy own_host_preferences on public.host_invite_preferences for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Private delivery journal. One claim per night and one invitation per account.
create table if not exists public.host_invitations (
  night date primary key,
  user_id uuid not null unique references auth.users(id),
  username text not null,
  state text not null default 'claimed' check (state in ('claimed','sending','sent','failed','uncertain')),
  claimed_at timestamptz not null default now(),
  sent_at timestamptz
);
alter table public.host_invitations enable row level security;
revoke all on public.host_invitations from public, anon, authenticated;
grant all on public.host_invitations to service_role;

create or replace function public.claim_host_invitation(p_night date, p_first_username text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare candidate record; first_run boolean;
begin
  -- Serializes concurrent jobs; persisted claims prevent re-sends after retries.
  perform pg_advisory_xact_lock(8317126);
  if p_night <> (now() at time zone 'America/Toronto')::date then
    raise exception 'Invitations may only be selected for the current Toronto date';
  end if;
  if exists(select 1 from public.host_invitations where night = p_night) then return null; end if;
  first_run := not exists(select 1 from public.host_invitations);
  select u.id, u.username, a.email into candidate
    from public.users u join auth.users a on a.id = u.id
    left join public.host_invite_preferences pref on pref.user_id = u.id
    where a.email is not null and a.email_confirmed_at is not null
      and (a.banned_until is null or a.banned_until < now())
      and not exists(select 1 from public.host_invitations i where i.user_id = u.id)
      and (case when first_run and p_first_username is not null then u.username = p_first_username
                else coalesce(pref.enabled, false) end)
      and (
        exists(select 1 from public.stories s where s.anonymous_name = u.username
          and (s.user_id is null or s.user_id = u.id) and not coalesce(s.is_hidden,false)
          and not coalesce(s.is_private,false) and not coalesce(s.is_diary_only,false))
        or exists(select 1 from public.comments c join public.stories s on s.id = c.story_id
          where c.anonymous_name = u.username and not coalesce(s.is_hidden,false)
          and not coalesce(s.is_private,false) and not coalesce(s.is_diary_only,false))
      )
    order by random() limit 1;
  if candidate.id is null then return null; end if;
  insert into public.host_invitations(night,user_id,username) values(p_night,candidate.id,candidate.username);
  return jsonb_build_object('night',p_night,'user_id',candidate.id,'username',candidate.username,'email',candidate.email,'first',first_run);
end $$;
revoke execute on function public.claim_host_invitation(date,text) from public, anon, authenticated;
grant execute on function public.claim_host_invitation(date,text) to service_role;

alter table public.host_invitations add column if not exists token_digest text unique;
alter table public.host_invitations add column if not exists expires_at timestamptz;
alter table public.host_invitations add column if not exists prompt text;
alter table public.host_invitations add column if not exists submitted_at timestamptz;
alter table public.host_invitations add column if not exists reviewed_at timestamptz;
alter table public.host_invitations add column if not exists review_state text not null default 'pending';
create table if not exists public.awake_nights (
  night date primary key,
  prompt text not null check(char_length(prompt) between 1 and 180),
  host_username text not null,
  published_at timestamptz not null default now()
);
create table if not exists public.awake_replies (
  id uuid primary key default gen_random_uuid(),
  night date not null references public.awake_nights(night),
  user_id uuid not null references auth.users(id),
  username text not null,
  body text not null check(char_length(body) between 1 and 1400),
  created_at timestamptz not null default now()
);
create index if not exists awake_replies_night_idx on public.awake_replies(night,created_at);
create index if not exists awake_replies_user_idx on public.awake_replies(user_id,created_at);
alter table public.awake_nights enable row level security;
alter table public.awake_replies enable row level security;
revoke all on public.awake_nights, public.awake_replies from public,anon,authenticated;
grant select on public.awake_nights to anon,authenticated;
grant select (id,night,username,body,created_at) on public.awake_replies to anon,authenticated;
grant all on public.awake_nights, public.awake_replies to service_role;
drop policy if exists read_awake_nights on public.awake_nights;
create policy read_awake_nights on public.awake_nights for select to anon,authenticated using(true);
drop policy if exists read_awake_replies on public.awake_replies;
create policy read_awake_replies on public.awake_replies for select to anon,authenticated using(true);

create or replace function public.submit_awake_prompt(p_digest text,p_prompt text)
returns boolean language plpgsql security definer set search_path='' as $$
declare affected integer;
begin
 if char_length(p_prompt) not between 1 and 180 then return false; end if;
 update public.host_invitations set prompt=p_prompt,submitted_at=now()
 where token_digest=p_digest and expires_at>now() and prompt is null
 and state in ('sent','sending','uncertain') and review_state='pending';
 get diagnostics affected=row_count;
 return affected=1;
end $$;
revoke execute on function public.submit_awake_prompt(text,text) from public,anon,authenticated;
grant execute on function public.submit_awake_prompt(text,text) to service_role;

create or replace function public.review_awake_prompt(p_night date,p_approve boolean)
returns boolean language plpgsql security definer set search_path='' as $$
declare invitation record;
begin
 select * into invitation from public.host_invitations where night=p_night for update;
 if invitation.prompt is null or invitation.review_state<>'pending' then return false; end if;
 if p_approve then
   insert into public.awake_nights(night,prompt,host_username)
   values(p_night,invitation.prompt,invitation.username) on conflict do nothing;
   if not found then return false; end if;
 end if;
 update public.host_invitations set reviewed_at=now(),review_state=case when p_approve then 'approved' else 'declined' end where night=p_night;
 return true;
end $$;
revoke execute on function public.review_awake_prompt(date,boolean) from public,anon,authenticated;
grant execute on function public.review_awake_prompt(date,boolean) to service_role;

-- Rate limit and insertion share a lock so concurrent requests cannot bypass it.
create or replace function public.add_awake_reply(p_user_id uuid,p_night date,p_body text)
returns uuid language plpgsql security definer set search_path='' as $$
declare display_name text;reply_id uuid;
begin
 if char_length(p_body) not between 1 and 1400 then raise exception 'Invalid reply'; end if;
 perform pg_advisory_xact_lock(hashtext(p_user_id::text));
 if (select count(*) from public.awake_replies where user_id=p_user_id and created_at>now()-interval '1 hour')>=10 then
  raise exception 'Please take a little break before replying again';
 end if;
 select username into display_name from public.users where id=p_user_id;
 if display_name is null then raise exception 'Account not found'; end if;
 insert into public.awake_replies(night,user_id,username,body) values(p_night,p_user_id,display_name,p_body) returning id into reply_id;
 return reply_id;
end $$;
revoke execute on function public.add_awake_reply(uuid,date,text) from public,anon,authenticated;
grant execute on function public.add_awake_reply(uuid,date,text) to service_role;
commit;
