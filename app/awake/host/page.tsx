"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AppNav, BrandBar } from "@/components/AppNav";
type Invitation = { username: string; night: string; submitted: boolean; expiresAt: string };
export default function HostForm() {
  const [token, setToken] = useState("");
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    const value = window.location.hash.slice(1); setToken(value);
    fetch("/api/awake/host", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: value, action: "view" }) })
      .then(async res => { const data = await res.json(); if (!res.ok) throw new Error(data.error); if (active) setInvitation(data); })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : "Couldn’t load your invitation."); })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError("");
    try {
      const res = await fetch("/api/awake/host", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, prompt }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error);
      setInvitation(current => current ? { ...current, submitted: true } : current);
    } catch(e) { setError(e instanceof Error ? e.message : "Couldn’t submit. Please try again."); }
    finally { setBusy(false); }
  }
  return <main className="pb-24"><BrandBar /><section className="locket-page-panel mx-auto max-w-lg px-6 py-8">
    <p className="text-xs tracking-widest text-[#6b4a3a]">EVERYONE’S AWAKE</p>
    <h1 className="mt-3 font-serif text-3xl">Your turn to ask.</h1>
    {!loaded ? <p className="mt-4" role="status">Opening your invitation…</p> : invitation?.submitted ? <div className="mt-5" role="status"><h2 className="text-xl">Your question is with Lefei.</h2><p className="mt-2 text-sm leading-6">Thank you for helping shape this little space. Your question will be reviewed before it goes live.</p><Link href="/awake" className="mt-5 inline-block underline">Visit Everyone’s Awake</Link></div> : invitation ? <form className="mt-5" onSubmit={submit}>
      <p className="text-sm leading-6">Hi @{invitation.username}. What would you like to ask Locket tonight? Something lighthearted, something honest—whatever feels right.</p>
      <label className="mt-5 block text-sm">Your question<textarea required maxLength={180} rows={3} value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="What’s something you wish you could say out loud?" className="mt-2 w-full rounded-2xl border border-[#c8b7a7] bg-[#f1e9e1] p-4 text-base" /></label>
      <p className="mt-1 text-right text-xs text-[#6b4a3a]">{prompt.length}/180</p>
      <p className="mt-3 text-xs leading-5 text-[#6b4a3a]">Keep names and identifying details out. If approved, your question and Locket username will be public. This private invitation closes at {new Date(invitation.expiresAt).toLocaleTimeString("en-CA", { timeZone: "America/Toronto", hour: "numeric", minute: "2-digit" })} Toronto time.</p>
      <button disabled={busy || !prompt.trim()} className="mt-5 w-full rounded-2xl bg-[#c88d7d] px-4 py-3 disabled:opacity-50">{busy ? "Sending…" : "Send my question to Lefei"}</button>
      <Link href="/awake" className="mt-4 block text-center text-sm underline">Maybe another night</Link>
    </form> : null}
    {error && <p role="alert" className="mt-4 text-sm">{error}</p>}
  </section><AppNav /></main>;
}
