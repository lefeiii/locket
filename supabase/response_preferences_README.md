## Deployment

1. In the Supabase dashboard for Locket, open **SQL Editor**.
2. Paste and run the complete contents of `supabase/response_preferences.sql`.
3. Merge and deploy this change after that query succeeds.

The migration is safe to run again. Existing stories default to **Anything welcome**.
No historical comments or reaction counts are removed. Closing replies hides the
comment UI; reopening them makes earlier comments visible again.

The database blocks comment writes for **Just letting it out**, limits changed
reaction keys for comfort/advice posts, and restricts preference changes to the
author (with a username fallback for legacy posts without user IDs).
Existing story ownership/RLS policies still govern other edits.

**Comfort welcome** guides comment tone; it does not automatically moderate meaning.
Reporting remains available.
