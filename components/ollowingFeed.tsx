"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { StoryCard } from "@/components/StoryCard";
import type { Story } from "@/lib/types";

type Props = {
  allStories: Story[];
};

export function FollowingFeed({ allStories }: Props) {
  const [followedIds, setFollowedIds] = useState<string[] | null>(null);

  useEffect(() => {
    const client = supabase;
    if (!client) { setFollowedIds([]); return; }
    client.auth.getUser().then(({ data }) => {
      const uid = data?.user?.id;
      if (!uid) { setFollowedIds([]); return; }
      client
        .from("story_follows")
        .select("story_id")
        .eq("user_id", uid)
        .then(({ data: rows }) => {
          setFollowedIds((rows ?? []).map((r: { story_id: string }) => r.story_id));
        });
    });
  }, []);

  // Loading
  if (followedIds === null) {
    return (
      <div className="rounded-[2rem] border border-[#d8d3ce] bg-[#f8f8f6] p-8 text-center shadow-sm">
        <p className="text-sm text-[#787775]">Loading your followed stories…</p>
      </div>
    );
  }

  // Not logged in or no follows
  if (followedIds.length === 0) {
    return (
      <div className="rounded-[2rem] border border-[#d8d3ce] bg-[#f8f8f6] p-8 text-center shadow-sm">
        <p className="text-2xl">🔔</p>
        <p className="mt-3 text-base font-medium text-[#4b4b47]">No followed stories yet.</p>
        <p className="mt-1 text-sm text-[#787775]">
          Hit Subscribe on any story to follow its updates here.
        </p>
      </div>
    );
  }

  const followed = allStories.filter((s) => followedIds.includes(s.id));

  if (followed.length === 0) {
    return (
      <div className="rounded-[2rem] border border-[#d8d3ce] bg-[#f8f8f6] p-8 text-center shadow-sm">
        <p className="text-2xl">🔔</p>
        <p className="mt-3 text-base font-medium text-[#4b4b47]">No followed stories in the feed yet.</p>
        <p className="mt-1 text-sm text-[#787775]">
          The stories you follow might not have new updates yet.
        </p>
      </div>
    );
  }

  return (
    <>
      {followed.map((story) => (
        <StoryCard key={story.id} story={story} />
      ))}
    </>
  );
}
