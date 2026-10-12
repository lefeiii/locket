import { AppNav, BrandBar } from "@/components/AppNav";
import { GuestGate } from "@/components/GuestGate";
import { sampleStories } from "@/lib/sample-data";
import { supabase } from "@/lib/supabase";
import type { Story } from "@/lib/types";
import { isStoryUpdate } from "@/lib/story-updates";

const PINNED_STORY_ID = "a8113f77-d500-468f-b360-e32beb0aba2e";

export const dynamic = "force-dynamic";

async function getStories(updatesOnly: boolean, pageSize = 10): Promise<Story[]> {
  if (!supabase) {
    return [...sampleStories].filter(s => !updatesOnly || isStoryUpdate(s))
      .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)).slice(0, pageSize);
  }

  let query = supabase.from("stories").select("*").eq("is_hidden", false)
    .neq("id", PINNED_STORY_ID).order("created_at", { ascending: false })
    .order("id", { ascending: false }).limit(pageSize);
  if (updatesOnly) query = query.eq("is_update", true).gt("part_number", 1)
    .not("story_arc_id", "is", null).neq("story_arc_id", "");

  const [pinnedRes, feedRes] = await Promise.all([
    supabase.from("stories").select("*").eq("id", PINNED_STORY_ID).maybeSingle(),
    query,
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
      return stories.filter(isStoryUpdate);
    default:
      return stories;
  }
}

export default async function Home({ searchParams }: { searchParams?: Promise<{ filter?: string }> }) {
  const params = await searchParams;
  const feedFilters = ["For You", "Following", "Updates"];
  const activeFilter = feedFilters.includes(params?.filter ?? "") ? params?.filter ?? "For You" : "For You";

  // Fetch the first page server-side; GuestGate handles guest access client-side.
  const stories = await getStories(activeFilter === "Updates", activeFilter === "Following" ? 19 : 10);
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

