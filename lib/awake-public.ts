import { createClient } from "@supabase/supabase-js";
export type AwakeNight = { night: string; prompt: string; host_username: string };
export async function getPublicAwakeNight(): Promise<{ thread: AwakeNight | null; today: string; unavailable?: boolean }> {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { thread: null, today, unavailable: true };
  try {
    // Public read client: independent of browser sessions and never exposes private invitations.
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const r = await db.from("awake_nights").select("night,prompt,host_username")
      .lte("night", today).lte("published_at", now.toISOString())
      .order("night", { ascending: false }).limit(1)
      .abortSignal(AbortSignal.timeout(8000)).maybeSingle();
    return r.error ? { thread: null, today, unavailable: true } : { thread: r.data, today };
  } catch { return { thread: null, today, unavailable: true }; }
}
