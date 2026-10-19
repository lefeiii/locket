"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSlmRpc } from "@/lib/use-slm-rpc";
import { slmButton,slmInput } from "@/lib/someone-like-me";
import { contactReasons,type ConversationState } from "@/lib/slm-connections";

export function SlmConversation({id}:{id:string}){
 const {data,error,loading,reload}=useSlmRpc<ConversationState>("slm_conversation",{pair_uuid:id},true);
 const [body,setBody]=useState("");const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
 const [end,setEnd]=useState<"leave"|"block">();const [report,setReport]=useState<{message_id:string|null}>();const [reason,setReason]=useState("");
 useEffect(()=>{const subscription=supabase?.auth.onAuthStateChange(event=>{if(event==='SIGNED_IN'||event==='SIGNED_OUT'){setBody("");setEnd(undefined);setReport(undefined);setReason("");setMessage("");}}).data.subscription;return()=>subscription?.unsubscribe();},[]);
 async function action(name:string,args:Record<string,unknown>,notice:string){
  if(!supabase||busy)return;setBusy(true);setMessage("");
  try{const {error}=await supabase.rpc(name,args);if(error)throw new Error(name==='slm_send_message'?"Couldn’t submit. Use 1–800 characters without links, handles or phone numbers. Contact may be paused, or two messages may already be waiting for review.":"Could not save that action. Refresh and try again; block and leave remain available while contact is paused.");if(name==='slm_send_message')setBody("");await reload();setMessage(notice);setEnd(undefined);setReport(undefined);setReason("");}
  catch(e){setMessage(e instanceof Error?e.message:"Could not save. Try again.");}finally{setBusy(false);}
 }
 return <section className="rounded-[2rem] border border-[#ead4dc] bg-[#fff7f8] p-5 text-[#513940]">
  <h1 className="font-serif text-3xl">a little space to talk</h1>
  <p className="mt-3 text-sm leading-6">You’re speaking as an anonymous peer. Keep names, schools, locations, contact details and requests to move elsewhere out of this space. Authorized moderators can read and review messages.</p>
  <p className="mt-3 rounded-2xl bg-[#fffdfa] p-3 text-xs leading-6">Messages aren’t delivered instantly. Every message waits for moderator review; there’s no guaranteed response time. This is peer support, not counseling or emergency help. If someone is in immediate danger, contact local emergency services or a trusted adult now.</p>
  {loading&&<p role="status" className="mt-4 text-sm">Loading conversation…</p>}{error&&<p role="status" className="mt-4 text-sm">{error}</p>}
  {data&&<>
   {!data.can_send&&<p className="mt-4 text-sm leading-6">Contact is paused or closed. No new messages can be sent or delivered. You can still report, block, leave or remove your participation.</p>}
   <div className="my-5 grid gap-3" aria-label="Conversation messages">{data.messages.filter(m=>m.from_me||m.status==='approved').map(m=><article key={m.id} className={`max-w-[95%] rounded-2xl border border-[#ead4dc] p-4 text-sm leading-6 ${m.from_me?'ml-auto bg-[#f7e2e8]':'mr-auto bg-[#fffdfa]'}`}>
    <p className="text-xs font-medium">{m.from_me?'You':'Your peer'}</p><p className="mt-1 whitespace-pre-wrap break-words">{m.body}</p><p className="mt-2 text-xs">{new Date(m.created_at).toLocaleString()} · {m.status==='pending'?'Waiting for moderator review':m.status==='approved'?'Reviewed for delivery':m.status==='quarantined'?'Held for safety review':'Not delivered'}</p>
    {!m.from_me&&<button className="mt-2 min-h-11 text-xs underline" type="button" disabled={busy} onClick={()=>{setReport({message_id:m.id});setReason("");}}>Report this message</button>}
   </article>)}{!data.messages.length&&<p className="text-sm">You can start with a simple “I’ve felt that too.” Share only what feels comfortable.</p>}</div>
   <form onSubmit={e=>{e.preventDefault();void action("slm_send_message",{pair_uuid:id,message_text:body},"Your message is waiting for moderator review. Your peer cannot see it yet.");}}>
    <label className="text-sm">Your message<textarea className={`${slmInput} min-h-28 resize-y`} value={body} onChange={e=>setBody(e.target.value)} maxLength={800} disabled={busy||!data.can_send} required/></label>
    <p className="mt-1 text-xs">{body.length}/800 · text only · reviewed before delivery</p><button className={`${slmButton} mt-3`} type="submit" disabled={busy||!data.can_send||!body.trim()}>Submit for review</button>
   </form>
   <div className="mt-6 flex flex-wrap gap-4 text-sm"><button type="button" className="min-h-11 underline" disabled={busy} onClick={()=>setEnd('block')}>Block this connection</button><button type="button" className="min-h-11 underline" disabled={busy} onClick={()=>setEnd('leave')}>Leave conversation</button><button type="button" className="min-h-11 underline" disabled={busy} onClick={()=>{setReport({message_id:null});setReason("");}}>Report a concern</button></div>
   {end&&<div className="mt-4 rounded-2xl border border-[#ead4dc] bg-[#fffdfa] p-4 text-sm leading-6"><p>{end==='block'?"Block this connection permanently for this pilot? No more messages or introductions between you can be delivered. Your peer won’t be told that you blocked them.":"End this conversation? No more messages can be sent. You don’t owe an explanation."}</p><button type="button" className={`${slmButton} mt-3`} disabled={busy} onClick={()=>action("slm_end_contact",{pair_uuid:id,block_peer:end==='block'},"This connection is closed. No further contact is possible here.")}>Yes, {end==='block'?'block':'leave'}</button><button type="button" className="ml-4 min-h-11" disabled={busy} onClick={()=>setEnd(undefined)}>Cancel</button></div>}
   {report&&<div className="mt-4 rounded-2xl border border-[#ead4dc] bg-[#fffdfa] p-4 text-sm leading-6"><label>What feels wrong?<select className={slmInput} value={reason} onChange={e=>setReason(e.target.value)}><option value="">Choose a concern</option>{contactReasons.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><p className="mt-3">Reporting pauses delivery. If you chose a message, a restricted copy is retained for moderators even if the conversation is later deleted. This is not a live emergency queue.</p><button className={`${slmButton} mt-3`} type="button" disabled={busy||!reason} onClick={()=>action("slm_report_contact",{pair_uuid:id,message_uuid:report.message_id,reason_choice:reason},"Reported for review. Delivery is paused. You can also block or leave.")}>Report and pause contact</button><button type="button" className="ml-3 min-h-11" disabled={busy} onClick={()=>setReport(undefined)}>Cancel</button></div>}
   <fieldset disabled={busy} className="mt-6 border-t border-[#ead4dc] pt-4"><legend className="text-sm">Optional: did you feel understood here?</legend><div className="mt-3 flex gap-2">{[['yes','Yes'],['somewhat','A little'],['no','Not really']].map(([value,label])=><button type="button" key={value} aria-pressed={data.feedback===value} className={`${slmButton} ${data.feedback===value?'ring-2 ring-[#a7657b]':''}`} onClick={()=>action("slm_contact_feedback_save",{pair_uuid:id,answer:value},"Thank you. Your feedback is saved without sharing it with your peer.")}>{label}</button>)}</div></fieldset>
  </>}
  {message&&<p role="status" className="mt-4 text-sm leading-6">{message}</p>}
  <div className="mt-5 flex gap-4 text-xs"><button type="button" className="min-h-11 underline" onClick={()=>void reload()}>Refresh</button><Link className="inline-flex min-h-11 items-center underline" href="/someone-like-me/connections">Introductions and privacy controls</Link></div>
 </section>;
}
