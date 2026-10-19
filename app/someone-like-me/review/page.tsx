"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { connectionLabels, stageLabels, slmTopics, slmButton, type SlmEnrollment } from "@/lib/someone-like-me";

type Entry = SlmEnrollment & { participant_id: string };
type Report = { id: string; participant_id: string; category: string; created_at: string; status: string };
type Metrics = Record<string, unknown>;
function Breakdown({ value }: { value: unknown }) {
  if (!value || typeof value !== "object") return null;
  return <ul className="mt-2 text-sm leading-6">{Object.entries(value).map(([label, n]) => <li key={label}>{label.replaceAll("_", " ")}: {String(n)}</li>)}</ul>;
}
export default function SlmReviewPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({});
  const [authorized, setAuthorized] = useState(false);
  const [message, setMessage] = useState("Checking moderator access…");
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!supabase) throw new Error("Database is unavailable.");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Sign in with an authorized moderator account.");
    const { data: role, error: roleError } = await supabase.rpc("slm_is_moderator");
    if (roleError || !role) throw new Error("Moderator access is required. Public accounts cannot view this queue.");
    const [queue, summary] = await Promise.all([supabase.rpc("slm_review_queue"), supabase.rpc("slm_metrics")]);
    if (queue.error || summary.error) throw new Error("Could not load the review queue. Try refreshing.");
    return { queue: queue.data as { enrollments: Entry[]; reports: Report[] }, metrics: summary.data as Metrics };
  }
  useEffect(() => {
    let active = true;
    void load().then(result => {
      if (!active) return;
      setEntries(result.queue.enrollments); setReports(result.queue.reports); setMetrics(result.metrics); setAuthorized(true); setMessage("");
    }).catch(error => { if (active) setMessage(error instanceof Error ? error.message : "Could not load review."); });
    const { data: { subscription } } = supabase?.auth.onAuthStateChange(event => {
      if (event !== "SIGNED_OUT") return;
      active = false;
      setAuthorized(false); setEntries([]); setReports([]); setMetrics({}); setMessage("Signed out. Reload after signing in with a moderator account.");
    }) ?? { data: { subscription: { unsubscribe() {} } } };
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  async function act(name: string, args: Record<string, unknown>) {
    if (!supabase || busy) return;
    setBusy(true); setMessage("");
    try {
      const { error } = await supabase.rpc(name, args);
      if (error) throw new Error("Could not apply that action. The record may have changed or been withdrawn; refresh and try again.");
      const result = await load();
      setEntries(result.queue.enrollments); setReports(result.queue.reports); setMetrics(result.metrics);
      setMessage("Saved. Contact and introductions remain disabled.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Action failed."); }
    finally { setBusy(false); }
  }
  async function refresh() {
    setBusy(true);
    try { const result = await load(); setEntries(result.queue.enrollments); setReports(result.queue.reports); setMetrics(result.metrics); setMessage(""); }
    catch (error) { setAuthorized(false); setEntries([]); setReports([]); setMetrics({}); setMessage(error instanceof Error ? error.message : "Could not refresh."); }
    finally { setBusy(false); }
  }
  const mature = Number(metrics.seven_day_mature_cohort ?? 0);
  const returned = Number(metrics.seven_day_mature_returners ?? 0);
  return <main className="mx-auto my-6 max-w-4xl rounded-[2rem] bg-[#fffaf8] px-4 py-10 text-[#513940]">
    <Link href="/someone-like-me" className="text-sm underline">Back to Someone Like Me</Link>
    <h1 className="mt-5 font-serif text-3xl">Someone Like Me · waitlist review</h1>
    <p role="status" className="my-4 text-sm">{message}</p>
    {authorized && <>
      <div className="rounded-3xl border border-[#ead4dc] bg-[#fff7f8] p-5 text-sm leading-6"><strong>Waitlist review only. No introductions or contact are enabled.</strong><p>All age bands are self-reported and unverified. “Reviewed” means only that you reviewed the selections. It does not approve a match, verify age, or authorize contact. Do not arrange introductions outside this workflow. Never copy participant information into public logs or third-party tools.</p><button className={`${slmButton} mt-3`} onClick={refresh} disabled={busy}>Refresh queue</button></div>
      <section className="mt-6 rounded-3xl border border-[#ead4dc] bg-[#fffdfa] p-5"><h2 className="text-xl">Pilot evidence</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">{[["Invitation impressions", metrics.invitation_impressions], ["Distinct viewers · retained records", metrics.unique_invitation_viewers_retained], ["Opt-in events", metrics.optin_events], ["Current participants", metrics.current_participants], ["Withdrawal events", metrics.withdrawal_events], ["Safety reports", metrics.safety_reports], ["Unwanted-contact reports", metrics.unwanted_contact_reports], ["Open urgent reports", metrics.open_urgent_reports]].map(([label,n]) => <div key={String(label)}><dt>{String(label)}</dt><dd className="text-2xl">{String(n ?? 0)}</dd></div>)}</dl>
        <p className="mt-4 text-sm">Returned on a later UTC day within seven days: {mature ? `${returned} / ${mature} (${Math.round(returned / mature * 100)}%)` : "No complete seven-day cohort yet."}</p>
        <p className="mt-2 text-xs leading-5">Only current participants whose enrollment is at least seven days old are included. Withdrawn records are deleted and excluded. This is observational: it cannot establish that the feature caused a return. Rejoining counts as a new opt-in event. Distinct viewers exclude deleted invitation records.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2"><div><h3 className="font-medium">Connection preferences · current entries</h3><Breakdown value={metrics.connection_preferences}/></div><div><h3 className="font-medium">Self-described experience</h3><Breakdown value={metrics.experience_stages}/></div><div><h3 className="font-medium">Topics · current entries</h3><Breakdown value={metrics.topics}/></div><div><h3 className="font-medium">Review status</h3><Breakdown value={metrics.review_status}/></div></div>
        <p className="mt-4 text-sm">Offering encouragement: {String(metrics.offering_encouragement ?? 0)}. Mutual acceptance and feeling-understood outcomes: not collected; introductions are disabled.</p>
      </section>
      <section className="mt-7"><h2 className="text-xl">Safety concerns</h2><p className="mt-2 text-sm leading-6">Urgent concerns appear first. This queue is not emergency coverage. Follow the documented review runbook; pausing an entry never sends a message or exposes it to another user.</p>
        {!reports.length && <p className="mt-3 text-sm">No open pilot concerns.</p>}
        {reports.map(report => <article key={report.id} className="mt-3 rounded-2xl border border-[#ead4dc] bg-[#fffdfa] p-4 text-sm leading-6"><h3 className="font-medium">{report.category === "urgent_safety" ? "URGENT SAFETY · manual review required" : report.category.replaceAll("_", " ")}</h3><p className="break-all">Private participant ID: {report.participant_id}</p><p>{new Date(report.created_at).toLocaleString()}</p><button className={`${slmButton} mt-3`} disabled={busy} onClick={() => act("slm_close_report", { report_uuid: report.id })}>Mark concern reviewed and closed</button></article>)}
      </section>
      {([['13_15','Ages 13–15'],['16_17','Ages 16–17'],['18_plus','Adults · 18 or older']] as const).map(([band,label]) => <section key={band} className="mt-8"><h2 className="text-xl">{label}</h2><p className="mt-1 text-xs">Separate review cohort. No cross-age or within-cohort contact is possible.</p>
        {entries.filter(e => e.age_band === band).map(entry => <article key={entry.participant_id} className="mt-3 rounded-3xl border border-[#ead4dc] bg-[#fffdfa] p-5 text-sm leading-6"><p className="break-all font-medium">Private participant ID: {entry.participant_id}</p><p>Joined: {new Date(entry.consented_at).toLocaleDateString()} · {entry.review_status.replaceAll("_", " ")}</p><p>Hoping to hear from: {connectionLabels[entry.connection_preference]}</p><p>Self-described situation: {stageLabels[entry.experience_stage]}</p><p>Topics: {entry.topics.map(t => slmTopics.find(([key]) => key === t)?.[1]).join(", ")}</p><p>Offers encouragement: {entry.offer_encouragement ? "yes" : "no"}</p><p className="mt-2 font-medium">Age assurance and contact safeguards: not completed. Contact disabled.</p><div className="mt-3 flex flex-wrap gap-2">{[['pending','Needs review'],['reviewed_waitlist','Reviewed · keep on waitlist'],['paused','Pause participation']] .map(([decision,label]) => <button className={slmButton} key={decision} disabled={busy || entry.review_status === decision} onClick={() => act("slm_review_participant", { participant: entry.participant_id, decision, expected_updated_at: entry.updated_at })}>{label}</button>)}</div></article>)}
        {!entries.some(e => e.age_band === band) && <p className="mt-3 text-sm">No entries in this age band.</p>}
      </section>)}
    </>}
  </main>;
}
