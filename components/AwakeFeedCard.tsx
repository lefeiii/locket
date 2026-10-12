"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Moon } from "lucide-react";


type Night = { night: string; prompt: string; host_username: string };
export function AwakeFeedCard({ initialThread = null, initialToday = "" }: { initialThread?: Night | null; initialToday?: string }) {
  const [thread, setThread] = useState<Night | null>(initialThread);
  const [today, setToday] = useState(initialToday);
  useEffect(() => {
    let alive = true, fetching = false;
    async function refresh() {
      if (fetching || document.visibilityState === "hidden") return;
      fetching = true;
      try {
        const response = await fetch("/api/awake/latest", { cache: "no-store", signal: AbortSignal.timeout(10000) });
        if (!response.ok) return;
        const data = await response.json();
        if (alive) { setThread(data.thread); setToday(data.today); }
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
