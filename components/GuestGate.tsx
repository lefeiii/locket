"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { FeedFilters } from "@/components/FeedFilters";
import { StorySearch } from "@/components/StorySearch";
import { FollowingFeed } from "@/components/FollowingFeed";
import { StoryCard } from "@/components/StoryCard";
import type { Story } from "@/lib/types";

type Props = {
  activeFilter: string;
  allStories: Story[];
  pinnedStory: Story | null;
  pinnedStoryId: string;
  visibleStories: Story[];
};

export function GuestGate({ activeFilter, allStories, pinnedStory, pinnedStoryId, visibleStories }: Props) {
  const [isGuest, setIsGuest] = useState<boolean | null>(null); // null = loading

  useEffect(() => {
    const client = supabase;
    if (!client) { setIsGuest(true); return; }
    client.auth.getUser().then(({ data }) => {
      setIsGuest(!data.user);
    });
  }, []);

  // While auth is loading, show nothing to avoid flash of wrong content
  if (isGuest === null) {
    return (
      <section className="mx-auto flex max-w-lg flex-col gap-5 px-4 pt-4 pb-28">
        <div className="rounded-[2rem] border border-[#d8d3ce] bg-[#f8f8f6] p-8 text-center shadow-sm">
          <p className="text-sm text-[#787775]">loading…</p>
        </div>
      </section>
    );
  }

  // Guest view — only pinned story
  if (isGuest) {
    return (
      <section className="mx-auto flex max-w-lg flex-col gap-5 px-4 pt-4 pb-28">
        {pinnedStory ? (
          <StoryCard
            story={pinnedStory}
            isGuest={true}
            isPinned={true}
          />
        ) : (
          <div className="rounded-[2rem] border border-[#d8d3ce] bg-[#f8f8f6] p-8 text-center shadow-sm">
            <p className="text-2xl">👀</p>
            <p className="mt-3 text-base font-medium text-[#4b4b47]">The drama is loading.</p>
            <p className="mt-1 text-sm text-[#787775]">Check back soon.</p>
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
      <section className="mx-auto flex max-w-lg flex-col gap-5 px-4 pt-4 pb-28">
        {activeFilter === "Following" ? (
          <FollowingFeed allStories={allStories} />
        ) : visibleStories.length === 0 ? (
          <div className="rounded-[2rem] border border-[#d8d3ce] bg-[#f8f8f6] p-8 text-center shadow-sm">
            <p className="text-2xl">📭</p>
            <p className="mt-3 text-base font-medium text-[#4b4b47]">Nothing here yet.</p>
            <p className="mt-1 text-sm text-[#787775]">Check back soon — the drama is always developing.</p>
          </div>
        ) : (
          visibleStories.map((story) => (
            <StoryCard
              key={story.id}
              story={story}
              isGuest={false}
              isPinned={story.id === pinnedStoryId}
            />
          ))
        )}
      </section>
    </>
  );
}
