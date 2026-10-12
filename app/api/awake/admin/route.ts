import { NextResponse } from "next/server";
import { awakeDb, awakeUser, isAwakeAdmin, validNight } from "@/lib/awake-server";
import { findSafetyIssues } from "@/lib/safety";
export async function GET(req: Request) {
  const user = await awakeUser(req);
  if (!user || !user.email_confirmed_at || !isAwakeAdmin(user.email)) return NextResponse.json({ error: "Only the Locket owner can review prompts." }, { status: 403 });
  const { data, error } = await awakeDb().from("host_invitations").select("night,username,prompt,review_state,submitted_at,state").order("night", { ascending: false }).limit(30);
  return error ? NextResponse.json({ error: "Couldn’t load submissions. Check database setup." }, { status: 503 }) : NextResponse.json({ invitations: data });
}
export async function POST(req: Request) {
  try {
    const user = await awakeUser(req);
    if (!user || !user.email_confirmed_at || !isAwakeAdmin(user.email)) return NextResponse.json({ error: "Only the Locket owner can publish prompts." }, { status: 403 });
    const { night, approve, fallback } = await req.json();
    if (!validNight(night)) return NextResponse.json({ error: "Choose a valid date." }, { status: 400 });
    const db = awakeDb();
    if (typeof fallback === "string") {
      const text = fallback.trim();
      if (!text || text.length > 180 || findSafetyIssues(text).length) return NextResponse.json({ error: "Write a safe question of up to 180 characters." }, { status: 400 });
      const r = await db.from("awake_nights").insert({ night, prompt: text, host_username: "Locket" });
      return r.error ? NextResponse.json({ error: "Couldn’t publish. A thread may already exist for that date." }, { status: 409 }) : NextResponse.json({ published: true });
    }
    if (typeof approve !== "boolean") return NextResponse.json({ error: "Choose approve or decline." }, { status: 400 });
    const r = await db.rpc("review_awake_prompt", { p_night: night, p_approve: approve });
    return r.error || !r.data ? NextResponse.json({ error: "This submission cannot be reviewed again." }, { status: 409 }) : NextResponse.json({ reviewed: true });
  } catch { return NextResponse.json({ error: "Couldn’t review this prompt." }, { status: 400 }); }
}
