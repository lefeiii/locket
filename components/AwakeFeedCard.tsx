"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Moon } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Night = { night: string; prompt: string; host_username: string };
function torontoDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
export function AwakeFeedCard() {
  const [thread, setThread] = useState<Night | null>(null);
  const [today, setToday] = useState("");
  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let alive = true, fetching = false;
    async function refresh() {
      if (fetching || document.visibilityState === "hidden") return;
      fetching = true;
      const date = torontoDate();
      try {
        const { data, error } = await client!.from("awake_nights")
          .select("night,prompt,host_username").lte("night", date)
          .lte("published_at", new Date().toISOString())
          .order("night", { ascending: false }).limit(1).maybeSingle();
        if (alive && !error) { setThread(data); setToday(date); }
      } catch { /* Keep the current card during a temporary connection failure. */ }
      finally { fetching = false; }
    }
    void refresh();
    const interval = window.setInterval(() => void refresh(), 60000);
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { alive = false; window.clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); };
  }, []);
  if (!thread) return null;
  return <aside aria-label="Pinned Everyone’s Awake conversation" className="rounded-3xl border border-[#c8b7a7] bg-[#f1e9e1] p-5 shadow-sm">
    <div className="flex items-center gap-2 text-xs font-medium text-[#6b4a3a]"><Moon size={15} aria-hidden="true" /><span>Everyone’s Awake · {thread.night === today ? "Tonight’s question" : "Latest conversation"}</span></div>
    <h2 className="mt-3 font-serif text-xl leading-snug text-[#4f3325]">{thread.prompt}</h2>
    <p className="mt-2 text-xs text-[#6b4a3a]">Chosen by @{thread.host_username}{thread.night !== today ? ` · ${thread.night}` : ""}</p>
    <Link href="/awake" className="mt-4 inline-flex rounded-full bg-[#c88d7d] px-4 py-2.5 text-sm font-medium text-[#4f3325]">Join the conversation →</Link>
  </aside>;
}
