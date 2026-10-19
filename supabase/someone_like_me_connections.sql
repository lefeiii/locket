-- Stage 2, run AFTER someone_like_me.sql. Gated by default; never opens live chats by installation.
begin;
create table if not exists public.slm_contact_config (
 id boolean primary key default true check(id), enabled boolean not null default false,
 age_assurance_ready boolean not null default false, age_process_reference text,
 coverage_confirmed_at timestamptz, coverage_until timestamptz,
 check(age_process_reference is null or length(age_process_reference) between 1 and 100)
);
insert into public.slm_contact_config(id) values(true) on conflict do nothing;
create table if not exists public.slm_contact_consents (
 user_id uuid primary key references public.slm_enrollments(user_id) on delete cascade,
 version text not null default 'slm-contact-v1' check(version='slm-contact-v1'), consented_at timestamptz not null default now()
);
create table if not exists public.slm_age_assurance (
 user_id uuid primary key references public.slm_contact_consents(user_id) on delete cascade,
 checked_band text not null check(checked_band in ('13_15','16_17','18_plus')),
 checked_by uuid references auth.users(id) on delete set null,
 checked_at timestamptz not null default now(), valid_until timestamptz not null,
 evidence_reference text not null check(length(evidence_reference) between 6 and 100)
);
create table if not exists public.slm_introductions (
 id uuid primary key default gen_random_uuid(),
 user_a uuid not null references public.slm_enrollments(user_id) on delete cascade,
 user_b uuid not null references public.slm_enrollments(user_id) on delete cascade,
 a_version timestamptz not null,b_version timestamptz not null,
 shared_topics text[] not null, proposed_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '7 days',
 a_accept_at timestamptz,b_accept_at timestamptz,
 state text not null default 'invited' check(state in ('invited','open','paused','closed')),
 opened_at timestamptz, closed_at timestamptz,
 check(user_a<user_b), unique(user_a,user_b)
);
create table if not exists public.slm_contact_blocks (
 blocker uuid not null references auth.users(id) on delete cascade,
 blocked uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(), primary key(blocker,blocked),check(blocker<>blocked)
);
create table if not exists public.slm_messages (
 id uuid primary key default gen_random_uuid(),intro_id uuid not null references public.slm_introductions(id) on delete cascade,
 author_id uuid not null references auth.users(id) on delete cascade,
 body text not null check(length(body) between 1 and 800),
 status text not null default 'pending' check(status in ('pending','approved','rejected','quarantined')),
 urgent boolean not null default false, created_at timestamptz not null default now(),
 reviewed_at timestamptz,reviewed_by uuid references auth.users(id) on delete set null
);
create table if not exists public.slm_contact_reports (
 id uuid primary key default gen_random_uuid(),intro_id uuid references public.slm_introductions(id) on delete set null,
 reporter_id uuid not null references auth.users(id) on delete cascade,
 subject_id uuid not null references auth.users(id) on delete cascade,
 message_id uuid references public.slm_messages(id) on delete set null,
 evidence_body text check(evidence_body is null or length(evidence_body)<=800),
 reason text not null check(reason in ('privacy','harassment','unwanted_contact','urgent_safety','other')),
 created_at timestamptz not null default now(),closed_at timestamptz,closed_by uuid references auth.users(id) on delete set null
);
create table if not exists public.slm_contact_feedback (
 intro_id uuid not null references public.slm_introductions(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 understood text not null check(understood in ('yes','somewhat','no')),
 created_at timestamptz not null default now(), primary key(intro_id,user_id)
);
create table if not exists public.slm_contact_audit (
 id uuid primary key default gen_random_uuid(),intro_id uuid references public.slm_introductions(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null,event text not null,
 created_at timestamptz not null default now()
);
alter table public.slm_contact_config enable row level security;
alter table public.slm_contact_consents enable row level security;
alter table public.slm_age_assurance enable row level security;
alter table public.slm_introductions enable row level security;
alter table public.slm_contact_blocks enable row level security;
alter table public.slm_messages enable row level security;
alter table public.slm_contact_reports enable row level security;
alter table public.slm_contact_feedback enable row level security;
alter table public.slm_contact_audit enable row level security;
revoke all on public.slm_contact_config,public.slm_contact_consents,public.slm_age_assurance,public.slm_introductions,public.slm_contact_blocks,public.slm_messages,public.slm_contact_reports,public.slm_contact_feedback,public.slm_contact_audit from public,anon,authenticated;
grant all on public.slm_contact_config,public.slm_contact_consents,public.slm_age_assurance,public.slm_introductions,public.slm_contact_blocks,public.slm_messages,public.slm_contact_reports,public.slm_contact_feedback,public.slm_contact_audit to service_role;

create or replace function public.slm_contact_open() returns boolean
language sql stable security definer set search_path='' as $$
 select public.slm_pilot_open() and exists(select 1 from public.slm_contact_config where id and enabled and age_assurance_ready
 and length(age_process_reference)>0 and coverage_confirmed_at<=now() and coverage_until>now() and coverage_until<=coverage_confirmed_at+interval '24 hours');
$$;
create or replace function public.slm_pair_valid(pair_uuid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select public.slm_contact_open() and exists(
 select 1 from public.slm_introductions i
 join public.slm_enrollments a on a.user_id=i.user_a join public.slm_enrollments b on b.user_id=i.user_b
 join public.slm_contact_consents ca on ca.user_id=a.user_id join public.slm_contact_consents cb on cb.user_id=b.user_id
 join public.slm_age_assurance aa on aa.user_id=a.user_id join public.slm_age_assurance ab on ab.user_id=b.user_id
 where i.id=pair_uuid and a.review_status='reviewed_waitlist' and b.review_status='reviewed_waitlist'
 and a.updated_at=i.a_version and b.updated_at=i.b_version and aa.checked_band=ab.checked_band
 and aa.checked_band=a.age_band and ab.checked_band=b.age_band and aa.valid_until>now() and ab.valid_until>now()
 and exists(select 1 from public.slm_moderators where user_id=aa.checked_by) and exists(select 1 from public.slm_moderators where user_id=ab.checked_by)
 and not exists(select 1 from public.slm_contact_blocks x where (x.blocker=i.user_a and x.blocked=i.user_b) or (x.blocker=i.user_b and x.blocked=i.user_a)));
$$;
create or replace function public.slm_contact_compatible(receiver uuid,peer uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.slm_enrollments a join public.slm_enrollments b on b.user_id=peer where a.user_id=receiver and (
 (a.connection_preference in ('now','both') and b.experience_stage in ('going_through','both')) or
 (a.connection_preference in ('been_through','both') and b.experience_stage in ('been_through','both') and b.offer_encouragement)));
$$;
create or replace function public.slm_contact_has_identifiers(message_text text) returns boolean
language sql immutable set search_path='' as $$
 select coalesce(message_text ~* '(https?://|www[.]|@[[:alnum:]_]|[[:alnum:]-]+[.](com|net|org|io|app|me)([ /]|$))',false)
 or length(regexp_replace(coalesce(message_text,''),'[^0-9]','','g'))>=7;
$$;

create or replace function public.slm_contact_state() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501';end if;
 return jsonb_build_object('enabled',public.slm_contact_open(),
 'enrolled',exists(select 1 from public.slm_enrollments where user_id=auth.uid()),
 'opted_in',exists(select 1 from public.slm_contact_consents where user_id=auth.uid()),
 'age_checked',exists(select 1 from public.slm_age_assurance v join public.slm_enrollments e using(user_id) where v.user_id=auth.uid() and v.valid_until>now() and v.checked_band=e.age_band),
 'connections',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'topics',i.shared_topics,'state',case when i.state='invited' and i.expires_at<=now() then 'expired' else i.state end,
 'my_accepted',case when auth.uid()=i.user_a then i.a_accept_at is not null else i.b_accept_at is not null end,
 'opened',i.opened_at is not null,'expires_at',i.expires_at,'ready',public.slm_pair_valid(i.id)) order by i.created_at desc)
 from public.slm_introductions i where auth.uid() in (i.user_a,i.user_b)),'[]'::jsonb));
end $$;
create or replace function public.slm_contact_optin(consent boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501';end if;
 if consent is distinct from true then raise exception 'Explicit new contact consent required' using errcode='22023';end if;
 if not public.slm_pilot_open() or not exists(select 1 from public.slm_enrollments where user_id=auth.uid() and review_status<>'paused') then raise exception 'Active waitlist participation required' using errcode='42501';end if;
 insert into public.slm_contact_consents(user_id) values(auth.uid()) on conflict do nothing;
end $$;
create or replace function public.slm_contact_withdraw() returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501';end if;
 delete from public.slm_introductions where auth.uid() in (user_a,user_b);
 delete from public.slm_contact_consents where user_id=auth.uid();
 -- Blocks and reported evidence remain restricted for safety; ordinary messages cascade away.
end $$;

create or replace function public.slm_attest_age(participant uuid,checked_band text,expires timestamptz,evidence_ref text,externally_checked boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.slm_is_moderator() then raise exception 'Moderator required' using errcode='42501';end if;
 if participant=auth.uid() then raise exception 'A moderator cannot check their own age' using errcode='42501';end if;
 if not exists(select 1 from public.slm_contact_config where id and age_assurance_ready and length(age_process_reference)>0) then raise exception 'An external age-assurance process must be configured first' using errcode='22023';end if;
 if externally_checked is distinct from true or checked_band is null or checked_band not in ('13_15','16_17','18_plus') or expires is null or expires<=now() or expires>now()+interval '30 days'
 or evidence_ref is null or evidence_ref !~ '^[A-Za-z0-9_-]{6,100}$' then raise exception 'Valid external evidence reference, checked band and expiry required' using errcode='22023';end if;
 if not exists(select 1 from public.slm_enrollments e join public.slm_contact_consents c using(user_id) where e.user_id=participant and e.age_band=checked_band) then raise exception 'New contact consent and consistent age band required' using errcode='22023';end if;
 insert into public.slm_age_assurance(user_id,checked_band,checked_by,valid_until,evidence_reference) values(participant,checked_band,auth.uid(),expires,evidence_ref)
 on conflict(user_id) do update set checked_band=excluded.checked_band,checked_by=excluded.checked_by,checked_at=now(),valid_until=excluded.valid_until,evidence_reference=excluded.evidence_reference;
end $$;
drop function if exists public.slm_propose_introduction(uuid,uuid,boolean);
create or replace function public.slm_propose_introduction(first_user uuid,second_user uuid,review_confirmed boolean,first_version timestamptz,second_version timestamptz) returns uuid
language plpgsql security definer set search_path='' as $$
declare a uuid;b uuid;av public.slm_enrollments;bv public.slm_enrollments;shared text[];pair_id uuid;
begin
 if not public.slm_is_moderator() then raise exception 'Moderator required' using errcode='42501';end if;
 if not public.slm_contact_open() then raise exception 'Introductions are disabled or coverage has expired' using errcode='22023';end if;
 if review_confirmed is distinct from true or first_user is null or second_user is null or first_user=second_user then raise exception 'Two independently reviewed participants required' using errcode='22023';end if;
 if auth.uid() in(first_user,second_user) then raise exception 'Independent introduction reviewer required' using errcode='42501';end if;
 a:=least(first_user,second_user);b:=greatest(first_user,second_user);
 perform pg_advisory_xact_lock(hashtext(a::text));perform pg_advisory_xact_lock(hashtext(b::text));
 select * into av from public.slm_enrollments where user_id=a;select * into bv from public.slm_enrollments where user_id=b;
 if first_version is null or second_version is null
 or (case when first_user=a then av.updated_at else bv.updated_at end) is distinct from first_version
 or (case when second_user=b then bv.updated_at else av.updated_at end) is distinct from second_version
 then raise exception 'Participant choices changed; refresh and review again' using errcode='22023';end if;
 select array_agg(t) into shared from (select unnest(av.topics) intersect select unnest(bv.topics)) x(t);
 if shared is null or not public.slm_contact_compatible(a,b) or not public.slm_contact_compatible(b,a) then raise exception 'Shared topics and compatible volunteered preferences required' using errcode='22023';end if;
 if exists(select 1 from public.slm_introductions where (a in(user_a,user_b) or b in(user_a,user_b)) and (state in ('open','paused') or (state='invited' and expires_at>now()))) then raise exception 'Only one active introduction per participant in this pilot' using errcode='22023';end if;
 if exists(select 1 from public.slm_introductions where (a in(user_a,user_b) or b in(user_a,user_b)) and created_at>now()-interval '7 days') then raise exception 'At most one new introduction per participant every seven days' using errcode='22023';end if;
 insert into public.slm_introductions(user_a,user_b,a_version,b_version,shared_topics,proposed_by) values(a,b,av.updated_at,bv.updated_at,shared,auth.uid()) returning id into pair_id;
 if not public.slm_pair_valid(pair_id) then raise exception 'Both participants need current external age checks in the same age band, fresh consent, reviewed entries and no block' using errcode='22023';end if;
 insert into public.slm_contact_audit(intro_id,actor_id,event) values(pair_id,auth.uid(),'proposed');
 return pair_id;
end $$;
create or replace function public.slm_respond_introduction(pair_uuid uuid,choice text,conversation_consent boolean) returns void
language plpgsql security definer set search_path='' as $$
declare i public.slm_introductions;
begin
 select * into i from public.slm_introductions where id=pair_uuid for update;
 if auth.uid() is null or i.id is null or auth.uid() not in(i.user_a,i.user_b) then raise exception 'Introduction not available' using errcode='42501';end if;
 if choice is null or choice not in ('accept','decline') then raise exception 'Choose accept or decline' using errcode='22023';end if;
 if i.state<>'invited' then raise exception 'Introduction is no longer awaiting a response' using errcode='22023';end if;
 if choice='decline' then update public.slm_introductions set state='closed',closed_at=now() where id=i.id;
 else
  if conversation_consent is distinct from true or i.expires_at<=now() or not public.slm_pair_valid(i.id) then raise exception 'Fresh individual consent and current safeguards required' using errcode='22023';end if;
  if (auth.uid()=i.user_a and i.a_accept_at is not null) or (auth.uid()=i.user_b and i.b_accept_at is not null) then return;end if;
  update public.slm_introductions set a_accept_at=case when user_a=auth.uid() then coalesce(a_accept_at,now()) else a_accept_at end,
   b_accept_at=case when user_b=auth.uid() then coalesce(b_accept_at,now()) else b_accept_at end where id=i.id;
  update public.slm_introductions set state='open',opened_at=now() where id=i.id and a_accept_at is not null and b_accept_at is not null;
 end if;
 insert into public.slm_contact_audit(intro_id,actor_id,event) values(i.id,auth.uid(),choice);
end $$;

create or replace function public.slm_conversation(pair_uuid uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare i public.slm_introductions;
begin
 select * into i from public.slm_introductions where id=pair_uuid;
 if auth.uid() is null or i.id is null or auth.uid() not in(i.user_a,i.user_b) or i.opened_at is null then raise exception 'Conversation not available' using errcode='42501';end if;
 return jsonb_build_object('id',i.id,'state',i.state,'topics',i.shared_topics,'can_send',i.state='open' and public.slm_pair_valid(i.id),
 'feedback',(select understood from public.slm_contact_feedback where intro_id=i.id and user_id=auth.uid()),
 'messages',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'body',m.body,'from_me',m.author_id=auth.uid(),'status',m.status,'created_at',m.created_at) order by m.created_at,m.id)
 from public.slm_messages m where m.intro_id=i.id and (m.author_id=auth.uid() or m.status='approved')),'[]'::jsonb));
end $$;
create or replace function public.slm_send_message(pair_uuid uuid,message_text text) returns void
language plpgsql security definer set search_path='' as $$
declare i public.slm_introductions;clean text:=btrim(message_text);
begin
 select * into i from public.slm_introductions where id=pair_uuid for update;
 if auth.uid() is null or i.id is null or auth.uid() not in(i.user_a,i.user_b) then raise exception 'Conversation not available' using errcode='42501';end if;
 if i.state<>'open' or not public.slm_pair_valid(i.id) then raise exception 'Conversation is paused, closed or not ready' using errcode='22023';end if;
 if clean is null or length(clean) not between 1 and 800 or public.slm_contact_has_identifiers(clean) then raise exception 'Use 1-800 characters without links, handles or contact details' using errcode='22023';end if;
 if (select count(*) from public.slm_messages where intro_id=i.id and author_id=auth.uid() and status='pending')>=2
 or (select count(*) from public.slm_messages where author_id=auth.uid() and created_at>now()-interval '1 hour')>=10 then raise exception 'Please wait for review before sending more' using errcode='22023';end if;
 insert into public.slm_messages(intro_id,author_id,body,urgent) values(i.id,auth.uid(),clean,clean ~* '(kill myself|end my life|suicid|hurt myself|immediate danger)');
end $$;
create or replace function public.slm_review_message(message_uuid uuid,decision text) returns void
language plpgsql security definer set search_path='' as $$
declare m public.slm_messages;i public.slm_introductions;
begin
 if not public.slm_is_moderator() then raise exception 'Moderator required' using errcode='42501';end if;
 select * into m from public.slm_messages where id=message_uuid;
 select * into i from public.slm_introductions where id=m.intro_id for update;
 select * into m from public.slm_messages where id=message_uuid for update;
 if m.id is null or m.status<>'pending' or decision is null or decision not in ('approve','reject','hold_safety') then raise exception 'Pending message and valid review decision required' using errcode='22023';end if;
 if auth.uid() in(i.user_a,i.user_b) then raise exception 'Participants cannot moderate their own conversation' using errcode='42501';end if;
 if decision='approve' and (m.urgent or i.state<>'open' or not public.slm_pair_valid(i.id) or public.slm_contact_has_identifiers(m.body)) then raise exception 'Cannot deliver: safety hold, contact details or current safeguards missing' using errcode='22023';end if;
 update public.slm_messages set status=case when decision='approve' then 'approved' when decision='reject' then 'rejected' else 'quarantined' end,reviewed_at=now(),reviewed_by=auth.uid() where id=m.id;
 if decision='hold_safety' then update public.slm_introductions set state='paused' where id=i.id and state='open';end if;
 insert into public.slm_contact_audit(intro_id,actor_id,event) values(i.id,auth.uid(),'message_'||decision);
end $$;

create or replace function public.slm_report_contact(pair_uuid uuid,message_uuid uuid,reason_choice text) returns void
language plpgsql security definer set search_path='' as $$
declare i public.slm_introductions;m public.slm_messages;peer uuid;
begin
 select * into i from public.slm_introductions where id=pair_uuid for update;
 if auth.uid() is null or i.id is null or auth.uid() not in(i.user_a,i.user_b) or i.opened_at is null then raise exception 'Conversation not available' using errcode='42501';end if;
 if reason_choice is null or reason_choice not in ('privacy','harassment','unwanted_contact','urgent_safety','other') then raise exception 'Choose a report reason' using errcode='22023';end if;
 if (select count(*) from public.slm_contact_reports where reporter_id=auth.uid() and created_at>now()-interval '1 day')>=5 then raise exception 'Report limit reached; you can still block or leave' using errcode='22023';end if;
 peer:=case when auth.uid()=i.user_a then i.user_b else i.user_a end;
 if message_uuid is not null then
  select * into m from public.slm_messages where id=message_uuid and intro_id=i.id and author_id=peer and status='approved';
  if m.id is null then raise exception 'Only a received message from this conversation can be reported' using errcode='42501';end if;
 end if;
 insert into public.slm_contact_reports(intro_id,reporter_id,subject_id,message_id,evidence_body,reason) values(i.id,auth.uid(),peer,m.id,m.body,reason_choice);
 if m.id is not null then update public.slm_messages set status='quarantined' where id=m.id;end if;
 update public.slm_introductions set state='paused' where id=i.id and state='open';
 insert into public.slm_contact_audit(intro_id,actor_id,event) values(i.id,auth.uid(),'reported');
end $$;
create or replace function public.slm_end_contact(pair_uuid uuid,block_peer boolean) returns void
language plpgsql security definer set search_path='' as $$
declare i public.slm_introductions;peer uuid;
begin
 select * into i from public.slm_introductions where id=pair_uuid for update;
 if auth.uid() is null or i.id is null or auth.uid() not in(i.user_a,i.user_b) then raise exception 'Introduction not available' using errcode='42501';end if;
 peer:=case when auth.uid()=i.user_a then i.user_b else i.user_a end;
 if block_peer is true then insert into public.slm_contact_blocks(blocker,blocked) values(auth.uid(),peer) on conflict do nothing;end if;
 update public.slm_introductions set state='closed',closed_at=now() where id=i.id;
 update public.slm_messages set status='rejected',reviewed_at=now() where intro_id=i.id and status='pending';
 insert into public.slm_contact_audit(intro_id,actor_id,event) values(i.id,auth.uid(),case when block_peer then 'blocked' else 'left' end);
end $$;
create or replace function public.slm_contact_feedback_save(pair_uuid uuid,answer text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.slm_introductions where id=pair_uuid and auth.uid() in(user_a,user_b) and opened_at is not null) then raise exception 'Conversation not available' using errcode='42501';end if;
 if answer is null or answer not in ('yes','somewhat','no') then raise exception 'Choose valid feedback' using errcode='22023';end if;
 insert into public.slm_contact_feedback(intro_id,user_id,understood) values(pair_uuid,auth.uid(),answer) on conflict(intro_id,user_id) do update set understood=excluded.understood;
end $$;

create or replace function public.slm_resolve_contact_report(report_uuid uuid,decision text) returns void
language plpgsql security definer set search_path='' as $$
declare r public.slm_contact_reports;i public.slm_introductions;
begin
 if not public.slm_is_moderator() then raise exception 'Moderator required' using errcode='42501';end if;
 select * into r from public.slm_contact_reports where id=report_uuid;
 if r.id is null or r.closed_at is not null or decision is null or decision not in ('keep_paused','end','resume') then raise exception 'Open report and valid decision required' using errcode='22023';end if;
 if auth.uid() in(r.reporter_id,r.subject_id) then raise exception 'Independent moderator required' using errcode='42501';end if;
 select * into i from public.slm_introductions where id=r.intro_id for update;
 update public.slm_contact_reports set closed_at=now(),closed_by=auth.uid() where id=r.id and closed_at is null;
 if not found then raise exception 'Report changed; refresh' using errcode='22023';end if;
 if decision='resume' then
  if r.reason='urgent_safety' or i.id is null or i.state<>'paused' or not public.slm_pair_valid(i.id) or exists(select 1 from public.slm_contact_reports where intro_id=i.id and closed_at is null)
  or exists(select 1 from public.slm_messages where intro_id=i.id and status='quarantined' and urgent) then raise exception 'Cannot resume: unresolved safeguards or urgent safety hold' using errcode='22023';end if;
  update public.slm_introductions set state='open' where id=i.id;
 elsif decision='end' then update public.slm_introductions set state='closed',closed_at=now() where id=i.id;
 end if;
 insert into public.slm_contact_audit(intro_id,actor_id,event) values(i.id,auth.uid(),'report_'||decision);
end $$;

create or replace function public.slm_moderate_conversation(pair_uuid uuid,decision text) returns void
language plpgsql security definer set search_path='' as $$
declare i public.slm_introductions;
begin
 if not public.slm_is_moderator() then raise exception 'Moderator required' using errcode='42501';end if;
 select * into i from public.slm_introductions where id=pair_uuid for update;
 if i.id is null or auth.uid() in(i.user_a,i.user_b) then raise exception 'Independent moderator and existing introduction required' using errcode='42501';end if;
 if decision is null or decision not in ('pause','end') then raise exception 'Choose pause or end' using errcode='22023';end if;
 if decision='pause' then update public.slm_introductions set state='paused' where id=i.id and state='open';
 else update public.slm_introductions set state='closed',closed_at=now() where id=i.id;
 update public.slm_messages set status='rejected',reviewed_at=now(),reviewed_by=auth.uid() where intro_id=i.id and status='pending';end if;
 insert into public.slm_contact_audit(intro_id,actor_id,event) values(i.id,auth.uid(),'moderator_'||decision);
end $$;

create or replace function public.slm_contact_review() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.slm_is_moderator() then raise exception 'Moderator required' using errcode='42501';end if;
 return jsonb_build_object('enabled',public.slm_contact_open(),
 'participants',coalesce((select jsonb_agg(jsonb_build_object('id',e.user_id,'age_band',e.age_band,'review_status',e.review_status,'updated_at',e.updated_at,'topics',e.topics,'connection',e.connection_preference,'stage',e.experience_stage,'offers_encouragement',e.offer_encouragement,
 'contact_consent',c.user_id is not null,'age_checked',a.valid_until>now() and a.checked_band=e.age_band,'age_expires',a.valid_until)) from public.slm_enrollments e left join public.slm_contact_consents c using(user_id) left join public.slm_age_assurance a using(user_id)),'[]'::jsonb),
 'introductions',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'user_a',i.user_a,'user_b',i.user_b,'state',i.state,'opened_at',i.opened_at,'expires_at',i.expires_at) order by i.created_at desc) from public.slm_introductions i where auth.uid() not in(i.user_a,i.user_b)),'[]'::jsonb),
 'pending_messages',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'intro_id',m.intro_id,'body',m.body,'urgent',m.urgent,'created_at',m.created_at) order by m.urgent desc,m.created_at) from public.slm_messages m where m.status='pending' and not exists(select 1 from public.slm_introductions own where own.id=m.intro_id and auth.uid() in(own.user_a,own.user_b))),'[]'::jsonb),
 'reports',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'intro_id',r.intro_id,'reason',r.reason,'evidence',r.evidence_body,'created_at',r.created_at) order by (r.reason='urgent_safety') desc,r.created_at) from public.slm_contact_reports r where r.closed_at is null and auth.uid() not in(r.reporter_id,r.subject_id)),'[]'::jsonb),
 'metrics',jsonb_build_object('proposed',(select count(*) from public.slm_introductions),'mutually_accepted',(select count(*) from public.slm_introductions where opened_at is not null),
 'understood',(select coalesce(jsonb_object_agg(understood,n),'{}'::jsonb) from(select understood,count(*) n from public.slm_contact_feedback group by 1)x),
 'reports',(select count(*) from public.slm_contact_reports),'unwanted_contact',(select count(*) from public.slm_contact_reports where reason='unwanted_contact')));
end $$;

-- Changing selections/review state revokes existing introductions. New consent is
-- required before a moderator can ever introduce a different pair.
create or replace function public.slm_contact_enrollment_changed() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.updated_at is distinct from old.updated_at then
  update public.slm_introductions set state='closed',closed_at=now() where new.user_id in(user_a,user_b) and state<>'closed';
 end if;return new;
end $$;
drop trigger if exists slm_contact_enrollment_changed on public.slm_enrollments;
create trigger slm_contact_enrollment_changed after update on public.slm_enrollments for each row execute function public.slm_contact_enrollment_changed();
create or replace function public.slm_contact_profile_deleted() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 delete from public.slm_contact_reports where reporter_id::text=old.id::text or subject_id::text=old.id::text;
 delete from public.slm_contact_blocks where blocker::text=old.id::text or blocked::text=old.id::text;
 return old;
end $$;
drop trigger if exists slm_contact_profile_deleted on public.users;
create trigger slm_contact_profile_deleted after delete on public.users for each row execute function public.slm_contact_profile_deleted();

-- Keep helper functions and triggers private; no direct table policies grant access.
revoke all on function public.slm_contact_open(),public.slm_pair_valid(uuid),public.slm_contact_compatible(uuid,uuid),public.slm_contact_has_identifiers(text),public.slm_contact_enrollment_changed(),public.slm_contact_profile_deleted() from public,anon,authenticated;
revoke all on function public.slm_contact_state(),public.slm_contact_optin(boolean),public.slm_contact_withdraw(),public.slm_attest_age(uuid,text,timestamptz,text,boolean),public.slm_propose_introduction(uuid,uuid,boolean,timestamptz,timestamptz),public.slm_respond_introduction(uuid,text,boolean),public.slm_conversation(uuid),public.slm_send_message(uuid,text),public.slm_review_message(uuid,text),public.slm_report_contact(uuid,uuid,text),public.slm_end_contact(uuid,boolean),public.slm_contact_feedback_save(uuid,text),public.slm_resolve_contact_report(uuid,text),public.slm_contact_review(),public.slm_moderate_conversation(uuid,text) from public,anon,authenticated;
grant execute on function public.slm_contact_state(),public.slm_contact_optin(boolean),public.slm_contact_withdraw(),public.slm_attest_age(uuid,text,timestamptz,text,boolean),public.slm_propose_introduction(uuid,uuid,boolean,timestamptz,timestamptz),public.slm_respond_introduction(uuid,text,boolean),public.slm_conversation(uuid),public.slm_send_message(uuid,text),public.slm_review_message(uuid,text),public.slm_report_contact(uuid,uuid,text),public.slm_end_contact(uuid,boolean),public.slm_contact_feedback_save(uuid,text),public.slm_resolve_contact_report(uuid,text),public.slm_contact_review(),public.slm_moderate_conversation(uuid,text) to authenticated;
commit;
