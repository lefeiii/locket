"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSlmRpc } from "@/lib/use-slm-rpc";
import { slmTopics,slmButton } from "@/lib/someone-like-me";
import type { ContactState } from "@/lib/slm-connections";

export function SlmConnections() {
 const {data,error,loading,reload} = useSlmRpc<ContactState>("slm_contact_state",{},true);
 const [consent,setConsent] = useState(false);
 const [accepted,setAccepted] = useState<Record<string,boolean>>({});
 const [confirmLeave,setConfirmLeave] = useState(false);
 const [busy,setBusy] = useState(false);
 const [message,setMessage] = useState("");
 useEffect(()=>{const subscription=supabase?.auth.onAuthStateChange(event=>{if(event==='SIGNED_IN'||event==='SIGNED_OUT'){setConsent(false);setAccepted({});setConfirmLeave(false);setMessage("");}}).data.subscription;return()=>subscription?.unsubscribe();},[]);
 async function action(name:string,args:Record<string,unknown>,notice:string) {
  if (!supabase || busy) return;
  setBusy(true);setMessage("");
  try { const {error} = await supabase.rpc(name,args); if(error) throw new Error("Could not save that choice. The invitation may have changed or its safety checks may need review. Refresh and try again."); await reload();setConsent(false);setConfirmLeave(false);setMessage(notice); }
  catch(e){setMessage(e instanceof Error?e.message:"Could not save. Please try again.");} finally{setBusy(false);}
 }
 return <section className="rounded-[2rem] border border-[#ead4dc] bg-[#fff7f8] p-5 text-[#513940]">
  <h1 className="font-serif text-3xl">a little hello</h1>
  <p className="mt-3 text-sm leading-6">A place for reviewed introductions, when you both feel ready. Your username and original story are never shared here.</p>
  {loading&&<p role="status" className="mt-4 text-sm">Loading your choices…</p>}
  {error&&<p role="status" className="mt-4 text-sm">{error}</p>}
  {data&&<>
   {!data.enabled&&<p className="mt-4 rounded-2xl bg-[#fffdfa] p-4 text-sm leading-6">Live introductions are not open right now. Age assurance and moderator coverage must be ready before anyone can be connected. You can still manage your consent.</p>}
   {!data.enrolled?<p className="mt-5 text-sm"><Link href="/someone-like-me" className="underline">Join the optional waitlist first</Link>. No one is enrolled automatically.</p>:!data.opted_in?<div className="mt-5 text-sm leading-6">
    <h2 className="text-xl">Would a gentle introduction feel right?</h2>
    <p className="mt-3">This is a new choice, separate from the waitlist. With your permission, moderators can consider your selected topics and preferences for an introduction to one peer in the same externally checked age band.</p>
    <p className="mt-3">A proposed invitation shares only the broad topics you have in common, not identities or stories. Both people must then accept separately. Conversation text is visible to authorized moderators and reaches your peer only after review. No links, handles, contact details or attachments.</p>
    <p className="mt-3">You can decline, leave, block or report. Leaving contact participation deletes ordinary conversations for both people; reported evidence and blocks may remain restricted for safety. This isn’t counseling or live crisis support.</p>
    <p className="mt-3"><Link href="/someone-like-me/connections/privacy" className="underline">How introductions, age checks and privacy work</Link></p>
    <label className="mt-4 flex items-start gap-3"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/>I choose to be considered for reviewed introductions under these conditions. I understand that this does not accept an invitation or start a conversation.</label>
    <button type="button" className={`${slmButton} mt-4`} disabled={busy||!consent} onClick={()=>action("slm_contact_optin",{consent},"Your choice is saved. No conversation has started.")}>Let me choose an introduction later</button>
   </div>:<div className="mt-5 text-sm leading-6"><p>You’ve chosen to be considered. Nothing opens without your own acceptance and the other person’s acceptance.</p><p className="mt-2">{data.age_checked?"An external age-check record is current. This is not a guarantee about a peer’s identity or safety.":"A current external age check is still required before a moderator can propose an introduction. Don’t send identity documents or contact details through Locket."}</p>
    <button type="button" className="mt-3 min-h-11 underline" onClick={()=>setConfirmLeave(true)} disabled={busy}>Stop introductions and delete my conversations</button>
   </div>}
   {confirmLeave&&<div className="mt-4 rounded-2xl border border-[#ead4dc] p-4 text-sm leading-6"><p>Remove your contact consent, age-check record and ordinary conversation history? This removes those conversations for both people. Your waitlist choices and public stories stay. Restricted reported evidence and blocks remain for safety.</p><button type="button" className={`${slmButton} mt-3`} disabled={busy} onClick={()=>action("slm_contact_withdraw",{},"You’ve stopped contact participation and deleted ordinary conversation history.")}>Yes, stop and delete</button><button type="button" className="ml-3 min-h-11" disabled={busy} onClick={()=>setConfirmLeave(false)}>Keep my choice</button></div>}
   <div className="mt-6 grid gap-4">{data.connections.map(i=><article key={i.id} className="rounded-3xl border border-[#ead4dc] bg-[#fffdfa] p-4 text-sm leading-6">
    <h2 className="text-xl">{i.opened?"Your conversation":"someone understands a little of this"}</h2>
    <p className="mt-2">Shared topics: {i.topics.map(t=>slmTopics.find(([key])=>key===t)?.[1]).join(", ")}</p>
    {i.state==='invited'?<>
     {i.my_accepted?<p className="mt-3">Your acceptance is saved. Waiting for the other person to make their own choice.</p>:<>
      <p className="mt-3">A moderator reviewed this introduction. Would you like to say hello? There’s no pressure to accept, and declining won’t send an explanation.</p>
      <label className="mt-3 flex items-start gap-3"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={accepted[i.id]??false} disabled={busy} onChange={e=>setAccepted({...accepted,[i.id]:e.target.checked})}/>I accept this specific introduction and consent to a moderator-reviewed conversation. No personal details or original stories will be shared automatically.</label>
      <button className={`${slmButton} mt-3`} type="button" disabled={busy||!accepted[i.id]||!i.ready||!data.enabled} onClick={()=>action("slm_respond_introduction",{pair_uuid:i.id,choice:"accept",conversation_consent:true},"Acceptance saved. A conversation opens only after both people accept.")}>I’d like to say hello</button>
     </>}
     <button type="button" className="mt-2 block min-h-11 underline" disabled={busy} onClick={()=>action("slm_respond_introduction",{pair_uuid:i.id,choice:"decline",conversation_consent:false},"That introduction is closed. You don’t owe an explanation.")}>No thanks</button>
     {!i.ready&&<p className="mt-2 text-xs">This introduction needs updated safety checks before it can open.</p>}
    </>:i.opened?<><p className="mt-2">{i.state==='open'&&i.ready?"Both of you accepted. Messages wait for moderator review.":"Contact is paused or closed. You can still review history, report, block or leave."}</p><Link className={`${slmButton} mt-3 inline-block`} href={`/someone-like-me/conversations/${i.id}`}>Open conversation</Link></>:<p className="mt-3">This introduction is {i.state}. No conversation was opened.</p>}
   </article>)}</div>
   {data.opted_in&&!data.connections.length&&<p className="mt-5 text-sm leading-6">No invitations yet. This isn’t a promise of a match. You can keep using Locket as usual.</p>}
  </>}
  {message&&<p role="status" className="mt-4 text-sm leading-6">{message}</p>}
  <button type="button" onClick={()=>void reload()} className="mt-4 min-h-11 text-xs underline">Refresh</button>
 </section>;
}
