import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const { oldUsername, newUsername } = await req.json();

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
    if (authError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    // Use service role to bypass RLS for bulk updates
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
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
    await serviceClient
      .from("stories")
      .update({ anonymous_name: newUsername })
      .eq("anonymous_name", oldUsername);

    // Update all comments
    await serviceClient
      .from("comments")
      .update({ anonymous_name: newUsername })
      .eq("anonymous_name", oldUsername);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
