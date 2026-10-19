"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

export function useSlmRpc<T>(name: string, args: Record<string,unknown> = {}, poll = false) {
  const [data,setData] = useState<T>();
  const [error,setError] = useState("");
  const [loading,setLoading] = useState(true);
  const generation = useRef(0);
  const key = JSON.stringify(args);
  const params = useMemo(() => JSON.parse(key) as Record<string,unknown>,[key]);
  const reload = useCallback(async () => {
    const request = ++generation.current;
    try {
      if (!supabase) throw new Error("This part of Locket is not ready yet.");
      const {data:{user}} = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in to your Locket account to continue.");
      const result = await supabase.rpc(name,params);
      if (request !== generation.current) return;
      if (result.error) throw new Error(result.error.code === "42501" ? "This page isn’t available to this account." : "This pilot isn’t ready here yet, or the entry has changed. Try refreshing.");
      setData(result.data as T); setError("");
    } catch (e) {
      if (request === generation.current) { setData(undefined); setError(e instanceof Error ? e.message : "Could not load. Please refresh."); }
    } finally { if (request === generation.current) setLoading(false); }
  },[name,params]);
  useEffect(() => {
    let active = true;
    const version = generation;
    void Promise.resolve().then(() => { if (active) void reload(); });
    const onVisible = () => { if (active && !document.hidden) void reload(); };
    const subscription = supabase?.auth.onAuthStateChange(event => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT") return;
      generation.current++; setData(undefined); setLoading(true);
      setTimeout(() => { if (active) onVisible(); },0);
    }).data.subscription;
    document.addEventListener("visibilitychange",onVisible);
    const timer = poll ? setInterval(onVisible,15000) : undefined;
    return () => { active = false; version.current++; subscription?.unsubscribe(); document.removeEventListener("visibilitychange",onVisible); if (timer) clearInterval(timer); };
  },[reload,poll]);
  return {data,error,loading,reload};
}
