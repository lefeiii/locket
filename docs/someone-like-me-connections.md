# Someone Like Me — moderated introductions and conversations

**Current launch:** [voluntary public-story discovery](someone-like-me-stories.md). Private chat remains disabled. This document describes the earlier gated contact stage.

This extends the waitlist pilot. Installation does **not** open contact. No emails, automatic matching, groups, AI, attachments or unrestricted DMs are added. Existing users must separately consent to this stage. Every message requires independent moderator approval before the other participant can read it.

## Install

1. Keep the existing `supabase/someone_like_me.sql` installation and moderator assignment. Run the whole new `supabase/someone_like_me_connections.sql` in Supabase SQL Editor. Both migrations are transactional and rerunnable. Do not rerun the original migration alone after installing this extension.
2. Deploy the accompanying source. No new environment variables or dependencies are required; existing Supabase configuration is reused.
3. Visit `/someone-like-me/connections` as an enrolled participant, and `/someone-like-me/connections/review` as the assigned moderator. Contact remains disabled. Participants may separately record their interest while it is disabled; this is not an introduction or permission to exchange messages.

## Before any live contact

The operator must establish a real external age-assurance process, appropriate consent and participation rules, trained moderation coverage, an escalation process for concerning messages, and a limited evidence-retention policy. This code does not integrate a verification provider or supply trained staff. A moderator recording an external result is not itself age verification. Never substitute self-declared bands, collect identity documents/photos in Locket, or move teenagers to private email/social accounts to arrange contact.

Use opaque references to actual external check results. Each participant needs a current check in exactly the same band as their proposed peer: 13–15, 16–17, or 18+. Checks expire within 30 days and must expire before a birthday crosses a band boundary; the external process and moderator must enforce that boundary because Locket does not store birth dates. A moderator cannot attest their own age or propose/review their own conversation. An independent moderator is required for participants who are also moderators.

Only after these processes exist, configure the singleton privately in SQL Editor. This template deliberately leaves contact OFF:

```sql
update public.slm_contact_config
set enabled = false,
    age_assurance_ready = true,
    age_process_reference = 'YOUR_ACTUAL_APPROVED_PROCESS_REFERENCE',
    coverage_confirmed_at = now(),
    coverage_until = now() + interval '8 hours'
where id = true;
```

Do not run with placeholder assurances. After reviewing real checks and staffing, an operator may explicitly set `enabled = true`. Coverage cannot exceed 24 hours from confirmation and must be renewed only for actual coverage. Missing/expired coverage, checks, moderator assignment, waitlist readiness, or consent prevent proposals, acceptance, sending and delivery. Set `enabled = false` immediately to stop new contact and delivery; reporting, blocking, withdrawal and review remain available. Previously approved conversation history remains readable to its participants.

## Operator workflow

1. Review the voluntary enrollment in `/someone-like-me/review`. Reviewing a waitlist entry does not authorize contact.
2. The participant opts into introductions in `/someone-like-me/connections`, using a separate unchecked consent box. They can withdraw later.
3. Record the actual external check in the contact review page with an opaque case reference and correct expiry. No raw evidence or identity documents belong in this database.
4. Independently review two participants for shared topics, compatible preferences in both directions, appropriate age separation and support expectations. Propose using the contact review form. Stale enrollment versions are refused. No original story, username, email or peer account ID is shown to participants.
5. Each sees the introduction inside Locket and must independently accept a specific conversation disclosure. One acceptance never opens contact. Introductions expire after seven days. Each person can have only one active introduction and receive at most one new proposal per seven days. Declined/closed pairs cannot be proposed again through the normal workflow. Blocks survive withdrawal and prevent recontact.
6. Once both accept, **Open conversation** leads to `/someone-like-me/conversations/<id>`. Settings and Activity link to the introductions page. There are no email notifications in this release.
7. Text is limited to 800 characters, two pending messages per sender and ten submissions/hour. Every message starts pending. The sender sees its review status; the peer sees approved messages only. Review the entire text, including obfuscated contacts, names, school/location clues, coercion, sexual content, harassment and requests to move off-site. The identifier filter and urgent-keyword flags are imperfect assistance, never a replacement for review.
8. Reject unsuitable messages. **Hold and pause contact** quarantines concerning text and stops contact. Flagged urgent text cannot be approved by the ordinary RPC. Follow the actual safety escalation process, record only necessary restricted evidence, and do not promise emergency/live support or professional care. End contact where appropriate. Routine report resolution cannot resume an urgent-safety report or override a block.
9. Reports pause contact immediately; reporting a received message quarantines it and preserves a restricted evidence copy. A participant can block or leave even while coverage is off. Resolve reports independently after taking appropriate action; never merely clear the queue.

## Privacy, deletion and measurement

Tables use RLS with no direct authenticated/anonymous access. Narrow security-definer RPCs check authenticated identity, moderator roles, participation, independent review and current safety gates. Client-supplied IDs cannot select another person's conversation. No original stories are copied or analyzed. Participant payloads omit peer identifiers; moderator access is restricted and third-party Vercel analytics drops all Someone Like Me routes, including conversation IDs.

Withdrawing deletes contact consent, age-check references and the ordinary conversation/history for both participants. Withdrawing from the original waitlist also removes matching preferences and dependent contact records. Restricted reported evidence and blocks can remain to prevent abuse; account/profile deletion cleans these records. Set and follow a proportionate, limited evidence-retention policy before opening: **automated timed evidence cleanup is not included**. Do not retain sensitive evidence indefinitely. Ordinary messages otherwise persist until withdrawal/account deletion; disclose this accurately.

Existing impression, opt-in, preferences and minimal return-day analytics remain. The contact review page adds retained proposal/mutual-acceptance counts, optional feeling-understood answers, reports and unwanted-contact counts. Peers never see each other's feedback. Deletions affect these counts; these are not immutable funnel totals or proof of improved retention. Evaluate seven-day return alongside safety and feedback, using the existing waitlist metrics. No causal retention claim is made.

## Changed files

- Database: `supabase/someone_like_me_connections.sql` adds contact configuration/consent, external age records, introductions, blocks, messages, reports, feedback and audit records; guarded RPCs and cleanup triggers.
- UI: `components/SlmConnections.tsx`, `SlmConversation.tsx`, `SlmContactReview.tsx`; route pages under `app/someone-like-me/connections` and `conversations/[id]`, including contact privacy.
- Shared code: `lib/slm-connections.ts`, `lib/use-slm-rpc.ts`; `PrivateAwareAnalytics.tsx` and root layout suppress private-route analytics.
- Discovery/disclosures: Settings, Activity, existing SomeoneLikeMe component, waitlist review/privacy pages.
- Tests: `tests/slm-connections.test.cjs` and `tests/slm-contact-ui.test.cjs`.

## Verify without real participants

Run `npm test`, `npx tsc --noEmit`, and targeted ESLint on changed components/shared code/routes. Database tests use isolated PGlite fixtures and install both migrations twice. They exercise permissions, consent, age/coverage expiry, mutual acceptance, review-before-delivery, conflict checks, blocking, reports, withdrawal and account cleanup. UI tests check unchecked consent, pending-peer filtering and analytics exclusion.

Browser QA uses separate synthetic participant/moderator accounts with mocked Supabase responses: accept independently; verify one acceptance does not open chat; submit a message; confirm the peer cannot see pending text; approve as independent moderator; confirm delivery; block and confirm sending stops; deny ordinary-account moderator access. Check mobile overflow. These mock checks do not establish a live age-assurance process or production database deployment.

A previous full production build compiled/typechecked but the existing unrelated `/wrapped` static page timed out with placeholder Supabase configuration. Do not treat local mocked checks as proof that production deployment and SQL installation have completed. Before opening a staffed pilot, repeat the complete flow with controlled test accounts against the actual migrated database, verify role denial and expired gates, then withdraw/delete fixtures.
