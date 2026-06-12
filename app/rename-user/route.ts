import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    // Guard all required env vars upfront
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json({ error: "Server misconfigured (missing Supabase URL/key)" }, { status: 500 });
    }

    const body = await req.json();
    const { oldUsername, newUsername } = body;
    console.log("[rename-user] request:", { oldUsername, newUsername: newUsername?.slice(0, 3) + "***" });

    if (!oldUsername || !newUsername) {
      return NextResponse.json({ error: "Missing username fields" }, { status: 400 });
    }

    if (newUsername === oldUsername) {
      return NextResponse.json({ success: true }); // no-op
    }
    if (!/^[a-zA-Z0-9._-]{2,30}$/.test(newUsername)) {
      return NextResponse.json({ error: "Invalid username format" }, { status: 400 });
    }

    // Verify auth
    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    console.log("[rename-user] auth:", user?.id ? "ok" : "failed", authError?.message ?? "");
    if (authError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    // Use service role to bypass RLS for bulk updates
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Check new username isn't already taken
    const { data: existing } = await serviceClient
      .from("users")
      .select("id")
      .eq("username", newUsername)
      .neq("id", user.id)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    }

    // Verify the user owns this username
    const { data: profile } = await serviceClient
      .from("users")
      .select("username")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.username !== oldUsername) {
      return NextResponse.json({ error: "Username mismatch" }, { status: 403 });
    }

    // Update username in users table
    const { error: userError } = await serviceClient
      .from("users")
      .update({ username: newUsername })
      .eq("id", user.id);
    if (userError) return NextResponse.json({ error: userError.message }, { status: 500 });

    // Update all stories
    const { error: storiesError } = await serviceClient
      .from("stories")
      .update({ anonymous_name: newUsername })
      .eq("anonymous_name", oldUsername);
    if (storiesError) {
      // Attempt to roll back username change
      await serviceClient.from("users").update({ username: oldUsername }).eq("id", user.id);
      return NextResponse.json({ error: "Could not update stories — username change rolled back" }, { status: 500 });
    }

    // Update all comments (non-critical — don't roll back if this fails)
    await serviceClient
      .from("comments")
      .update({ anonymous_name: newUsername })
      .eq("anonymous_name", oldUsername);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[rename-user]", message);
    return NextResponse.json({ error: `Server error: ${message}` }, { status: 500 });
  }
}
