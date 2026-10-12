# Everyone’s Awake invitations

1. Run `supabase/host_invitations.sql` once in Supabase SQL Editor. This adds a private delivery journal and user-owned opt-in preferences. It changes no existing posts.
2. Save repository secrets `GMAIL_APP_PASSWORD`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` in GitHub Actions settings. The sender is hellokayleec@gmail.com. Never commit these secret values.
3. In GitHub Actions, select **Everyone’s Awake host invitations** and **Run workflow** on main. The first claim selects the exact cinnaxx account and verifies the associated email against the expected address supplied by the owner before sending. The account must have a confirmed email and public contribution.
4. Verify the run and Gmail Sent. Then add repository **variable** `HOST_INVITATIONS_ENABLED` with value `true` to enable daily invitations around 6pm Toronto time. GitHub schedules can be delayed. Turn the variable off to pause sending.

After the first invitation, only volunteers with a confirmed account email and a public post or comment can be drawn. Users opt in or out on their own Profile. Each account gets at most one invitation; when the pool is exhausted, the job sends nothing. One database claim per Toronto date prevents duplicate sends across cron events or reruns.

Failed and uncertain sends retain their claims. Inspect Gmail Sent and the private `host_invitations` table before recovery; never delete an uncertain claim and rerun blindly. SMTP acceptance does not guarantee inbox delivery. Recipient addresses and credentials are not printed in workflow logs.

The email asks for a reply by 8pm Toronto time. Replies arrive in the sender’s Gmail for the owner to review. This job does not read replies, approve prompts, or publish threads. The nightly thread UI and publishing schedule are separate work; do not enable daily invitations until the owner is ready to run those threads.
