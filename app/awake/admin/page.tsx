"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AppNav, BrandBar } from "@/components/AppNav";
import { supabase } from "@/lib/supabase";
type Invitation = { night: string; username: string; prompt: string | null; review_state: string; state: string };
export default function AwakeAdmin() {
  const [items,setItems]=useState<Invitation[]>([]),[error,setError]=useState(""),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false),[authorized,setAuthorized]=useState(false);
  const [fallback,setFallback]=useState("What’s taking up space in your head tonight?");
  const [night,setNight]=useState("");
  async function call(payload?: object) {
    const { data } = await supabase!.auth.getSession();
    const res=await fetch("/api/awake/admin",{method:payload ? "POST":"GET",headers:{Authorization:`Bearer ${data.session?.access_token ?? ""}`,"Content-Type":"application/json"},body:payload ? JSON.stringify(payload):undefined});
    const result=await res.json();if(!res.ok)throw new Error(result.error);return result;
  }
  async function load(){try{const r=await call();setItems(r.invitations);setAuthorized(true);setError("");}catch(e){setError(e instanceof Error?e.message:"Couldn’t load review page.");}finally{setLoaded(true);}}
  useEffect(()=>{setNight(new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()));void load();},[]); // eslint-disable-line react-hooks/exhaustive-deps
  async function review(payload:object){setBusy(true);try{await call(payload);await load();}catch(e){setError(e instanceof Error?e.message:"Couldn’t save.");}finally{setBusy(false);}}
  return <main className="pb-24"><BrandBar /><section className="locket-page-panel mx-auto max-w-lg px-6 py-8">
    <h1 className="font-serif text-3xl">Tonight’s question</h1><p className="mt-2 text-sm text-[#6b4a3a]">Approve a host’s question to publish the thread. Declined questions stay private.</p>
    {!loaded && <p role="status" className="mt-4">Loading…</p>}{error && <p role="alert" className="mt-4">{error}</p>}
    {items.map(item=><article key={item.night} className="mt-5 rounded-2xl border border-[#c8b7a7] p-4"><p className="text-xs">{item.night} · @{item.username} · {item.review_state}</p><p className="mt-3">{item.prompt ?? `Waiting for a question (${item.state}).`}</p>
      {item.prompt && item.review_state==="pending" && <div className="mt-4 flex gap-3"><button disabled={busy} onClick={()=>review({night:item.night,approve:true})} className="rounded-full bg-[#c88d7d] px-4 py-2">Approve and publish</button><button disabled={busy} onClick={()=>review({night:item.night,approve:false})} className="rounded-full border border-[#c8b7a7] px-4 py-2">Decline</button></div>}</article>)}
    {authorized && <form className="mt-7 border-t border-[#c8b7a7] pt-5" onSubmit={e=>{e.preventDefault();void review({night,fallback});}}><h2 className="text-lg">Use your own question</h2><p className="mt-1 text-xs">For nights when a host can’t join. This publishes immediately.</p><label className="mt-3 block text-sm">Night<input type="date" required value={night} onChange={e=>setNight(e.target.value)} className="mt-1 block rounded-xl border p-2" /></label><label className="mt-3 block text-sm">Question<textarea required maxLength={180} value={fallback} onChange={e=>setFallback(e.target.value)} className="mt-1 w-full rounded-xl border p-3" /></label><button disabled={busy} className="mt-3 rounded-full bg-[#c88d7d] px-4 py-2">Publish this question</button></form>}
    <Link href="/awake" className="mt-6 inline-block underline">View Everyone’s Awake</Link>
  </section><AppNav /></main>;
}
