"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { AwakeFeedCard } from "@/components/AwakeFeedCard";
import { FeedFilters } from "@/components/FeedFilters";
import { StorySearch } from "@/components/StorySearch";
import { FollowingFeed } from "@/components/FollowingFeed";
import { StoryCard } from "@/components/StoryCard";
import { StoryFeed } from "@/components/StoryFeed";
import type { Story } from "@/lib/types";

type Props = {
  activeFilter: string;
  allStories: Story[];
  pinnedStory: Story | null;
  pinnedStoryId: string;
  visibleStories: Story[];
};

export function GuestGate({ activeFilter, allStories, pinnedStory, pinnedStoryId, visibleStories }: Props) {
  const [isGuest, setIsGuest] = useState<boolean | null>(supabase ? null : true); // null = loading

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    client.auth.getUser().then(({ data }) => {
      setIsGuest(!data.user);
    });
  }, []);

  // While auth is loading, show nothing to avoid flash of wrong content
  if (isGuest === null) {
    return (
      <section className="mx-auto flex max-w-lg flex-col gap-7 px-4 pt-6 pb-28">
        <div className="rounded-[2rem] border border-[#c8b7a7] bg-[#f1e9e1] p-8 text-center shadow-sm">
          <p className="text-sm text-[#6b4a3a]">loading…</p>
        </div>
      </section>
    );
  }

  // Guest view — only pinned story
  if (isGuest) {
    return (
      <section className="mx-auto flex max-w-lg flex-col gap-7 px-4 pt-6 pb-28">
        <AwakeFeedCard />
        {pinnedStory ? (
          <StoryCard
            story={pinnedStory}
            isGuest={true}
            isPinned={true}
          />
        ) : (
          <div className="rounded-[2rem] border border-[#c8b7a7] bg-[#f1e9e1] p-8 text-center shadow-sm">
            <p className="text-2xl">👀</p>
            <p className="mt-3 text-base font-medium text-[#4f3325]">The drama is loading.</p>
            <p className="mt-1 text-sm text-[#6b4a3a]">Check back soon.</p>
          </div>
        )}
      </section>
    );
  }

  // Logged-in view — full feed
  return (
    <>
      <FeedFilters active={activeFilter} />
      <StorySearch />
      <section className="mx-auto flex max-w-lg flex-col gap-7 px-4 pt-6 pb-28">
        <AwakeFeedCard />
        {activeFilter === "Following" ? (
          <FollowingFeed allStories={allStories} />
        ) : (
          <StoryFeed
            key={activeFilter}
            initialStories={visibleStories}
            pinnedStoryId={pinnedStoryId}
            updatesOnly={activeFilter === "Updates"}
          />
        )}
      </section>
    </>
  );
}

