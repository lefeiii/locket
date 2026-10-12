import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const feelings = new Set(["Feeling replaced", "Confused", "Betrayed", "Feeling left out", "Hopeful", "Just needed to vent"]);
export async function POST(req: NextRequest) {
  try {
    const { storyId, feeling } = await req.json();
    if (typeof storyId !== "string" || !/^[0-9a-f-]{36}$/i.test(storyId) || !feelings.has(feeling))
      return NextResponse.json({ error: "Choose a valid story and feeling." }, { status: 400 });
    const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!token) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const auth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data, error } = await auth.auth.getUser(token);
    if (error || !data.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    // Only the authenticated owner can label a story; never trust a supplied username.
    const result = await db.from("stories").update({ feeling }).eq("id", storyId).eq("user_id", data.user.id).select("id").maybeSingle();
    if (result.error) return NextResponse.json({ error: "Could not save feeling." }, { status: 503 });
    if (!result.data) return NextResponse.json({ error: "Story not found." }, { status: 404 });
    return NextResponse.json({ saved: true });
  } catch { return NextResponse.json({ error: "Could not save feeling." }, { status: 400 }); }
}
