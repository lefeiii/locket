"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Lock } from "lucide-react";
import { emptyReactions } from "@/lib/sample-data";

export default function NewDiaryEntryPage() {
  const router = useRouter();
  const [username, setUsername] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    client.auth.getUser().then(({ data }) => {
      const uid = data?.user?.id;
      if (!uid) { router.push("/login"); return; }
      client.from("users").select("username").eq("id", uid).single().then(({ data: profile }) => {
        if (!profile?.username) { router.push("/login"); return; }
        setUsername(profile.username);
      });
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !title.trim() || !body.trim()) return;
    setStatus("saving");
    setErrorMsg("");

    const client = supabase;
    if (!client) { setErrorMsg("Not connected. Try again."); setStatus("error"); return; }

    const { data, error } = await client.from("stories").insert({
      anonymous_name: username,
      title: title.trim(),
      body: body.trim(),
      category: "my crush era", // default category, hidden from diary view
      is_diary_only: true,
      is_private: true,
      is_hidden: false,
      is_resolved: false,
      reactions: emptyReactions(),
      has_active_poll: false,
      story_arc_id: `diary-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      part_number: 1,
      update_label: "Entry",
    }).select("id").single();

    if (error || !data) {
      setErrorMsg("Could not save entry. Try again.");
      setStatus("error");
      return;
    }

    setStatus("saved");
    setTimeout(() => router.push("/diary"), 1000);
  }

  return (
    <main className="min-h-screen pb-28" style={{ background: "linear-gradient(160deg, #fdf6f0 0%, #fde8f0 100%)" }}>
      <header className="sticky top-0 z-30 px-4 py-3" style={{ background: "linear-gradient(160deg, #fdf6f0 0%, #fde8f0 100%)", borderBottom: "1px solid #f5d5e0" }}>
        <div className="mx-auto flex max-w-md items-center justify-between">
          <Link href="/diary" className="flex items-center gap-2 text-sm font-medium" style={{ color: "#6b5c52" }}>
            <ArrowLeft size={18} /> back to diary
          </Link>
          <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "#b08898" }}>
            <Lock size={13} /> private entry
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-md px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-medium" style={{ color: "#6b5c52", fontFamily: "Georgia, serif" }}>dear diary,</h1>
          <p className="mt-1 text-sm" style={{ color: "#b08898" }}>only you can see this. write freely. 🔒</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="give this entry a title..."
              maxLength={90}
              required
              className="w-full rounded-2xl border px-4 py-3 text-base font-medium outline-none focus:ring-4"
              style={{
                background: "#fffaf7",
                borderColor: "#f5d5e0",
                color: "#6b5c52",
                fontFamily: "Georgia, serif",
              }}
            />
          </div>

          <div>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="what's on your mind? no one's watching..."
              maxLength={3000}
              required
              rows={14}
              className="w-full resize-none rounded-2xl border px-4 py-4 text-base leading-7 outline-none focus:ring-4"
              style={{
                background: "#fffaf7",
                borderColor: "#f5d5e0",
                color: "#6b5c52",
                fontFamily: "Georgia, serif",
              }}
            />
            <p className="mt-1 text-right text-xs" style={{ color: "#c0a0aa" }}>{body.length}/3000</p>
          </div>

          {errorMsg && <p className="text-center text-sm text-red-400">{errorMsg}</p>}

          <button
            type="submit"
            disabled={status === "saving" || !title.trim() || !body.trim()}
            className="w-full rounded-2xl py-3 text-sm font-medium shadow-sm disabled:opacity-60 transition"
            style={{ background: "#f8c0c8", color: "#6b5c52" }}
          >
            {status === "saving" ? "saving..." : status === "saved" ? "saved 🤍" : "save to diary"}
          </button>

          <p className="text-center text-xs" style={{ color: "#b08898" }}>
            this entry is locked to your diary. you can flip it public anytime from your diary page.
          </p>
        </form>
      </section>

      <AppNav />
    </main>
  );
}
