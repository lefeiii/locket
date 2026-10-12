"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { DISGUISE_KEY, hashPin, readDisguise, type DisguiseSettings } from "@/lib/disguise";
import { supabase } from "@/lib/supabase";
import { usePathname } from "next/navigation";

const Context = createContext({ enabled: false, lock: () => {}, enable: (_settings: DisguiseSettings) => {}, disable: () => {} });
const button = "rounded-xl bg-[#d8d6d2] px-4 py-2 text-sm font-medium text-[#4f3325] disabled:opacity-50";
const input = "w-full rounded-xl border border-[#c8b7a7] bg-white px-3 py-2 text-sm";
type Task = { id: string; title: string; due: string; done: boolean };

export function DisguiseProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [locked, setLocked] = useState(true);
  const [opened, setOpened] = useState(false);
  const [access, setAccess] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [recover, setRecover] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const generation = useRef(0);
  function lock() { generation.current++; setLocked(true); setAccess(false); setPin(""); setPassword(""); setRecover(false); setError(""); }
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
    if (!active) return;
    try { setEnabled(Boolean(readDisguise())); } catch { setEnabled(true); }
    try { const saved = JSON.parse(localStorage.getItem("planner.tasks.v1") || "[]"); if (Array.isArray(saved)) setTasks(saved.filter(t => t && typeof t.title === "string" && typeof t.id === "string")); } catch {}
    setReady(true);
    });
    const hide = () => { if (document.visibilityState === "hidden") lock(); };
    const sync = (event: StorageEvent) => { if (event.key === DISGUISE_KEY || event.key === null) { try { setEnabled(Boolean(readDisguise())); } catch { setEnabled(true); } lock(); } };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", lock);
    window.addEventListener("storage", sync);
    return () => { active = false; document.removeEventListener("visibilitychange", hide); window.removeEventListener("pagehide", lock); window.removeEventListener("storage", sync); };
  }, []);
  useEffect(() => {
    if (!ready) return;
    const hidden = enabled && locked;
    document.title = hidden ? "Study Planner" : "Locket";
    let icon = document.querySelector<HTMLLinkElement>('link[data-disguise-icon]');
    if (hidden) {
      if (!icon) { icon = document.createElement("link"); icon.rel = "icon"; icon.dataset.disguiseIcon = "true"; document.head.appendChild(icon); }
      icon.href = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#2563eb"/><path d="M18 20h28M18 32h28M18 44h18" stroke="white" stroke-width="5"/></svg>');
    } else icon?.remove();
  }, [ready, enabled, locked, pathname]);
  function enable(settings: DisguiseSettings) { localStorage.setItem(DISGUISE_KEY, JSON.stringify(settings)); setEnabled(true); lock(); }
  function disable() { localStorage.removeItem(DISGUISE_KEY); setEnabled(false); setLocked(false); }
  function saveTasks(next: Task[]) { try { localStorage.setItem("planner.tasks.v1", JSON.stringify(next)); setTasks(next); setError(""); } catch { setError("Could not save your tasks on this device."); } }
  async function unlock(event: React.FormEvent) {
    event.preventDefault(); setError(""); setBusy(true); const attempt = generation.current;
    try {
      const settings = readDisguise(); if (!settings) throw new Error("Settings unavailable. Use account recovery.");
      if (settings.retryAt > Date.now()) throw new Error("Too many attempts. Please wait one minute before trying again.");
      if (await hashPin(pin, settings.salt) !== settings.hash) {
        settings.failures = (settings.failures || 0) + 1;
        if (settings.failures >= 5) { settings.retryAt = Date.now() + 60000; settings.failures = 0; }
        localStorage.setItem(DISGUISE_KEY, JSON.stringify(settings)); throw new Error("Incorrect PIN.");
      }
      if (attempt !== generation.current) return;
      localStorage.setItem(DISGUISE_KEY, JSON.stringify({ ...settings, failures: 0, retryAt: 0 })); setOpened(true); setLocked(false); setPin(""); setAccess(false);
    } catch (e) { if (attempt === generation.current) setError(e instanceof Error ? e.message : "Could not unlock."); }
    finally { setBusy(false); }
  }
  async function recoverPin(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); const attempt = generation.current;
    try {
      const settings = readDisguise(); if (!supabase || !settings) throw new Error("Account recovery is unavailable.");
      // Authenticate in an isolated client so a wrong account cannot replace the active session.
      const { createClient } = await import("@supabase/supabase-js");
      const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
      const { data, error: authError } = await client.auth.signInWithPassword({ email, password });
      if (authError || data.user?.id !== settings.ownerId) throw new Error("Use the email and password of the account that enabled disguise mode.");
      await client.auth.signOut();
      if (attempt !== generation.current) return;
      disable(); setPassword(""); setRecover(false);
    } catch (e) { if (attempt === generation.current) setError(e instanceof Error ? e.message : "Could not recover."); }
    finally { setBusy(false); }
  }
  const value = { enabled, lock, enable, disable };
  if (!ready) return <div className="min-h-screen bg-slate-50" />;
  return <Context.Provider value={value}>
    {enabled && locked ? <main className="fixed inset-0 z-[100] overflow-y-auto bg-slate-50 text-slate-800">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <header className="mb-8 flex items-center justify-between"><div><p className="text-xs uppercase tracking-widest text-slate-500">Make room for a productive day</p><h1 className="mt-2 text-3xl font-semibold">Study Planner</h1></div><button className="text-sm text-slate-500 underline" onClick={() => { setAccess(!access); setError(""); setPin(""); }}>Unlock</button></header>
        <div className="mb-6 rounded-2xl bg-blue-100 p-5"><p className="text-sm text-blue-800">Your progress</p><p className="mt-1 text-2xl font-semibold">{tasks.filter(t => t.done).length} / {tasks.length} tasks complete</p></div>
        <form className="mb-6 grid gap-3 rounded-2xl border bg-white p-5" onSubmit={e => { e.preventDefault(); if (!title.trim()) return; saveTasks([...tasks, { id: crypto.randomUUID(), title: title.trim(), due, done: false }]); setTitle(""); setDue(""); }}><label>Task<input className={input} value={title} onChange={e => setTitle(e.target.value)} placeholder="Read chapter 3" maxLength={200} required /></label><label>Due date<input className={input} type="date" value={due} onChange={e => setDue(e.target.value)} /></label><button className="rounded-xl bg-blue-600 px-4 py-2 text-white">Add task</button></form>
        <div className="grid gap-3">{tasks.length === 0 && <p className="py-6 text-center text-slate-500">Add your first task to plan your day.</p>}{tasks.map(task => <div key={task.id} className="flex items-center gap-3 rounded-xl border bg-white p-4"><input aria-label={`Complete ${task.title}`} type="checkbox" checked={task.done} onChange={() => saveTasks(tasks.map(t => t.id === task.id ? { ...t, done: !t.done } : t))} /><div className="flex-1"><p className={task.done ? "line-through text-slate-400" : ""}>{task.title}</p>{task.due && <p className="text-xs text-slate-500">Due {task.due}</p>}</div><button className="text-xs text-slate-500" onClick={() => saveTasks(tasks.filter(t => t.id !== task.id))}>Remove</button></div>)}</div>
        {access && <div className="mt-6 rounded-2xl border bg-white p-5">{recover ? <form onSubmit={recoverPin} className="grid gap-3"><h2 className="font-semibold">Recover workspace access</h2><p className="text-sm text-slate-500">Confirm your account email and password to remove the forgotten PIN.</p><input className={input} aria-label="Account email" type="email" value={email} onChange={e => setEmail(e.target.value)} required /><input className={input} aria-label="Account password" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required /><button className={button} disabled={busy}>Reset PIN</button><button type="button" className="text-sm underline" onClick={() => setRecover(false)}>Back</button></form> : <form onSubmit={unlock} className="grid gap-3"><label>Workspace PIN<input className={input} type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ""))} autoComplete="off" required /></label><button className={button} disabled={busy}>{busy ? "Checking…" : "Open workspace"}</button><button type="button" className="text-xs text-slate-500 underline" onClick={() => { setRecover(true); setError(""); }}>Forgot PIN?</button></form>}</div>}
        {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    </main> : <>{enabled && <button onClick={lock} className="fixed right-3 top-20 z-50 rounded-full bg-slate-800 px-4 py-2 text-xs font-medium text-white shadow-lg">Switch to planner</button>}</>}
    {(!enabled || opened) && <div hidden={enabled && locked}>{children}</div>}
  </Context.Provider>;
}

export function DisguiseSettings() {
  const mode = useContext(Context);
  const [setup, setSetup] = useState(false);
  const [pin, setPin] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError("");
    if (!/^\d{4}$/.test(pin) || pin !== confirmation) { setError("Enter the same four-digit PIN in both fields."); return; }
    setBusy(true);
    try {
      if (!supabase) throw new Error("Sign in to enable disguise mode.");
      const { data } = await supabase.auth.getUser(); if (!data.user) throw new Error("Sign in to enable disguise mode.");
      const salt = crypto.randomUUID(); const hash = await hashPin(pin, salt);
      mode.enable({ salt, hash, ownerId: data.user.id, failures: 0, retryAt: 0 });
    } catch (e) { setError(e instanceof Error ? e.message : "Could not enable disguise mode."); }
    finally { setBusy(false); }
  }
  return <section className="mb-5 rounded-2xl border border-[#c8b7a7] bg-[#f1e9e1] p-4"><div className="flex items-center justify-between gap-3"><h2 className="text-sm font-medium text-[#4f3325]">Disguise mode</h2><button role="switch" aria-checked={mode.enabled} className={button} onClick={() => { if (mode.enabled) mode.disable(); else setSetup(!setup); }}>{mode.enabled ? "On · Turn off" : "Off · Enable"}</button></div><p className="mt-2 text-xs text-[#6b4a3a]">Show a study planner until you enter your PIN. Locks when you leave this page. Applies to this browser only.</p>{setup && !mode.enabled && <form className="mt-4 grid gap-3" onSubmit={submit}><label className="text-sm">Four-digit PIN<input className={input} type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ""))} autoComplete="new-password" required /></label><label className="text-sm">Confirm PIN<input className={input} type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={confirmation} onChange={e => setConfirmation(e.target.value.replace(/\D/g, ""))} autoComplete="new-password" required /></label><p className="text-xs text-[#6b4a3a]">Remember your PIN. Recovery requires your account email and password. This hides the screen; browser history and notifications can still reveal Locket. Clearing browser data removes this setting.</p><button className={button} disabled={busy}>{busy ? "Setting up…" : "Enable and open planner"}</button><button type="button" className="text-xs underline" onClick={() => { setSetup(false); setPin(""); setConfirmation(""); }}>Cancel</button></form>}{error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}</section>;
}
