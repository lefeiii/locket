import Link from "next/link";
import { ArrowDown, PenLine } from "lucide-react";
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

      <section className="mx-auto max-w-lg px-4 pb-5 pt-5">
        <div className="rounded-3xl border border-[#d8d3ce] bg-[#f8f8f6] p-6 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#787775]">Locket</p>
          <h1 className="mt-3 text-4xl font-medium leading-tight text-[#4b4b47]">
            Read the drama. Post the update. Stay anonymous.
          </h1>
          <p className="mt-4 text-sm font-medium leading-6 text-[#4b4b47]">
            Follow recurring anonymous characters, binge messy arcs, and get pulled back when the next update drops.
            Fresh drama at the top — always.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <a
              className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#787775] px-4 text-sm font-medium text-[#f8f8f6]"
              href="#feed"
            >
              <ArrowDown size={18} />
              Start Reading
            </a>
            <Link
              className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#f8c0c8] px-4 text-sm font-medium text-[#4b4b47]"
              href="/create"
            >
              <PenLine size={18} />
              Post Your Story
            </Link>
          </div>
        </div>
      </section>

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
