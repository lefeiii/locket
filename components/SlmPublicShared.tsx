"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { slmTopics } from "@/lib/someone-like-me";

export function PublicTopics({value,onChange,disabled=false}:{value:string[];onChange:(next:string[])=>void;disabled?:boolean}){
 return <fieldset disabled={disabled}><legend className="text-sm">What feels familiar? Choose up to three.</legend><div className="mt-3 flex flex-wrap gap-2">{slmTopics.map(([key,label])=><button key={key} type="button" aria-pressed={value.includes(key)} disabled={!value.includes(key)&&value.length>=3} onClick={()=>onChange(value.includes(key)?value.filter(t=>t!==key):[...value,key])} className={`min-h-11 rounded-full border px-3 py-2 text-sm disabled:opacity-40 ${value.includes(key)?'border-[#ba7b91] bg-[#efd2dc]':'border-[#e3cdd5] bg-[#fffdfa]'}`}>{label}</button>)}</div></fieldset>;
}
export function usePublicAction(reload:()=>Promise<void>){
 const [busy,setBusy]=useState(false);const [notice,setNotice]=useState("");const epoch=useRef(0);
 useEffect(()=>{const lifetime=epoch;const subscription=supabase?.auth.onAuthStateChange(event=>{if(event==='SIGNED_IN'||event==='SIGNED_OUT'){epoch.current++;setBusy(false);setNotice("");}}).data.subscription;return()=>{lifetime.current++;subscription?.unsubscribe();};},[]);
 async function act(name:string,args:Record<string,unknown>,success:string){
  if(!supabase||busy)return false;const version=epoch.current;setBusy(true);setNotice("");
  try{const result=await supabase.rpc(name,args);if(version!==epoch.current)return false;if(result.error)throw new Error("We couldn’t save that. Check your selections and verified login, or refresh and try again.");await reload();if(version!==epoch.current)return false;setNotice(success);return true;}
  catch(e){if(version===epoch.current)setNotice(e instanceof Error?e.message:"Could not save. Please try again.");return false;}finally{if(version===epoch.current)setBusy(false);}
 }
 return {busy,notice,act};
}
