-- Run in Supabase SQL Editor BEFORE deploying this feature.
-- Existing posts stay Anything welcome. No comments or reactions are deleted.
begin;
alter table public.stories add column if not exists response_mode text not null default 'anything'
  check (response_mode in ('listen', 'comfort', 'advice', 'anything'));

create or replace function public.enforce_story_response_preferences()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.response_mode is distinct from old.response_mode
     and current_user not in ('postgres', 'supabase_admin')
     and coalesce(auth.role(), '') <> 'service_role' then
    if auth.uid() is null or not coalesce((
      old.user_id = auth.uid()
      or (old.user_id is null and exists (
        select 1 from public.users where id = auth.uid() and username = old.anonymous_name
      ))
    ), false) then
      raise exception 'Only the author can change the response preference.' using errcode = '42501';
    end if;
  end if;
  if new.reactions is distinct from old.reactions then
    if new.response_mode = 'listen' then
      raise exception 'Reactions are closed for this story.' using errcode = '42501';
    elsif new.response_mode = 'comfort'
      and (coalesce(new.reactions, '{}'::jsonb) - 'Here for you')
        is distinct from (coalesce(old.reactions, '{}'::jsonb) - 'Here for you') then
      raise exception 'Only supportive reactions are available.' using errcode = '42501';
    elsif new.response_mode = 'advice'
      and (coalesce(new.reactions, '{}'::jsonb) - 'Here for you' - 'Team OP')
        is distinct from (coalesce(old.reactions, '{}'::jsonb) - 'Here for you' - 'Team OP') then
      raise exception 'Only supportive reactions are available.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists story_response_preferences on public.stories;
create trigger story_response_preferences before update on public.stories
  for each row execute function public.enforce_story_response_preferences();

create or replace function public.enforce_comment_response_preferences()
returns trigger language plpgsql set search_path = public as $$
declare mode text;
begin
  -- Lock against a concurrent preference change while accepting the comment.
  select response_mode into mode from public.stories where id = new.story_id for share;
  if mode = 'listen' then
    raise exception 'Replies are closed for this story.' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists comment_response_preferences on public.comments;
create trigger comment_response_preferences before insert or update on public.comments
  for each row execute function public.enforce_comment_response_preferences();
commit;
