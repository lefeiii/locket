"use client";
import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
export default function UnsubscribePage(){
 const [status,setStatus]=useState("");
 const [busy,setBusy]=useState(false);
 async function unsubscribe(){
  const token=new URLSearchParams(window.location.hash.slice(1)).get("token");
  if(!token||!/^[a-f0-9]{64}$/.test(token)){setStatus("This link is incomplete. You can also turn emails off in Settings.");return;}
  if(!supabase){setStatus("Please try again later.");return;}
  setBusy(true);
  try{const {error}=await supabase.rpc("unsubscribe_locket_email",{token});
   setStatus(error?"Could not unsubscribe. Please try again.":"You're unsubscribed from Locket notification emails.");
  }catch{setStatus("Could not unsubscribe. Please try again.");}finally{setBusy(false);}
 }
 return <main className="mx-auto max-w-md px-6 py-20"><h1 className="text-3xl">A quieter inbox</h1><p className="my-5">Turn off all Locket notification emails. Your account will stay here whenever you want to return.</p><button disabled={busy} onClick={unsubscribe} className="rounded-2xl bg-[#efd2c8] px-5 py-3">{busy?'Saving…':'Unsubscribe'}</button><p role="status" className="my-5">{status}</p><Link href="/settings">Notification settings</Link></main>;
}
