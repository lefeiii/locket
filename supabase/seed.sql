insert into public.stories (
  id,
  anonymous_name,
  title,
  category,
  body,
  is_update,
  story_arc_id,
  arc_title,
  part_number,
  update_label,
  cliffhanger,
  is_resolved,
  status,
  status_updated_at,
  has_active_poll,
  reactions
) values
(
  '11111111-1111-1111-1111-111111111111',
  'DramaBunny',
  'My hallway crush asked for my playlist',
  'Crush',
  'He asked for new music, liked every sad song, then asked why track seven sounded like him.',
  false,
  'playlist-boy',
  'The playlist boy saga',
  1,
  'Part 1',
  'Then he made me a playlist back.',
  false,
  'Unresolved',
  now(),
  true,
  '{"I NEED THE UPDATE":342,"Girl stand up":18,"This is insane":281,"Crying for you":63,"That would ruin me":207,"Team OP":207}'::jsonb
),
(
  '22222222-2222-2222-2222-222222222222',
  'DiaryBandit',
  'AITA for not covering for my lab partner?',
  'AITA',
  'I did my half. They asked me to lie. I told the truth, and now everyone is acting like I betrayed them.',
  false,
  'lab-partner',
  'The lab partner receipts',
  1,
  'Part 1',
  'Then their friends found out I had screenshots.',
  false,
  'Crashed out again',
  now(),
  false,
  '{"I NEED THE UPDATE":177,"Girl stand up":152,"This is insane":204,"Crying for you":45,"That would ruin me":101,"Team OP":301}'::jsonb
)
on conflict (id) do nothing;

insert into public.story_polls (id, story_id, question, options, is_active)
values (
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  'Should I text him back tonight?',
  '["Text him","Wait until tomorrow","Ask what track seven means","Absolutely do not"]'::jsonb,
  true
)
on conflict (id) do nothing;

insert into public.seasonal_wrapped (user_or_device_id, season_name, period_start, period_end, recap_data)
values
(
  'sample-device',
  'Winter Wildin''',
  '2026-09-01',
  '2026-12-31',
  '{"stories_read":47,"stories_posted":3,"most_reacted_category":"Crush","votes_cast":12,"most_used_reaction":"I NEED THE UPDATE","most_followed_story_arc":"The playlist boy saga","updates_followed":8,"top_emotional_label":"Emotionally invested"}'::jsonb
),
(
  'sample-device',
  'Summer Special',
  '2026-01-01',
  '2026-06-30',
  '{"stories_read":68,"stories_posted":5,"most_reacted_category":"Friendship","votes_cast":19,"most_used_reaction":"Girl stand up","most_followed_story_arc":"The private group chat fallout","updates_followed":6,"top_emotional_label":"Red flag historian"}'::jsonb
);

insert into public.persona_badges (persona_id, badge_name, badge_description, is_equipped)
values
  ('DramaBunny', 'Update Queen', 'Keeps the timeline fed with part twos.', true),
  ('DramaBunny', 'Cliffhanger Criminal', 'Ends every update at the worst possible moment.', false);
