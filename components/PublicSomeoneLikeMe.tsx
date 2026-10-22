"use client";
import Link from "next/link";
import { useEffect,useRef,useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSlmRpc } from "@/lib/use-slm-rpc";
import { slmTopics,slmButton,slmInput,connectionLabels } from "@/lib/someone-like-me";
import type { PublicSlmState } from "@/lib/slm-public";
import { PublicTopics,usePublicAction } from "@/components/SlmPublicShared";
import { PublicStoryOffer } from "@/components/PublicStoryOffer";

export function PublicSomeoneLikeMe({storyId}:{storyId?:string}){
 const {data,error,loading,reload}=useSlmRpc<PublicSlmState>('slm_public_state',{focus_story:storyId??null});
 const [started,setStarted]=useState(false);const [dismissed,setDismissed]=useState(false);const [editing,setEditing]=useState(false);const [connection,setConnection]=useState("");const [topics,setTopics]=useState<string[]>([]);const [consent,setConsent]=useState(false);const [leaving,setLeaving]=useState(false);const [account,setAccount]=useState(0);
 const {busy,notice,act}=usePublicAction(reload);const card=useRef<HTMLElement>(null);const seen=useRef(false);
 useEffect(()=>{const subscription=supabase?.auth.onAuthStateChange(event=>{if(event==='SIGNED_IN'||event==='SIGNED_OUT'){setStarted(false);setDismissed(event==='SIGNED_OUT');setEditing(false);setConnection("");setTopics([]);setConsent(false);setLeaving(false);setAccount(n=>n+1);seen.current=false;}}).data.subscription;return()=>subscription?.unsubscribe();},[]);
 useEffect(()=>{
  if(!storyId||!data?.available||data.preferences||dismissed||!card.current||typeof IntersectionObserver==='undefined')return;
  const observer=new IntersectionObserver(entries=>{if(document.hidden||seen.current||!entries.some(e=>e.isIntersecting))return;seen.current=true;void (async()=>{try{const result=await supabase?.rpc('slm_public_impression',{story_uuid:storyId});if(result?.error)seen.current=false;}catch{seen.current=false;}})();observer.disconnect();},{threshold:0.25});observer.observe(card.current);return()=>observer.disconnect();
 },[storyId,data,dismissed]);
 function edit(){setConnection(data?.preferences?.connection_preference??"");setTopics(data?.preferences?.topics??[]);setConsent(false);setEditing(true);setStarted(true);}
 if(storyId&&(dismissed||loading||!data?.available))return null;
 if(loading)return <p role="status" className="py-6 text-sm text-[#fff4ee]">Finding your little corner of Locket…</p>;
 if(error||!data)return <div className="my-5 rounded-3xl bg-[#fff7f8] p-5 text-sm leading-6 text-[#513940]"><p role="status">Story discovery isn’t available here yet. You can keep reading and replying on the feed.</p><Link href="/" className="mt-3 inline-block underline">Back to feed</Link><Link href="/login" className="ml-4 underline">Sign in</Link></div>;
 const showChoices=editing||(!data.preferences&&(!storyId||started));
 return <section ref={card} aria-label="Someone Like Me" className="my-5 rounded-[2rem] border border-[#ead4dc] bg-[#fff7f8] p-5 text-[#513940]">
  <h2 className="font-serif text-2xl">someone like me</h2><p className="mt-3 text-lg leading-7">somewhere out there, someone knows exactly how this feels.</p>
  <p className="mt-3 text-sm leading-6">Read a public story from someone going through something similar, or someone who’s been through it. If you want to reply, it stays on their public story.</p>
  {!data.available&&<p role="status" className="mt-3 text-sm">Story discovery is paused. You can still remove your choices below.</p>}
  {storyId&&!started&&!data.preferences&&data.available&&<div className="mt-4 flex flex-wrap gap-2"><button type="button" className={slmButton} onClick={edit}>find someone who understands</button><button type="button" className="min-h-11 px-4 text-sm" onClick={()=>setDismissed(true)}>maybe later</button></div>}
  {showChoices&&data.available&&<form className="mt-5 grid gap-4" onSubmit={async e=>{e.preventDefault();if(await act('slm_public_save',{connection_choice:connection,topic_choices:topics,consent},'Your reading choices are saved. Your own stories haven’t been opted in.')){setEditing(false);setConsent(false);}}}>
   <label className="text-sm">What would feel helpful right now?<select required className={slmInput} value={connection} disabled={busy} onChange={e=>setConnection(e.target.value)}><option value="">Choose what feels right</option>{Object.entries(connectionLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
   <PublicTopics value={topics} onChange={setTopics} disabled={busy}/>
   <p className="rounded-2xl bg-[#fffdfa] p-4 text-xs leading-6">We use only these choices to recommend stories their authors volunteered. We don’t analyze your story or infer what you’ve been through. Your reading choices stay private. We count this invitation and, after you opt in, your return days during the first seven days to learn whether this helps. <Link href="/someone-like-me/privacy" className="underline">Your privacy and choices</Link>.</p>
   <label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" required checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/>I’m at least 13 and choose to save these reading preferences and the activity records described above. This does not offer my own story or start private contact.</label>
   <div className="flex flex-wrap gap-2"><button type="submit" className={slmButton} disabled={busy||!consent||!connection||!topics.length}>{busy?'Saving…':'Find familiar stories'}</button>{(data.preferences||storyId)&&<button type="button" className="min-h-11 px-3 text-sm" disabled={busy} onClick={()=>{setEditing(false);setConsent(false);if(!data.preferences){setStarted(false);setDismissed(true);}}}>Maybe later</button>}</div>
  </form>}
  {data.preferences&&!editing&&<div className="mt-5"><p className="text-sm leading-6">You’d like to read about {connectionLabels[data.preferences.connection_preference]}. Topics: {data.preferences.topics.map(t=>slmTopics.find(([key])=>key===t)?.[1]).join(', ')}.</p><button type="button" className="mt-2 min-h-11 text-sm underline" disabled={busy||!data.available} onClick={edit}>Change my reading choices</button>
   {data.available&&<><h3 className="mt-4 font-serif text-xl">stories that might feel familiar</h3><p className="mt-2 text-xs leading-6">Chosen by shared topics and the author’s own description. Every story here was offered by its author and reviewed for this collection. A shared topic doesn’t mean two experiences are identical.</p>
    {!data.recommendations.length&&<div className="mt-3 rounded-2xl bg-[#fffdfa] p-4 text-sm leading-6">No opted-in, reviewed stories fit these choices yet. That doesn’t mean you’re the only one feeling this. You can change your topics, visit the feed, or check back another day.</div>}
    {data.recommendations.map(s=><article key={s.id} className="mt-3 rounded-2xl border border-[#ead4dc] bg-[#fffdfa] p-4"><p className="text-xs leading-6">{s.stage==='going_through'?'going through it now':s.stage==='been_through'?'been through it · open to encouragement':'some of both'} · {s.topics.map(t=>slmTopics.find(([key])=>key===t)?.[1]).join(', ')}</p><h4 className="mt-2 break-words font-serif text-xl"><Link href={`/story/${s.id}`} className="underline decoration-[#dcb8c6] underline-offset-4">{s.title}</Link></h4><Link href={`/story/${s.id}`} className="mt-3 inline-block min-h-11 py-3 text-sm underline">Read their public story →</Link></article>)}
   </>}
  </div>}
  {(!storyId||started||data.preferences)&&<PublicStoryOffer key={account} stories={data.stories} focusStory={storyId} available={data.available} reload={reload}/>}
  {(data.preferences||data.stories.some(s=>s.listing))&&<div className="mt-5 border-t border-[#ead4dc] pt-4 text-sm leading-6"><button type="button" className="min-h-11 underline" onClick={()=>setLeaving(true)}>Leave story discovery and delete my choices</button>{leaving&&<div className="mt-2"><p>Delete your reading preferences, return days, feedback and every story offer? Your original stories and public replies stay on Locket.</p><button type="button" className={`${slmButton} mt-3`} disabled={busy} onClick={async()=>{if(await act('slm_public_withdraw',{},'You’ve left story discovery. Your choices and linked discovery records have been deleted.')){setLeaving(false);setTopics([]);setConnection("");setConsent(false);setEditing(false);}}}>Yes, leave and delete</button><button type="button" className="ml-3 min-h-11" onClick={()=>setLeaving(false)}>Keep my choices</button></div>}</div>}
  {notice&&<p role="status" className="mt-4 text-sm leading-6">{notice}</p>}
  <p className="mt-5 text-xs leading-6"><Link href="/someone-like-me/privacy" className="underline">How story discovery works</Link> · <Link href="/someone-like-me" className="underline">My story discovery choices</Link></p>
  {!storyId&&<p className="mt-3 text-xs leading-6"><Link href="/someone-like-me/waitlist" className="underline">Manage or delete an earlier waitlist entry</Link>. Private introductions are disabled.</p>}
  {data.moderator&&<Link href="/someone-like-me/stories/review" className="mt-3 block text-sm underline">Review stories for this collection →</Link>}
 </section>;
}
