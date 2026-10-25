"use client";
import { useState } from "react";
import { slmButton,slmInput,stageLabels } from "@/lib/someone-like-me";
import type { OwnPublicStory } from "@/lib/slm-public";
import { PublicTopics,usePublicAction } from "@/components/SlmPublicShared";
import Link from "next/link";

export function PublicStoryOffer({stories,focusStory,available,reload}:{stories:OwnPublicStory[];focusStory?:string;available:boolean;reload:()=>Promise<void>}){
 const [selected,setSelected]=useState(focusStory&&stories.some(s=>s.id===focusStory)?focusStory:"");const [editing,setEditing]=useState(false);
 const [topics,setTopics]=useState<string[]>([]);const [stage,setStage]=useState("");const [offering,setOffering]=useState(false);const [consent,setConsent]=useState(false);const [removing,setRemoving]=useState("");
 const {busy,notice,act}=usePublicAction(reload);const current=stories.find(s=>s.id===selected);
 function edit(id:string){const item=stories.find(s=>s.id===id);setSelected(id);setTopics(item?.listing?.topics??[]);setStage(item?.listing?.experience_stage??"");setOffering(item?.listing?.offer_encouragement??false);setConsent(false);setEditing(true);}
 return <section className="pt-2" aria-label="Offer a public story"><h3 className="font-serif text-xl">your story could help someone feel less alone</h3>
  <p className="mt-2 text-sm leading-6">Choose a public story you’d like someone else to find. We’ll review it first.</p>
  {!editing&&available&&stories.some(s=>s.public)&&<button type="button" className={`${slmButton} mt-3`} onClick={()=>edit(selected)}>Choose a story to offer</button>}
  {!stories.length&&<p className="mt-3 text-sm">After you publish a public story, you can choose to offer it here. Nothing is shared automatically.</p>}
  {editing&&<form className="mt-4 grid gap-4" onSubmit={async e=>{e.preventDefault();if(await act('slm_public_offer',{story_uuid:selected,topic_choices:topics,stage_choice:stage,encouragement:offering,consent},'Your story is waiting for review.')){setEditing(false);setConsent(false);}}}>
   <label className="text-sm">Which public story?<select required className={slmInput} value={selected} onChange={e=>edit(e.target.value)} disabled={busy}><option value="">Choose your story</option>{stories.filter(s=>s.public).map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
   <PublicTopics value={topics} onChange={setTopics} disabled={busy}/>
   <label className="text-sm">Where are you with this experience?<select required className={slmInput} value={stage} disabled={busy} onChange={e=>{setStage(e.target.value);if(e.target.value==='going_through')setOffering(false);}}><option value="">Only you can say</option>{Object.entries(stageLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
   {(stage==='been_through'||stage==='both')&&<label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={offering} disabled={busy} onChange={e=>setOffering(e.target.checked)}/>I’m open to offering encouragement in public replies.</label>}
   <details className="text-xs leading-6"><summary className="min-h-11 cursor-pointer py-3 underline">What readers will see</summary><p>Your public story, username and replies, plus the topics and experience stage you choose here. Your reading choices stay private. You can stop recommendations anytime without deleting your story. This is peer support; review doesn’t promise replies or professional care. <Link href="/someone-like-me/privacy" className="underline">Full privacy details</Link>.</p></details>
   <label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" required checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/>I’m 13+ and agree to recommend this story, its topics and experience stage. Readers can see my public username and full story.</label>
   <div className="flex flex-wrap gap-2"><button className={slmButton} type="submit" disabled={busy||!available||!current?.public||!topics.length||!stage||!consent}>Submit story for review</button><button className="min-h-11 px-3 text-sm" type="button" disabled={busy} onClick={()=>{setEditing(false);setConsent(false);}}>Maybe later</button></div>
  </form>}
  {stories.filter(s=>s.listing).map(s=><article key={s.id} className="mt-4 rounded-2xl border border-[#ead4dc] bg-[#fffdfa] p-4 text-sm leading-6"><Link href={`/story/${s.id}`} className="break-words underline">{s.title}</Link><p>{!s.public?'Not recommended · story isn’t public':s.listing!.review_status==='approved'?'Approved for recommendations':s.listing!.review_status==='paused'?'Recommendations paused by a moderator':'Waiting for moderator review'}</p><div className="mt-2 flex flex-wrap gap-3">{s.public&&available&&<button type="button" disabled={busy} className="min-h-11 underline" onClick={()=>edit(s.id)}>Change story choices</button>}<button type="button" disabled={busy} className="min-h-11 underline" onClick={()=>setRemoving(s.id)}>Stop recommending this story</button></div>{removing===s.id&&<div className="mt-2"><p>Your original public story stays on Locket. Stop including it in Someone Like Me?</p><button className={`${slmButton} mt-2`} type="button" disabled={busy} onClick={async()=>{if(await act('slm_public_unshare',{story_uuid:s.id},'Your story is no longer included in recommendations.'))setRemoving("");}}>Yes, stop recommending</button><button type="button" className="ml-3 min-h-11" onClick={()=>setRemoving("")}>Keep it</button></div>}</article>)}
  {notice&&<p role="status" className="mt-3 text-sm leading-6">{notice}</p>}
 </section>;
}
