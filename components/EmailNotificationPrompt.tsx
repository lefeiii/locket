"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

export function EmailNotificationPrompt() {
  const [userId, setUserId] = useState<string>();
  const [open, setOpen] = useState(false);
  const [choices, setChoices] = useState({ story_updates: false, replies: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  const dismissKey = (id: string) => `locket.emailPrompt.v1.${id}`;

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function check() {
      const { data: { user } } = await client!.auth.getUser();
      if (!active || !user) return;
      try { if (localStorage.getItem(dismissKey(user.id))) return; } catch { /* Storage may be blocked. */ }
      const { data, error } = await client!.from("email_delivery_preferences")
        .select("user_id").eq("user_id", user.id).maybeSingle();
      // A saved choice (including both off) means the user already decided.
      if (!active || error || data) return;
      setUserId(user.id);
      const offer = () => {
        if (!active) return;
        // Let users finish typing, and never ask while the tab is in the background.
        if (document.hidden || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? "")) {
          timer = setTimeout(offer, 8000);
          return;
        }
        setOpen(true);
      };
      timer = setTimeout(offer, 8000);
    }
    void check().catch(() => { /* Leave browsing unaffected if preferences cannot load. */ });
    return () => { active = false; clearTimeout(timer); };
  }, []);

  function remember() {
    if (userId) try { localStorage.setItem(dismissKey(userId), "dismissed"); } catch { /* Optional device memory. */ }
  }
  function dismiss() { remember(); setOpen(false); }

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>("button")?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, [open]);

  async function save() {
    if (!supabase || !userId || busy) return;
    setBusy(true); setError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id !== userId) throw new Error("Please refresh and sign in again.");
      const { error } = await supabase.from("email_delivery_preferences")
        .upsert({ user_id: userId, ...choices }, { onConflict: "user_id" });
      if (error) throw new Error("Could not save your choices. Please try again.");
      remember(); setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save. Please try again.");
    } finally { setBusy(false); }
  }

  if (!open) return null;
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 p-4">
    <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="email-prompt-title" aria-describedby="email-prompt-description"
      className="max-h-[85dvh] w-full max-w-sm overflow-y-auto rounded-[2rem] border border-[#e5d9d1] bg-[#f8f5f0] p-6 text-[#393735] shadow-xl"
      onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); if (!busy) dismiss(); }
        if (event.key !== "Tab") return;
        const controls = panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href]');
        if (!controls?.length) return;
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}>
      <button type="button" onClick={dismiss} disabled={busy} aria-label="Close email invitation" className="float-right rounded-full px-3 py-1 text-xl">×</button>
      <h2 id="email-prompt-title" className="pr-6 text-2xl">A little note when something happens?</h2>
      <p id="email-prompt-description" className="mt-3 text-sm leading-6">Want Locket to email you when there’s something to come back to?</p>
      <div className="my-5 grid gap-4">
        {([
          ["story_updates", "New parts of stories I subscribe to"],
          ["replies", "Replies on my stories · grouped over an hour"],
        ] as const).map(([key, label]) => <label key={key} className="flex items-center gap-3 text-sm leading-5">
          <input type="checkbox" checked={choices[key]} disabled={busy} className="h-5 w-5 shrink-0 accent-[#a86576]"
            onChange={event => setChoices({ ...choices, [key]: event.target.checked })} />
          {label}
        </label>)}
      </div>
      <p className="mb-5 text-xs leading-5">Emails go to your account’s email address. They never include story text or titles. You can unsubscribe anytime.</p>
      <button type="button" onClick={save} disabled={busy || (!choices.story_updates && !choices.replies)}
        className="min-h-12 w-full rounded-2xl bg-[#efd2c8] px-4 py-3 text-sm font-medium disabled:opacity-50">
        {busy ? "Saving…" : "Turn on email notifications"}
      </button>
      <button type="button" onClick={dismiss} disabled={busy} className="mt-2 min-h-11 w-full rounded-2xl px-4 py-3 text-sm">Not now</button>
      <p className="mt-2 text-center text-xs leading-5">You can always change this in <Link className="underline underline-offset-2" href="/settings">notification settings</Link>.</p>
      {error && <p role="alert" className="mt-3 text-sm">{error}</p>}
    </div>
  </div>;
}
