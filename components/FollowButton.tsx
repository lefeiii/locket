"use client";

import { Bell, HeartHandshake } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type FollowButtonProps = {
  posterName?: string;
  storyId?: string;
  compact?: boolean;
};

export function FollowButton({ posterName, storyId, compact = false }: FollowButtonProps) {
  const value = posterName ?? storyId ?? "";
  const isPersonFollow = Boolean(posterName);

  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Load current user + check if already following
  useEffect(() => {
    if (!value) { setLoading(false); return; }
    const client = supabase;
    if (!client) { setLoading(false); return; }

    client.auth.getUser().then(({ data }) => {
      const uid = data?.user?.id ?? null;
      setUserId(uid);
      if (!uid) { setLoading(false); return; }

      // Check if this user already follows this person/story
      const query = isPersonFollow
        ? client.from("follows").select("id").eq("follower_id", uid).eq("followed_name", value).maybeSingle()
        : client.from("story_follows").select("id").eq("user_id", uid).eq("story_id", value).maybeSingle();

      query.then(({ data: row }) => {
        setActive(!!row);
        setLoading(false);
      });
    });
  }, [value, isPersonFollow]);

  if (!value) return null;

  async function toggle() {
    const client = supabase;
    if (!client || !userId || processing) return;
    setProcessing(true);

    let error = null;
    if (isPersonFollow) {
      if (active) {
        ({ error } = await client.from("follows").delete().eq("follower_id", userId).eq("followed_name", value));
      } else {
        ({ error } = await client.from("follows").insert({ follower_id: userId, followed_name: value }));
      }
    } else {
      if (active) {
        ({ error } = await client.from("story_follows").delete().eq("user_id", userId).eq("story_id", value));
      } else {
        ({ error } = await client.from("story_follows").insert({ user_id: userId, story_id: value }));
      }
    }

    if (!error) setActive((v) => !v);
    setProcessing(false);
  }

  // Not logged in — show a link to login instead of a broken button
  if (!loading && !userId) {
    return (
      <a
        className={`flex items-center justify-center gap-2 rounded-full text-xs font-medium bg-[#f8f8f6] text-[#4b4b47] shadow-sm ${
          compact ? "min-h-10 px-3" : "min-h-12 px-4"
        }`}
        href="/login"
      >
        {isPersonFollow ? <HeartHandshake size={17} /> : <Bell size={17} />}
        {isPersonFollow ? "Follow for updates" : "Subscribe to story"}
      </a>
    );
  }

  return (
    <button
      className={`flex items-center justify-center gap-2 rounded-full text-xs font-medium transition active:scale-95 ${
        compact ? "min-h-10 px-3" : "min-h-12 px-4"
      } ${active ? "bg-[#f8c0c8] text-[#4b4b47]" : "bg-[#f8f8f6] text-[#4b4b47] shadow-sm"} ${
        (loading || processing) ? "opacity-50 pointer-events-none" : ""
      }`}
      onClick={toggle}
      type="button"
      disabled={loading || processing}
    >
      {isPersonFollow ? <HeartHandshake size={17} /> : <Bell size={17} />}
      {loading ? "…" : active
        ? "Following"
        : isPersonFollow ? "Follow for updates" : "Subscribe to story"}
    </button>
  );
}
