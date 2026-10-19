"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { BrandBar } from "@/components/AppNav";
import Link from "next/link";
import { ArrowLeft, Bell } from "lucide-react";

type Notification = {
  id: string;
  recipient_name: string;
  actor_name: string | null;
  story_id: string | null;
  message: string;
  read_at: string | null;
  created_at: string;
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    const client = supabase;
    if (!client) { setLoading(false); return; }

    client.auth.getUser().then(({ data }) => {
      const uid = data?.user?.id;
      if (!uid) { setLoading(false); return; }

      client.from("users").select("username").eq("id", uid).single().then(({ data: profile }) => {
        if (!profile?.username) { setLoading(false); return; }
        const uname = profile.username;
        setUsername(uname);

        client
          .from("notifications")
          .select("*")
          .eq("recipient_name", uname)
          .order("created_at", { ascending: false })
          .limit(50)
          .then(({ data: notifs }) => {
            const fetched = (notifs ?? []) as Notification[];
            setLoading(false);

            // Mark unread as read in local state immediately so UI clears
            setNotifications(fetched.map((n) => ({
              ...n,
              read_at: n.read_at ?? new Date().toISOString(),
            })));

            // Persist read_at to Supabase
            const unreadIds = fetched.filter((n) => !n.read_at).map((n) => n.id);
            if (unreadIds.length > 0) {
              client
                .from("notifications")
                .update({ read_at: new Date().toISOString() })
                .in("id", unreadIds)
                .then(() => {});
            }
          });
      });
    });
  }, []);

  return (
    <>
      <BrandBar />
      <main className="locket-page-panel mx-auto max-w-md px-3 py-6">
        <Link href="/someone-like-me/connections" className="mb-5 block rounded-3xl border border-[#ead4dc] bg-[#fff7f8] p-4 text-sm text-[#513940]">Someone Like Me · your optional introductions and conversations →</Link>
        <Link className="mb-4 flex items-center gap-2 text-sm font-medium text-[#4f3325]" href="/">
          <ArrowLeft size={18} /> Back to feed
        </Link>
        <h1 className="mb-5 text-2xl font-medium text-[#4f3325]">Activity</h1>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-[#d8d6d2]" />
            ))}
          </div>
        ) : !username ? (
          <div className="rounded-3xl border border-[#c8b7a7] bg-[#f1e9e1] p-8 text-center">
            <Bell className="mx-auto mb-3 text-[#c8b7a7]" size={32} />
            <p className="text-sm font-medium text-[#6b4a3a]">
              <Link href="/login" className="text-[#4f3325] underline underline-offset-2">Log in</Link> to see your activity.
            </p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="rounded-3xl border border-[#c8b7a7] bg-[#f1e9e1] p-8 text-center">
            <Bell className="mx-auto mb-3 text-[#c8b7a7]" size={32} />
            <p className="text-sm font-medium text-[#6b4a3a]">Nothing yet — when someone comments on or reacts to your story, you'll see it here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => (
              <div
                key={n.id}
                className="flex items-start gap-3 rounded-2xl border border-[#c8b7a7] bg-[#f1e9e1] px-4 py-3"
              >
                <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#d8d6d2] text-xs font-semibold text-[#4f3325]">
                  {n.actor_name ? n.actor_name[0].toUpperCase() : "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-5 text-[#4f3325]">{n.message}</p>
                  {n.story_id && (
                    <Link
                      href={`/story/${n.story_id}`}
                      className="mt-1 text-xs font-medium text-[#6b4a3a] underline underline-offset-2"
                    >
                      view story →
                    </Link>
                  )}
                </div>
                <span className="shrink-0 text-xs text-[#6b4a3a]">{timeAgo(n.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
