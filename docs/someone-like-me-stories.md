# Someone Like Me: public stories first

The active feature is voluntary public-story discovery. Readers select topics and current/past/both preferences. Authors separately volunteer a particular already-public story and self-describe their experience. An independent moderator reviews it for this collection. Eligible readers can open its normal `/story/<id>` page and use its existing public replies and report controls. Private introductions and conversations stay disabled; their normal participant routes redirect to story discovery. No new age-verification claim is made for this public feature.

## One database step

The original `supabase/someone_like_me.sql` waitlist migration and moderator assignment must already exist. Run the **whole** `supabase/someone_like_me_stories.sql` in Supabase → SQL Editor → New query. The separate `someone_like_me_connections.sql` chat migration is **not required**. This migration is transactional and rerunnable. It does not enroll existing readers, reuse waitlist selections, recommend existing stories, or send emails. No new environment variables, paid services or dependencies are required.

The new public intake defaults to enabled on installation, but fails closed without an assigned `slm_moderators` role. No recommendation appears until a story author explicitly consents and a different moderator approves that version. Installing the public migration also sets the separate contact configuration to disabled if that table exists. It never marks external age assurance or coverage ready.

The existing GitHub connection can deploy source but cannot execute arbitrary Supabase SQL using the repository's API service-role key. A source deployment alone does not install this migration. If it is missing, after-post invitations stay hidden and the management page gives a recoverable unavailable message; publication still succeeds. Do not claim the feature is fully live before this step has run.

## Normal use

- After successful story publication: the gentle optional invitation appears. “Maybe later” leaves the saved story and its view link available.
- `/someone-like-me`: save reading preferences with a fresh unchecked consent box. This never offers the reader's own stories. At least 13 is explicitly acknowledged; no date of birth is collected or age assurance claimed.
- On the same page, **Choose a story to offer** opens separate author controls. Select one of the account's most recent public stories (up to 30 are shown, including the just-posted story when supplied), 1–3 topics, experience stage and optional encouragement willingness. A second unchecked checkbox clearly explains public visibility. At most 20 stories may be offered per author.
- The author sees pending, approved or paused status, can change the choices, or stop recommending the story. The original post stays on Locket. Saving changes requires new explicit author consent and a fresh review; a moderator pause survives author edits.
- Settings and Activity link to story discovery. The earlier waitlist is kept separately under `/someone-like-me/waitlist`, with its withdrawal/reporting controls and original privacy notice. Legacy waitlist consent is never reused for public discovery.
- Public story pages can show optional private “did this help you feel understood?” feedback to participating readers whose saved preferences fit an eligible story. It is not shown to the author, and is not a public reaction.

## Matching and moderation

The only matching inputs are voluntarily selected topics, the reader's current/past/both preference and the author's self-described experience stage. Past-experience recommendations additionally require the author's encouragement opt-in. No story analysis, inferred diagnoses, inferred recovery, embeddings, AI API calls or automatic invitations exist.

Recommendations require positive topic overlap, current author ownership, explicit per-story consent, moderator approval and current public visibility. Private, diary-only, hidden, unapproved, paused and withdrawn stories are excluded from both recommendations and moderation text payloads. Readers never receive author account IDs, email addresses, story bodies or private selections from the recommendation RPC; they see a public title, shared topics and volunteered experience context, then choose whether to open the existing public story. The privacy disclosure explicitly says the original page contains its public username, full story and public replies.

Results are ranked by number of shared topics, then story recency and ID, limited to six, with at most one story per author. There is no popularity or length scoring. Empty results say no reviewed, opted-in stories fit yet; they never fall back to unconsented posts, fake matches or private diary content.

Moderators use `/someone-like-me/stories/review` (the same existing database-assigned role). Review the actual public text and volunteered context before approving. Check identifying details, harassment, pressure, requests for off-site contact, sexual content involving minors and concerning/crisis disclosures. Pause unsuitable entries and use Locket's existing public reporting/moderation process where required. This queue does not provide emergency support or counseling, promise replies or certify safety. Pausing discovery is not deleting/moderating the original public story.

A moderator cannot approve their own story. Approval carries a revision token; stale actions fail if the source or offer changed. Story content, visibility, ownership and response-boundary edits reset approval; ordinary reaction/status/poll-state changes do not. Paused offers stay paused until an independent moderator deliberately approves a current version. Removing the last moderator pauses the whole collection. To pause intake and recommendations privately:

```sql
update public.slm_public_config set enabled = false where id = true;
```

Set it back to `true` only when the operator wants to resume the public collection. Participants can still unshare/withdraw while paused. Original public posts/replies are governed by the existing Locket controls.

## Access, revocation and metrics

All new tables use RLS and revoke direct anonymous/authenticated access. Narrow security-definer RPCs use an empty search path and check authenticated identity, verified login for opting in, actual story ownership, current visibility, consent and moderator permissions. Matching never accepts an arbitrary reader account ID. Authors and readers opt in independently; no waitlist record is migrated automatically. Profile deletion and auth-account deletion remove linked discovery records.

Leaving story discovery deletes reading preferences, story offers, feedback linked to either the reader or their offered stories, invitation references and linked return days. Unsharing one story deletes its discovery feedback. Original stories and replies remain under existing controls. Non-identifying daily totals remain. Earlier waitlist participation must be removed using its separate legacy controls; the UI labels this distinction.

Metrics include deduplicated visible post-success invitations, reader opt-in events, story-offer events, withdrawals, current preferences/topics, current approved entries, mature seven-day return cohorts and private feeling-understood feedback. A return means a later UTC date within seven calendar days, not another visit the same day. Records are bounded to the initial enrollment window. Withdrawal changes retained cohorts and feedback; daily totals survive, so these are not an immutable per-user funnel or proof of better retention. No reading history or story text is stored in analytics. Existing safety-report queues remain separate; this release adds no private contact to measure.

Someone Like Me routes stay excluded from Vercel Analytics. Existing public story-page analytics continue normally; recommendation/feedback RPCs don't send account identifiers or chosen topics to Vercel.

## Source and verification

- New SQL: `supabase/someone_like_me_stories.sql`.
- New components: `PublicSomeoneLikeMe`, `PublicStoryOffer`, `PublicStoryFeedback`, `SlmPublicShared`, `SlmPublicReview`; shared types `lib/slm-public.ts`.
- `SomeoneLikeMe.tsx` reuses the original post-success integration as a wrapper. Original waitlist controls move to `WaitlistPreferences.tsx` and archive routes. The public privacy page explains the changed purpose and separate consent.
- Settings, Activity and existing moderator review link to the public feature. Story detail adds optional private feedback after the existing comment section. Return observer records public-pilot return days independently of the legacy waitlist.
- Existing participant chat routes redirect; underlying future-chat implementation is saved, and its SQL switch is forced off when this public migration is installed.

Run `npm test`, TypeScript and targeted ESLint. Isolated PGlite tests install migrations twice and cover explicit independent consent, role restrictions, self-review denial, topic/preference compatibility, per-author diversity, content edits/stale approvals, privacy flips, moderator pause, withdrawal, feedback, return-day cohorts and account cleanup. UI tests check dismissal, unchecked reader/author consent, exact payload separation and direct public-story links. The original waitlist UI tests continue against the archived component.

Browser QA uses synthetic accounts and a local mock Supabase server: publish through the existing form, dismiss invitation without losing the post, separately offer a story and choose reader preferences, hide pending entries, approve as an independent moderator, open the actual public story route, save private feedback, unshare and observe removal, redirect old chat URLs, deny unauthorized review and check mobile overflow. These checks do not install production SQL or involve actual teenagers. After installing SQL, repeat the flow with controlled test accounts and delete the fixtures before announcing availability.
