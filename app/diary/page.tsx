"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { supabase } from "@/lib/supabase";
import type { Story } from "@/lib/types";
import { Lock, PenLine, Globe } from "lucide-react";
import Image from "next/image";

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function DiaryPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    const client = supabase;
    if (!client) { setLoading(false); return; }

    client.auth.getUser().then(({ data }) => {
      const uid = data?.user?.id;
      if (!uid) { router.push("/login"); return; }

      client.from("users").select("username").eq("id", uid).single().then(({ data: profile }) => {
        if (!profile?.username) { router.push("/login"); return; }
        setUsername(profile.username);

        // Fetch all private or diary-only stories belonging to this user
        client
          .from("stories")
          .select("*")
          .eq("anonymous_name", profile.username)
          .or("is_private.eq.true,is_diary_only.eq.true")
          .order("created_at", { ascending: false })
          .then(({ data: stories }) => {
            setEntries(stories ?? []);
            setLoading(false);
          });
      });
    });
  }, [router]);

  async function togglePrivacy(story: Story) {
    const client = supabase;
    if (!client || togglingId) return;
    setTogglingId(story.id);

    // Diary-only entries can never be made public
    if (story.is_diary_only) {
      setTogglingId(null);
      return;
    }

    const newValue = !story.is_private;
    const { error } = await client
      .from("stories")
      .update({ is_private: newValue })
      .eq("id", story.id);

    if (!error) {
      if (newValue === false) {
        // Made public — remove from diary view since it's no longer private
        setEntries(prev => prev.filter(e => e.id !== story.id));
      } else {
        setEntries(prev =>
          prev.map(e => e.id === story.id ? { ...e, is_private: newValue } : e)
        );
      }
    }
    setTogglingId(null);
  }

  return (
    <main className="min-h-screen pb-28" style={{ background: "linear-gradient(160deg, #fdf6f0 0%, #fde8f0 100%)" }}>
      {/* Diary header */}
      <header className="sticky top-0 z-30 px-4 py-3" style={{ background: "linear-gradient(160deg, #fdf6f0 0%, #fde8f0 100%)", borderBottom: "1px solid #f5d5e0" }}>
        <div className="mx-auto flex max-w-md items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/diary-icon.png"
              alt="Oh Dear Diary"
              width={40}
              height={40}
              className="rounded-xl"
            />
            <div>
              <h1 className="text-lg font-medium leading-none" style={{ color: "#6b5c52", fontFamily: "Georgia, serif" }}>Oh Dear Diary</h1>
              <p className="text-[0.65rem] tracking-widest uppercase" style={{ color: "#b08898" }}>your secret chamber</p>
            </div>
          </div>
          <Link
            href="/diary/new"
            className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium shadow-sm"
            style={{ background: "#f8c0c8", color: "#6b5c52" }}
          >
            <PenLine size={14} />
            write
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-md px-4 py-5">
        {loading ? (
          <div className="space-y-3 mt-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-28 animate-pulse rounded-3xl" style={{ background: "#f5e6ee" }} />
            ))}
          </div>
        ) : !username ? null : entries.length === 0 ? (
          <div className="mt-12 text-center px-6">
            <p className="text-5xl mb-4">🔒</p>
            <p className="text-lg font-medium mb-2" style={{ color: "#6b5c52", fontFamily: "Georgia, serif" }}>your diary is empty</p>
            <p className="text-sm leading-6 mb-6" style={{ color: "#b08898" }}>
              write your first entry, or flip any of your public stories private to keep them just for you.
            </p>
            <Link
              href="/diary/new"
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium shadow-sm"
              style={{ background: "#f8c0c8", color: "#6b5c52" }}
            >
              <PenLine size={15} />
              write something
            </Link>
          </div>
        ) : (
          <div className="space-y-3 mt-2">
            {entries.map(entry => (
              <div
                key={entry.id}
                className="rounded-3xl p-5 shadow-sm"
                style={{ background: "#fffaf7", border: "1px solid #f5d5e0" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {entry.is_diary_only ? (
                        <span className="text-[10px] font-medium uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ background: "#f5e6ee", color: "#b08898" }}>diary only</span>
                      ) : (
                        <span className="text-[10px] font-medium uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ background: "#f5e6ee", color: "#b08898" }}>flipped private</span>
                      )}
                      <span className="text-[10px]" style={{ color: "#c0a0aa" }}>{timeAgo(entry.created_at)}</span>
                    </div>
                    <Link href={`/story/${entry.id}`}>
                      <h3 className="text-lg font-medium leading-tight" style={{ color: "#6b5c52", fontFamily: "Georgia, serif" }}>{entry.title}</h3>
                    </Link>
                    <p className="mt-2 line-clamp-2 text-sm leading-6" style={{ color: "#9b7c88" }}>{entry.body}</p>
                  </div>
                </div>

                {/* Toggle public/private — only for non diary-only entries */}
                {!entry.is_diary_only && (
                  <div className="mt-4 flex items-center justify-between border-t pt-3" style={{ borderColor: "#f5d5e0" }}>
                    <span className="text-xs font-medium" style={{ color: "#b08898" }}>
                      {entry.is_private ? "private — only you can see this" : "public on feed"}
                    </span>
                    <button
                      onClick={() => togglePrivacy(entry)}
                      disabled={togglingId === entry.id}
                      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition"
                      style={{
                        background: entry.is_private ? "#f5e6ee" : "#e8f5e9",
                        color: entry.is_private ? "#b08898" : "#5a8a6a",
                        opacity: togglingId === entry.id ? 0.5 : 1
                      }}
                    >
                      {entry.is_private ? <><Lock size={11} /> private</> : <><Globe size={11} /> public</>}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <AppNav />
    </main>
  );
}
