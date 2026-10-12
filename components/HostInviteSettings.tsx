"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function HostInviteSettings() {
  const [uid, setUid] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    async function load() {
      if (!supabase) return;
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const result = await supabase.from("host_invite_preferences").select("enabled").eq("user_id", data.user.id).maybeSingle();
      if (!active || result.error) return; // Wait for the database migration before displaying this setting.
      setUid(data.user.id); setEnabled(result.data?.enabled ?? false); setReady(true);
    }
    void load(); return () => { active = false; };
  }, []);
  if (!ready) return null;
  async function toggle() {
    if (!supabase || busy) return;
    setBusy(true); setError("");
    try {
      const result = await supabase.from("host_invite_preferences").upsert({ user_id: uid, enabled: !enabled });
      if (result.error) throw result.error;
      setEnabled(!enabled);
    } catch { setError("Couldn’t save your preference. Please try again."); }
    finally { setBusy(false); }
  }
  return <section className="my-5 rounded-2xl border border-[#c8b7a7] bg-[#f1e9e1] p-4">
    <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-medium">Everyone’s Awake</h2>
      <button type="button" role="switch" aria-checked={enabled} aria-label="Email me host invitations" disabled={busy} onClick={toggle}
        className="rounded-full bg-[#d8d6d2] px-4 py-2 text-xs disabled:opacity-50">{busy ? "Saving…" : enabled ? "Invitations on" : "Invitations off"}</button></div>
    <p className="mt-2 text-xs leading-5 text-[#6b4a3a]">Want a turn choosing our nightly question? Opt in to an occasional invitation sent to your account email. You can turn this off anytime.</p>
    {error && <p role="alert" className="mt-2 text-xs">{error}</p>}
  </section>;
}
