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
commit;
