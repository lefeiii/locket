# Someone Like Me — waitlist-only pilot

**Current launch:** [voluntary public-story discovery](someone-like-me-stories.md). Private chat remains disabled. This document describes the earlier waitlist stage.

This documents the original waitlist stage. The separately gated extension is documented in [moderated introductions and conversations](someone-like-me-connections.md). Its installation does not open live contact; waitlist consent alone never authorizes it.

## What ships

An optional invitation appears **only after a successful public story publication** on the existing success screen. The story is already saved; choosing Maybe later, failing to save preferences, or leaving never affects publication. Feelings, email choices and view-story links remain available. There is also a permanent entry in `/settings` → Someone Like Me (`/someone-like-me`).

Participants choose whom they hope to hear from, 1–3 experience topics, their self-described stage, optional encouragement offering, and a broad age band. A separate, initially unchecked informed-consent checkbox is required. No stories are analyzed or copied into matching records. Pilot participation does not opt anyone into email. Existing users are never enrolled automatically.

The review page (`/someone-like-me/review`) uses database-assigned moderator roles. It shows private IDs and volunteered selections, with separate age-band sections. It never loads stories, names or email addresses. Reviewing/pausing an entry does not approve a match. In the original waitlist stage, matching, contact, invitations, DMs, groups, AI analysis and outbound notifications are absent. The separately installed contact extension has independent consent and safety gates; reviewing this queue alone does not enable it.

## Installation and activation

1. Run the **whole** `supabase/someone_like_me.sql` file in Supabase → SQL Editor. It is transactional and rerunnable. It expects existing `auth.users`, `public.users`, and `public.stories`. It does not depend on the earlier email migrations. The pilot is **off by default**, including invitation display and new enrollment.
2. Pick the person responsible for reviewing this pilot. In Supabase, identify that person's actual authentication ID (not a username, not an email sender address). One way, privately in SQL Editor:

   ```sql
   select id from auth.users where lower(email) = lower('YOUR_MODERATOR_LOGIN_EMAIL');
   ```

   Confirm the result is the intended account, then grant the role:

   ```sql
   insert into public.slm_moderators(user_id)
   values ('THE_CONFIRMED_AUTH_USER_UUID') on conflict do nothing;
   ```

   No frontend, user metadata, account bio, or publicly editable profile field can grant this role. Do not publish these SQL results or participant information.
3. Sign in as that moderator and open `/someone-like-me/review`. Verify it loads, agree who checks concerns and how frequently, and read the runbook below. Configure actual moderator coverage before opening intake. Intake also fails closed if no moderator role has been assigned. This queue is explicitly not live emergency support.
4. Open **waitlist intake only** when ready:

   ```sql
   update public.slm_config set enabled = true where id = true;
   ```

   Pause intake and return-day collection with `enabled = false`. Existing participants retain access to withdrawal, privacy information and reporting. Moderators retain review access. Removing a moderator from `slm_moderators` revokes all future privileged RPC access; removing the final moderator also closes intake and return-day collection. Do not enable any new contact channel as a consequence of this toggle.

No new environment variables or dependencies. The existing Supabase public URL and anon key are used with signed-in user JWTs. Pilot RPCs validate the database identity; service keys are never sent to the browser. There is no new cron job or email sender.

## Privacy, access and deletion

All new tables have RLS enabled and direct access revoked from anonymous and authenticated users. A participant can retrieve only their own state through RPCs. Only SQL-assigned moderators can call queue, decision, report-closing or metric RPCs. Each security-definer function uses an empty search path and qualified tables. PUBLIC/anonymous EXECUTE is revoked. No caller-supplied account ID is accepted for participant operations. Moderator updates use an expected timestamp to reject stale reviews.

Stored enrollment fields: private auth ID, selected connection preference, self-described experience stage, 1–3 selected topics, encouragement choice, age band, consent version/time, modification time and review state. Broad age bands minimize data but are **not verified age assurance**. The waitlist may hold separate teen/adult cohorts, but no one in any cohort can discover or contact another participant.

Invitation impressions retain an own-story reference for deduplication and ownership validation, never matching or review. They are accepted only for one's own recent public stories. After opt-in, return tracking stores at most one UTC day per participant for the initial seven-day window. No page paths or story content enter these records; none of these pilot records is sent to Vercel analytics or AI providers. Existing site analytics are unchanged.

Withdrawal deletes the enrollment, return-day records, linked review log and own invitation references. It clears preference fields from the UI as well. Anonymous daily totals remain. Structured concern categories (with reporter private ID, timestamps and resolution state/actor) remain separately for incident review. There are no free-text fields to collect contact information or sensitive stories. Both Locket's existing profile deletion and auth-user deletion clean up all remaining linked pilot data, including reports. A moderator pause remains in place if a participant edits their selections; withdrawal/rejoining always requires fresh consent and review and never creates contact permission.

## Moderator runbook for this non-contact pilot

- Review only the volunteered choices. Do not search a participant's story history to infer a diagnosis, whether they have recovered, their exact age, or the suitability of a future relationship. These selections are not clinical assessments.
- “Reviewed · keep on waitlist” confirms a preferences review only. “Pause” stops that participant's return-day collection; it does not message them. Changes to their preferences require another review. Never send invitations or move people to email/social media to bypass the disabled contact system.
- Check the structured concern queue at the coverage interval agreed before activation. Urgent-safety concerns sort first. They do not include crisis messages, because no messaging or free-text disclosure is enabled. If a concern cannot be responsibly handled under the pilot's coverage, pause intake. Do not claim 24/7 monitoring, diagnosis, counseling, or guaranteed safety.
- For privacy/unwanted-contact/harassment signals, review the entry and pause it as appropriate. Use existing public-story reporting/moderation channels for a specific public post. Do not close a concern simply to clear the counter; close only after the available review and any appropriate action are complete. Closure records the moderator ID and time.
- User-facing safety copy explains that this queue is not live, and directs immediate danger to local emergency services or a trusted adult without waiting for a moderator. Nothing is automatically classified, forwarded, shared or emailed.
- This intentionally limited category-only reporting is **not sufficient for a messaging launch**. Before contact exists, design a secure incident-detail and evidence workflow, trained coverage and response targets, escalation and emergency handling, age assurance, adult/minor separation, enforced blocks, per-pair mutual consent, rate limits, message moderation and privacy/deletion handling. Test all of them first. Peer helpers must never be presented as professionals or responsible for another person's safety. Obtain new, specific consent before sharing any introduction.

## Measurement and interpretation

`slm_metrics()` is moderator-only and powers the review page. It includes visible invitation impressions (deduped per story), distinct viewers among retained impression records, opt-in events, withdrawal events, current participants, current preference/topic/stage popularity, review states, encouragement offers, concern totals and unwanted-contact reports.

`seven_day_mature_cohort` includes current participants whose initial consent was at least seven days ago. A returner has a visible signed-in visit on a **later UTC calendar day**, within UTC days 1–7 after consent. Same-day revisits are deliberately excluded. Tracking is bounded to the initial window. Withdrawn records are deleted and excluded, creating survivorship bias; show the withdrawal counts alongside this rate. A rejoin is a new enrollment and opt-in event. This is observational data, not evidence that matching improved retention. There are no matches in this MVP. Mutual acceptances and feeling-understood outcomes are `null`/“not collected,” not fabricated zeroes or successes. Sensitive selections are not put in public logs.

## Verification checklist

- Run `npm test`, `npx tsc --noEmit`, and `npx eslint components/SomeoneLikeMe.tsx components/SlmReturnObserver.tsx app/someone-like-me lib/someone-like-me.ts`. Run `npm run build` with the normal deployment environment. A local build using dummy Supabase variables may stall on the existing `/wrapped` data request; do not confuse it with a waitlist failure.
- Before the migration, posting/feed/settings continue working; the after-post card quietly stays absent and the management page explains unavailability. After installation but before activation, the invitation remains absent. No existing account gets a waitlist row.
- Activate in a test Supabase project with one real moderator. Publish a valid story, confirm the ordinary success/feeling/email flow and view-story link, then scroll the invitation into view. It should count once. Maybe later should not write an enrollment.
- Accept, select the preferred connection, topics and stage. Offering encouragement is available only for “been through it” or “some of both.” Under-13 entries cannot enroll. No age is inferred; no exact birth date is requested. Without consent, saving is disabled and the RPC independently rejects it. The account's email must be confirmed.
- Join, change choices and verify they persist across reloads. An update returns a reviewed entry to pending (or keeps a pause). Confirm there are no usernames, stories, emails, potential matches, invitations or chat controls on any pilot page.
- Ordinary users and anonymous clients must be denied direct table access and all privileged queue/metrics/review calls. A moderator can review only through the guarded RPCs; refreshing stale records rejects old decisions.
- Submit a category-only concern, confirm it appears only to that user and authorized moderators, and verify urgent sort/closure and the per-user three-per-day limit. No automatic alert or message is sent.
- Leave and delete preferences; verify the enrollment/visits/impressions/review records disappear while stories, ordinary email preferences and anonymous counts remain. Withdrawal works while intake is paused. Delete a test profile and a test auth account to verify the cleanup paths.
- Return-day collection requires a visible Locket surface and signed-in account; it does not count a locked disguise planner or a background tab. Test on mobile as well as desktop. Review complete cohorts only after seven days; do not infer improvement from initial enrollment numbers.

## Changed files

- `supabase/someone_like_me.sql`: restricted tables, roles, validated participant/moderator RPCs, aggregate metrics and deletion cleanup.
- `lib/someone-like-me.ts`, `components/SomeoneLikeMe.tsx`: shared labels and optional waitlist/management UI.
- `components/SlmReturnObserver.tsx`, `app/layout.tsx`: consent-bound, minimal return-day collection inside the disguise-protected surface.
- `app/create/page.tsx`, `app/settings/page.tsx`: optional after-post invitation and permanent management link.
- `app/someone-like-me/page.tsx`, `app/someone-like-me/privacy/page.tsx`, `app/someone-like-me/review/page.tsx`, `app/privacy/page.tsx`: management, disclosure, restricted review and privacy cross-link.
- `tests/someone-like-me.test.cjs`, UI/posting tests: migration, access, consent, age choices, telemetry, review and deletion behavior.

## Validation completed for this change

- All 52 automated tests passed, including live PostgreSQL-compatible execution of the migration twice, role/access checks, under-13 and missing-consent rejection, review concurrency, bounded telemetry and withdrawal cascades. SQL test fixtures contain no real users.
- TypeScript and targeted ESLint passed. The production build compiled and typechecked, then failed on the existing `/wrapped` static-page request after three timeouts with dummy Supabase credentials. A production build with real deployment configuration is still required; no failure was attributed to a pilot page.
- A local headless browser with mocked authentication/REST responses passed mobile (390px) and desktop (1280px) publishing → invitation → preference/consent/age selection → saved waitlist → withdrawal, and moderator-access gating. Screenshots were inspected for layout/contrast. This browser test used synthetic accounts and did not contact live users, enroll live accounts or send any messages.
- These tests do not establish that the product is safe for private contact, nor that it improves retention. Those capabilities remain absent. Setup/activation is a separate operator step.
