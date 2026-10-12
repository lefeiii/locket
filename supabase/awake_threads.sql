begin;
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
