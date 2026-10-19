"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { connectionLabels, stageLabels, slmTopics, slmButton, slmInput, type SlmState } from "@/lib/someone-like-me";

export function SomeoneLikeMe({ storyId }: { storyId?: string }) {
  const [state, setState] = useState<SlmState>();
  const [loaded, setLoaded] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [editing, setEditing] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [connection, setConnection] = useState("");
  const [stage, setStage] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [offering, setOffering] = useState(false);
  const [age, setAge] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmWithdrawal, setConfirmWithdrawal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const card = useRef<HTMLElement>(null);
  const impressionRecorded = useRef(false);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let active = true;
    let generation = 0;
    async function load() {
      const request = ++generation;
      const { data: { user } } = await client!.auth.getUser();
      if (!active || request !== generation) return;
      setSignedIn(Boolean(user));
      if (!user) { setLoaded(true); return; }
      const { data, error } = await client!.rpc("slm_state");
      if (!active || request !== generation) return;
      if (!error) setState(data as SlmState);
      setLoaded(true);
    }
    void load().catch(() => { if (active) setLoaded(true); });
    const { data: { subscription } } = client.auth.onAuthStateChange(event => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT") return;
      generation++;
      impressionRecorded.current = false;
      if (event === "SIGNED_OUT") setDismissed(true);
      setState(undefined); setEditing(false); setLoaded(false); setSignedIn(false);
      setConnection(""); setStage(""); setTopics([]); setOffering(false); setAge(""); setConsent(false); setMessage("");
      setTimeout(() => { if (active) void load().catch(() => setLoaded(true)); }, 0);
    });
    return () => { active = false; generation++; subscription.unsubscribe(); };
  }, []);

  // Count a visible invitation, not merely a successful post or an offscreen render.
  useEffect(() => {
    const client = supabase;
    if (!client || !storyId || !state?.available || state.enrollment || dismissed || !card.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(entries => {
      if (document.hidden || !entries.some(entry => entry.isIntersecting) || impressionRecorded.current) return;
      impressionRecorded.current = true;
      void (async () => {
        try { const { error } = await client.rpc("slm_record_impression", { story_uuid: storyId }); if (error) impressionRecorded.current = false; }
        catch { impressionRecorded.current = false; }
      })();
      observer.disconnect();
    }, { threshold: 0.25 });
    observer.observe(card.current);
    return () => observer.disconnect();
  }, [storyId, state, dismissed]);

  async function refresh() {
    const { data, error } = await supabase!.rpc("slm_state");
    if (error) throw new Error("Could not refresh your waitlist status. Please reload.");
    setState(data as SlmState);
  }
  function edit() {
    const saved = state?.enrollment;
    setConnection(saved?.connection_preference ?? ""); setStage(saved?.experience_stage ?? "");
    setTopics(saved?.topics ?? []); setOffering(saved?.offer_encouragement ?? false); setAge(saved?.age_band ?? "");
    setConsent(false); setMessage(""); setEditing(true);
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!supabase || busy) return;
    setBusy(true); setMessage("");
    try {
      const { error } = await supabase.rpc("slm_join", {
        connection_choice: connection, stage_choice: stage, topic_choices: topics,
        encouragement: offering, age_choice: age, consent,
      });
      if (error) throw new Error("We couldn’t save your choices. Check your selections and verified login, or try again in a moment.");
      await refresh(); setEditing(false);
      setMessage("You’re on the waitlist. Waitlist consent alone never starts an introduction or conversation.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save. Please try again."); }
    finally { setBusy(false); }
  }
  async function withdraw() {
    if (!supabase || busy) return;
    setBusy(true); setMessage("");
    try {
      const { error } = await supabase.rpc("slm_withdraw");
      if (error) throw new Error("Could not withdraw. Please try again.");
      setConnection(""); setStage(""); setTopics([]); setOffering(false); setAge(""); setConsent(false);
      setState(previous => previous ? { ...previous, enrollment: null } : previous);
      setConfirmWithdrawal(false); setEditing(false);
      setMessage("You’ve left the waitlist. Your matching preferences and linked return-day records have been deleted.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not withdraw."); }
    finally { setBusy(false); }
  }
  async function report() {
    if (!supabase || !reportReason || busy) return;
    setBusy(true); setMessage("");
    try {
      const { error } = await supabase.rpc("slm_report_concern", { reason: reportReason });
      if (error) throw new Error("Could not submit. Please try later; at most three concerns can be sent each day.");
      await refresh(); setReportOpen(false); setReportReason("");
      setMessage("Your concern is in the moderator queue. This queue is not monitored in real time.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not submit."); }
    finally { setBusy(false); }
  }

  if (storyId && (!state?.available || dismissed)) return null;
  if (!loaded) return storyId ? null : <p className="py-6 text-sm" role="status">Loading your waitlist choices…</p>;
  if (!signedIn) return <p className="py-6 text-sm"><Link href="/login" className="underline">Sign in</Link> to manage Someone Like Me.</p>;
  if (!state) return <p className="py-6 text-sm" role="status">The waitlist isn’t ready here yet. Your stories are unaffected. Please try again later.</p>;
  const saved = state.enrollment;
  return <section ref={card} className="my-5 rounded-[2rem] border border-[#ead4dc] bg-[#fff7f8] p-5 text-[#513940]" aria-label="Someone Like Me">
    <h2 className="font-serif text-2xl">someone like me</h2>
    {!saved && !editing && <>
      <p className="mt-3 text-lg leading-7">somewhere out there, someone knows exactly how this feels.</p>
      <p className="mt-3 text-sm leading-6">want to find someone who’s going through something similar, or someone who’s been through it before?</p>
      <p className="mt-3 text-xs leading-5">A moderator-reviewed waitlist, not a chat. Joining won’t introduce you to anyone yet.</p>
      {state.available ? <div className="mt-4 flex flex-wrap gap-2"><button type="button" className={slmButton} onClick={edit}>find someone who understands</button>
        {storyId && <button type="button" className="min-h-11 rounded-full px-4 py-3 text-sm" onClick={() => setDismissed(true)}>maybe later</button>}</div>
        : <p className="mt-4 text-sm">The pilot is paused. You can still withdraw or report a concern below.</p>}
      <p className="mt-3 text-xs leading-5">We count invitation views to learn whether this helps. <Link href="/someone-like-me/privacy" className="underline">How the pilot works</Link></p>
    </>}
    {saved && !editing && <div className="mt-4 text-sm leading-6">
      <p className="font-medium">{saved.review_status === "paused" ? "Your participation is paused for moderator review." : saved.review_status === "reviewed_waitlist" ? "A moderator has reviewed your waitlist entry." : "You’re on the waitlist for moderator review."}</p>
      <p className="mt-2">Other participants cannot see your waitlist entry. Reviewing it does not authorize contact; introductions require separate consent and safety checks.</p>
      <dl className="mt-3"><dt className="font-medium">You’d like to hear from</dt><dd>{connectionLabels[saved.connection_preference]}</dd>
        <dt className="mt-2 font-medium">You described yourself as</dt><dd>{stageLabels[saved.experience_stage]}</dd>
        <dt className="mt-2 font-medium">Your topics</dt><dd>{saved.topics.map(t => slmTopics.find(([key]) => key === t)?.[1]).join(", ")}</dd>
        <dt className="mt-2 font-medium">Offering encouragement</dt><dd>{saved.offer_encouragement ? "yes, about these experiences" : "not right now"}</dd></dl>
      <div className="mt-4 flex flex-wrap gap-3">{state.available && <button type="button" className={slmButton} onClick={edit}>Change my choices</button>}
        <button type="button" className="min-h-11 underline" onClick={() => setConfirmWithdrawal(true)}>Leave and delete my preferences</button></div>
    </div>}
    {editing && <form onSubmit={save} className="mt-5 grid gap-5">
      <label className="text-sm">Who would you like to hear from?
        <select className={slmInput} value={connection} onChange={e => setConnection(e.target.value)} required disabled={busy}><option value="">Choose what feels right</option>{Object.entries(connectionLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>
      </label>
      <fieldset disabled={busy}><legend className="text-sm">What feels familiar? Choose up to three.</legend><div className="mt-3 flex flex-wrap gap-2">{slmTopics.map(([value,label]) => <button key={value} type="button" aria-pressed={topics.includes(value)}
        disabled={!topics.includes(value) && topics.length >= 3} onClick={() => setTopics(topics.includes(value) ? topics.filter(t => t !== value) : [...topics,value])}
        className={`min-h-11 rounded-full border px-3 py-2 text-sm disabled:opacity-40 ${topics.includes(value) ? "border-[#ba7b91] bg-[#efd2dc]" : "border-[#e3cdd5] bg-[#fffdfa]"}`}>{label}</button>)}</div></fieldset>
      <label className="text-sm">Where are you with these experiences?
        <select className={slmInput} value={stage} onChange={e => { setStage(e.target.value); if (e.target.value === "going_through") setOffering(false); }} required disabled={busy}><option value="">Only you can say</option>{Object.entries(stageLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>
      </label>
      {(stage === "been_through" || stage === "both") && <label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={offering} onChange={e => setOffering(e.target.checked)} disabled={busy}/>I’m also open to offering encouragement about these experiences. I’m a peer, not a counselor.</label>}
      <label className="text-sm">Your age band · kept within the review team
        <select className={slmInput} value={age} onChange={e => setAge(e.target.value)} required disabled={busy}><option value="">Choose your age band</option><option value="under_13">Under 13</option><option value="13_15">13–15</option><option value="16_17">16–17</option><option value="18_plus">18 or older</option></select>
      </label>
      {age === "under_13" && <p role="alert" className="text-sm">This pilot is only for people aged 13 or older. You can’t join this waitlist.</p>}
      <div className="rounded-2xl bg-[#fffdfa] p-4 text-xs leading-6">
        <p>We use your chosen topics, preferences, age band and consent for moderator review. Your story isn’t analyzed. Other participants see none of your story, username, email or choices.</p>
        <p className="mt-2">Age here is self-reported, not verified. This waitlist choice cannot open contact. Separate introductions require external age checks, new consent and same-band safeguards.</p>
        <p className="mt-2">We count invitation views and, after opt-in, your return days during the first seven days. Leaving deletes your preferences and linked activity. Anonymous counts and safety reports may remain. <Link href="/someone-like-me/privacy" className="underline">Read the pilot privacy notice</Link>.</p>
      </div>
      <label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={consent} onChange={e => setConsent(e.target.checked)} required disabled={busy}/>I choose to join this reviewed waitlist and agree to the use of these selections and pilot activity records described above. I understand this does not start a conversation.</label>
      <div className="flex flex-wrap gap-2"><button className={slmButton} type="submit" disabled={busy || !consent || !connection || !stage || !topics.length || !age || age === "under_13"}>{busy ? "Saving…" : saved ? "Save my choices" : "Join the waitlist"}</button><button type="button" className="min-h-11 px-4 text-sm" disabled={busy} onClick={() => { setEditing(false); setConsent(false); }}>Maybe later</button></div>
    </form>}
    {confirmWithdrawal && <div className="mt-4 rounded-2xl border border-[#e3cdd5] bg-[#fffdfa] p-4 text-sm leading-6"><p>Leave the waitlist and delete your matching preferences and linked return-day records? Your stories stay on Locket.</p><div className="mt-3 flex flex-wrap gap-3"><button type="button" className={slmButton} disabled={busy} onClick={withdraw}>{busy ? "Deleting…" : "Yes, leave and delete"}</button><button type="button" disabled={busy} onClick={() => setConfirmWithdrawal(false)}>Keep my place</button></div></div>}
    {!storyId && <div className="mt-5 border-t border-[#ead4dc] pt-4 text-xs leading-6">
      <button type="button" className="min-h-11 underline" onClick={() => setReportOpen(!reportOpen)}>Report a pilot concern</button>
      {reportOpen && <div className="mt-2"><p>No story text, names, or contact information is requested here. For public posts, use the story’s Report option.</p>
        <select aria-label="Concern type" className={slmInput} value={reportReason} onChange={e => setReportReason(e.target.value)}><option value="">Choose a concern</option><option value="privacy">Privacy</option><option value="unwanted_contact">Unwanted contact</option><option value="harassment">Harassment</option><option value="urgent_safety">Urgent safety concern</option><option value="other">Another pilot concern</option></select>
        <p className="my-3">This queue isn’t monitored live. If you or someone else is in immediate danger, contact local emergency services or a trusted adult now. You don’t need to wait for this pilot.</p><button type="button" className={slmButton} disabled={busy || !reportReason} onClick={report}>Send concern for review</button></div>}
      {state.reports.length > 0 && <ul className="mt-2">{state.reports.map(r => <li key={r.id}>{r.category.replaceAll("_"," ")} · {r.status}</li>)}</ul>}
    </div>}
    {message && <p role="status" className="mt-4 text-sm leading-6">{message}</p>}
    {storyId && <Link href="/someone-like-me" className="mt-4 inline-block text-xs underline">Manage participation and report a concern</Link>}
    {!storyId && <Link href="/someone-like-me/connections" className="mt-4 block text-sm underline">Introductions and conversation choices →</Link>}
    {state.moderator && <Link href="/someone-like-me/review" className="mt-4 block text-xs underline">Moderator review</Link>}
  </section>;
}
