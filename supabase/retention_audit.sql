-- Private, read-only audit. Run in Supabase SQL Editor.
-- Returns aggregate counts only: no email addresses, names, or story content.
-- It does not change data, send emails, or change notification preferences.
begin transaction read only;
with accounts as (
 select id,created_at,email_confirmed_at from auth.users
), public_posts as (
 select s.id,coalesce(s.user_id,u.id) as account_id,s.created_at,s.anonymous_name,
  row_number() over(partition by coalesce(s.user_id,u.id) order by s.created_at,s.id) as post_number
 from public.stories s
 left join public.users u on s.user_id is null and u.username=s.anonymous_name
 where not coalesce((to_jsonb(s)->>'is_hidden')::boolean,false)
 and not coalesce((to_jsonb(s)->>'is_private')::boolean,false)
 and not coalesce((to_jsonb(s)->>'is_diary_only')::boolean,false)
 and exists(select 1 from accounts a where a.id=coalesce(s.user_id,u.id))
), first_posts as (
 select p.*, (select min(c.created_at) from public.comments c
  where c.story_id::text=p.id::text and c.anonymous_name<>p.anonymous_name and c.created_at>=p.created_at) as first_reply_at,
  (select min(s.created_at) from public_posts s where s.account_id=p.account_id and s.post_number=2) as second_post_at
 from public_posts p where post_number=1
), mature_posts as (
 select * from first_posts where created_at<=now()-interval '24 hours'
), cohorts as (
 select case when first_reply_at is null then 'no_reply' else 'received_reply' end as cohort,
 count(*) as first_posters,
 count(*) filter(where second_post_at is not null) as posted_again,
 count(*) filter(where first_reply_at is not null and second_post_at>first_reply_at) as posted_again_after_first_reply,
 count(*) filter(where first_reply_at<=created_at+interval '24 hours') as received_reply_within_24h
 from mature_posts group by first_reply_at is null
), signup_ages as (
 select case when created_at>now()-interval '7 days' then '0-6 days'
 when created_at>now()-interval '30 days' then '7-29 days'
 when created_at>now()-interval '180 days' then '30-179 days' else '180+ days' end as age,count(*) as accounts
 from accounts group by 1
)
select jsonb_build_object(
 'accounts',(select count(*) from accounts),
 'verified_email_accounts',(select count(*) from accounts where email_confirmed_at is not null),
 'oldest_signup',(select min(created_at)::date from accounts),
 'newest_signup',(select max(created_at)::date from accounts),
 'signup_ages',coalesce((select jsonb_object_agg(age,accounts) from signup_ages),'{}'::jsonb),
 'accounts_with_public_posts',(select count(*) from first_posts),
 'accounts_without_public_posts',(select count(*) from accounts)-(select count(*) from first_posts),
 'accounts_with_multiple_public_posts',(select count(distinct account_id) from public_posts where post_number=2),
 'public_posts',(select count(*) from public_posts),
 'first_post_reply_cohorts_24h_old',coalesce((select jsonb_agg(to_jsonb(c)) from cohorts c),'[]'::jsonb),
 'email_preferences_saved',(select count(*) from public.email_delivery_preferences),
 'reply_email_optins',(select count(*) from public.email_delivery_preferences where replies),
 'story_update_email_optins',(select count(*) from public.email_delivery_preferences where story_updates),
 'accounts_without_email_preferences',(select count(*) from accounts a where not exists(select 1 from public.email_delivery_preferences p where p.user_id=a.id)),
 'limits',jsonb_build_array('Only currently available public posts; hidden, private and diary posts excluded.','No session history: repeat posting is not return-visit retention.','Reply comparisons are observational and do not establish causation.','Signup dates and activity opt-ins do not establish general campaign consent.')
) as retention_audit;
commit;
