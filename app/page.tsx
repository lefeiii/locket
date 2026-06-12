import { AppNav, BrandBar } from "@/components/AppNav";
import { FeedFilters } from "@/components/FeedFilters";
import { StorySearch } from "@/components/StorySearch";
import { FollowingFeed } from "@/components/FollowingFeed";
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
  const stories = await getStories();
  const visibleStories = filterStories(stories, activeFilter);

  return (
    <main>
      <BrandBar />

      <FeedFilters active={activeFilter} />
      <StorySearch />

      <section
        className="mx-auto flex max-w-lg flex-col gap-5 px-4 pb-28"
        id="feed"
      >
        {activeFilter === "Following" ? (
          <FollowingFeed allStories={stories} />
        ) : visibleStories.length === 0 ? (
          <div className="rounded-[2rem] border border-[#d8d3ce] bg-[#f8f8f6] p-8 text-center shadow-sm">
            <p className="text-2xl">📭</p>
            <p className="mt-3 text-base font-medium text-[#4b4b47]">Nothing here yet.</p>
            <p className="mt-1 text-sm text-[#787775]">Check back soon — the drama is always developing.</p>
          </div>
        ) : (
          visibleStories.map((story) => (
            <StoryCard key={story.id} story={story} />
          ))
        )}
      </section>

      <AppNav />
    </main>
  );
}
