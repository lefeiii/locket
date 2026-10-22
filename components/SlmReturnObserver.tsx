"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

// No story contents or routes are transmitted. The database records one UTC day,
// only for opted-in participants and only in their initial seven-day window.
export function SlmReturnObserver() {
  const path = usePathname();
  const surface = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let active = true;
    async function record() {
      if (!active || document.hidden || !surface.current?.getClientRects().length) return;
      const { data: { user } } = await client!.auth.getUser();
      if (active && user && !document.hidden && surface.current?.getClientRects().length) await Promise.allSettled([client!.rpc("slm_record_return"),client!.rpc("slm_public_record_return")]);
    }
    void record().catch(() => {});
    const onVisible = () => { void record().catch(() => {}); };
    document.addEventListener("visibilitychange", onVisible);
    // Unlocking disguise mode can reveal the same route without a navigation.
    const reveal = new MutationObserver(onVisible);
    if (surface.current?.parentElement) reveal.observe(surface.current.parentElement, { attributes: true, attributeFilter: ["hidden"] });
    const { data: { subscription } } = client.auth.onAuthStateChange(() => { setTimeout(onVisible, 0); });
    return () => { active = false; document.removeEventListener("visibilitychange", onVisible); subscription.unsubscribe(); reveal.disconnect(); };
  }, [path]);
  return <span ref={surface} aria-hidden="true" className="pointer-events-none absolute h-px w-px opacity-0" />;
}
