import { AppNav, BrandBar } from "@/components/AppNav";
import { FeedFilters } from "@/components/FeedFilters";
import { StorySearch } from "@/components/StorySearch";
import { FollowingFeed } from "@/components/FollowingFeed";
import { GuestGate } from "@/components/GuestGate";
import { StoryCard } from "@/components/StoryCard";
import { sampleStories } from "@/lib/sample-data";
import { supabase } from "@/lib/supabase";
import type { Story } from "@/lib/types";

const PINNED_STORY_ID = "a8113f77-d500-468f-b360-e32beb0aba2e";

async function getStories(): Promise<Story[]> {
  if (!supabase) {
    return [...sampleStories];
  }

  const [pinnedRes, feedRes] = await Promise.all([
    supabase.from("stories").select("*").eq("id", PINNED_STORY_ID).maybeSingle(),
    supabase
      .from("stories")
      .select("*")
      .eq("is_hidden", false)
      .neq("id", PINNED_STORY_ID)
      .order("created_at", { ascending: false })
      .limit(19),
  ]);

  if (feedRes.error) return [];
  const feed = (feedRes.data ?? []) as Story[];
  if (pinnedRes.data && !pinnedRes.data.is_hidden) {
    return [pinnedRes.data as Story, ...feed];
  }
  return feed;
}

function filterStories(stories: Story[], activeFilter: string) {
  switch (activeFilter) {
    case "Updates":
      return stories.filter((story) => story.is_update);
    default:
      return stories;
  }
}

export default async function Home({ searchParams }: { searchParams?: Promise<{ filter?: string }> }) {
  const params = await searchParams;
  const feedFilters = ["For You", "Following", "Updates"];
  const activeFilter = feedFilters.includes(params?.filter ?? "") ? params?.filter ?? "For You" : "For You";

  // Always fetch all stories server-side — guest detection handled client-side in GuestGate
  const stories = await getStories();
  const pinnedStory = stories.find(s => s.id === PINNED_STORY_ID) ?? null;
  const visibleStories = filterStories(stories, activeFilter);

  return (
    <main>
      <BrandBar />

      <GuestGate
        activeFilter={activeFilter}
        allStories={stories}
        pinnedStory={pinnedStory}
        pinnedStoryId={PINNED_STORY_ID}
        visibleStories={visibleStories}
      />

      <AppNav />
    </main>
  );
}
