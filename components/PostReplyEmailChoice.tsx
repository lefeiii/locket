"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// Appears after posting, outside the form: consent never blocks sharing a story.
export function PostReplyEmailChoice() {
  const [ready, setReady] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let active = true;
    void (async () => {
      const { data: { user } } = await client.auth.getUser();
      if (!user || !active) return;
      const { data, error } = await client.from("email_delivery_preferences")
        .select("replies").eq("user_id", user.id).maybeSingle();
      if (error || !active) return;
      setEnabled(Boolean(data?.replies));
      setReady(true);
    })().catch(() => { /* Posting stays successful if email preferences are unavailable. */ });
    return () => { active = false; };
  }, []);

  async function enable() {
    const client = supabase;
    if (!client || busy) return;
    setBusy(true); setMessage("");
    try {
      const { data: { user } } = await client.auth.getUser();
      if (!user) throw new Error("Please sign in again to save this choice.");
      // Update just this choice; do not turn story-update emails on or off.
      const { data, error } = await client.from("email_delivery_preferences")
        .update({ replies: true }).eq("user_id", user.id).select("user_id").maybeSingle();
      if (error) throw new Error("Could not save your choice. Your story is still posted.");
      if (!data) {
        const { error: insertError } = await client.from("email_delivery_preferences")
          .insert({ user_id: user.id, replies: true, story_updates: false });
        if (insertError) throw new Error("Could not save your choice. Please try again.");
      }
      setEnabled(true);
      setMessage("Saved. New replies on your stories will be grouped into emails.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save your choice. Please try again.");
    } finally { setBusy(false); }
  }

  if (!ready || dismissed) return null;
  return <aside className="my-5 rounded-2xl border border-[#ead4dc] bg-[#fff5f7] p-4 text-[#513940]">
    <h2 className="text-lg">{enabled ? "You won’t need to keep checking." : "Want an email when someone replies?"}</h2>
    <p className="mt-2 text-sm leading-6">{enabled
      ? "Reply emails are on. We group replies over an hour and keep story text out of your inbox."
      : "We’ll email your account address about new replies on your stories, grouped over an hour. No story text or titles. Unsubscribe anytime."}</p>
    {!enabled && <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" onClick={enable} disabled={busy} className="rounded-full bg-[#efd2dc] px-4 py-3 text-sm disabled:opacity-50">{busy ? "Saving…" : "Email me about replies"}</button>
      <button type="button" onClick={() => setDismissed(true)} disabled={busy} className="rounded-full px-4 py-3 text-sm">Not now</button>
    </div>}
    {message && <p role="status" className="mt-3 text-sm">{message}</p>}
    <Link href="/settings" className="mt-3 inline-block text-xs underline underline-offset-2">Email settings</Link>
  </aside>;
}
