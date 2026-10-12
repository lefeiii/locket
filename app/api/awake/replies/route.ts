import { NextResponse } from "next/server";
import { awakeDb, awakeUser, validNight } from "@/lib/awake-server";
import { findSafetyIssues } from "@/lib/safety";
export async function POST(req: Request) {
  try {
    const user = await awakeUser(req);
    if (!user) return NextResponse.json({ error: "Log in to join the conversation." }, { status: 401 });
    const { night, body } = await req.json();
    if (!validNight(night) || typeof body !== "string" || !body.trim() || body.trim().length > 1400 || findSafetyIssues(body).length)
      return NextResponse.json({ error: "Write a reply of up to 1,400 characters without identifying details or unsafe content." }, { status: 400 });
    const r = await awakeDb().rpc("add_awake_reply", { p_user_id: user.id, p_night: night, p_body: body.trim() });
    return r.error ? NextResponse.json({ error: "Couldn’t add your reply. If you’ve replied several times, take a little break and try again." }, { status: 400 }) : NextResponse.json({ saved: true });
  } catch { return NextResponse.json({ error: "Couldn’t save your reply." }, { status: 400 }); }
}
