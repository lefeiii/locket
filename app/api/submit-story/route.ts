import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { findSafetyIssues } from "@/lib/safety";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { payload, pollQuestion, pollOptions, hasPoll } = body;

    // ── 0. Validate required fields ─────────────────────────────────────────
    if (!payload?.title?.trim() || !payload?.body?.trim() || !payload?.anonymous_name?.trim()) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    // ── 1. Server-side safety check ──────────────────────────────────────────
    const textToCheck = `${payload.title} ${payload.body} ${payload.previous_story_reference ?? ""}`;
    const issues = findSafetyIssues(textToCheck);
    if (issues.length > 0) {
      return NextResponse.json(
        { error: `Story contains unsafe content: ${issues.join(", ")}` },
        { status: 400 }
      );
    }

    // ── 2. Auth check ────────────────────────────────────────────────────────
    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // ── 3. Rate limit check ──────────────────────────────────────────────────
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    // Rate limit by user_id not anonymous_name — anonymous_name is user-controlled
    // and could be changed to bypass the limit
    const { count } = await serviceClient
      .from("stories")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", since);

    if ((count ?? 0) >= 5) {
      return NextResponse.json(
        { error: "You've posted too many stories recently. Please wait a bit before posting again." },
        { status: 429 }
      );
    }

    // ── 4. Insert story ──────────────────────────────────────────────────────
    const { data: story, error: insertError } = await serviceClient
      .from("stories")
      .insert(payload)
      .select("id")
      .single();

    if (insertError || !story) {
      return NextResponse.json(
        { error: insertError?.message ?? "Could not post story" },
        { status: 500 }
      );
    }

    // ── 5. Insert poll if present ────────────────────────────────────────────
    if (hasPoll && pollQuestion && pollOptions?.length >= 2) {
      await serviceClient.from("story_polls").insert({
        story_id: story.id,
        question: pollQuestion.trim(),
        options: pollOptions,
        is_active: true,
      });
    }

    return NextResponse.json({ id: story.id });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
