"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function EmailNotificationSettings() {
 const [uid,setUid]=useState<string>();
 const [values,setValues]=useState({story_updates:false,replies:false});
 const [ready,setReady]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState(supabase ? "Loading email preferences…" : "Email preferences are unavailable right now.");
 useEffect(()=>{
  const client=supabase;
  if(!client)return;
  let active=true;
  (async()=>{
   const {data:{user}}=await client.auth.getUser();
   if(!active)return;
   if(!user){setMessage("Log in to choose email notifications.");return;}
   setUid(user.id);
   const {data,error}=await client.from("email_delivery_preferences").select("story_updates,replies").eq("user_id",user.id).maybeSingle();
   if(!active)return;
   if(error){setMessage("Email preferences are not ready yet. Please try again later.");return;}
   if(data)setValues(data);
   setReady(true);setMessage("");
  })().catch(()=>{if(active)setMessage("Could not load email preferences. Please refresh.");});
  return ()=>{active=false;};
 },[]);
 async function save(){
  if(!supabase||!uid)return;
  setBusy(true);
  try{
   const {error}=await supabase.from("email_delivery_preferences").upsert({user_id:uid,...values},{onConflict:"user_id"});
   setMessage(error?"Could not save. Please try again.":"Email preferences saved.");
  }catch{setMessage("Could not save. Please try again.");}
  finally{setBusy(false);}
 }
 return <section className="mb-5 rounded-[2rem] border border-[#c8b7a7] bg-[#f1e9e1] p-5 shadow-sm">
  <h2 className="text-2xl">A little note from Locket</h2>
  <p className="my-3 text-sm leading-6">Choose what reaches your inbox. Emails never include story text or titles. Replies are grouped over an hour; reactions stay here.</p>
  {([['story_updates','New parts of stories I subscribe to'],['replies','Replies on my stories']] as const).map(([key,label])=><label key={key} className="my-4 flex items-center justify-between gap-4 text-sm"><span>{label}</span><input type="checkbox" checked={values[key]} disabled={!ready||busy} onChange={e=>setValues({...values,[key]:e.target.checked})}/></label>)}
  <button type="button" disabled={!ready||busy} onClick={save} className="rounded-2xl bg-[#c88d7d] px-4 py-3 text-sm disabled:opacity-50">{busy?'Saving…':'Save email choices'}</button>
  <p className="mt-3 text-xs leading-5">Optional, and you can unsubscribe at any time.</p>
  <p role="status" className="mt-2 text-sm">{message}</p>
 </section>;
}
