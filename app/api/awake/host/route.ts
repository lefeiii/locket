import { NextResponse } from "next/server";
import { awakeDb, hostDigest } from "@/lib/awake-server";
import { findSafetyIssues } from "@/lib/safety";
export async function POST(req: Request) {
  try {
    const { token, prompt, action } = await req.json();
    const digest = hostDigest(token);
    if (!digest) return NextResponse.json({ error: "This invitation link isn’t valid." }, { status: 400 });
    const db = awakeDb();
    if (action === "view") {
      const { data, error } = await db.from("host_invitations").select("night,username,prompt,expires_at,review_state,state").eq("token_digest", digest).maybeSingle();
      if (error) return NextResponse.json({ error: "Couldn’t load your invitation." }, { status: 503 });
      if (!data || !data.expires_at || Date.parse(data.expires_at) <= Date.now() || !["sent","sending","uncertain"].includes(data.state))
        return NextResponse.json({ error: "This invitation has expired or isn’t available." }, { status: 410 });
      return NextResponse.json({ night: data.night, username: data.username, submitted: Boolean(data.prompt), expiresAt: data.expires_at });
    }
    if (typeof prompt !== "string" || !prompt.trim() || prompt.trim().length > 180 || findSafetyIssues(prompt).length)
      return NextResponse.json({ error: "Write a question of up to 180 characters without identifying details or unsafe content." }, { status: 400 });
    const result = await db.rpc("submit_awake_prompt", { p_digest: digest, p_prompt: prompt.trim() });
    if (result.error) return NextResponse.json({ error: "Couldn’t save your question. Please try again." }, { status: 503 });
    if (!result.data) return NextResponse.json({ error: "This invitation expired or already has a submitted question." }, { status: 409 });
    return NextResponse.json({ submitted: true });
  } catch { return NextResponse.json({ error: "Couldn’t process this invitation." }, { status: 400 }); }
}
