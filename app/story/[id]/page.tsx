import { ArrowLeft, GitBranch } from "lucide-react";
import Link from "next/link";
import { AppNav, BrandBar } from "@/components/AppNav";
import { CommentSection } from "@/components/CommentSection";
import { FollowButton } from "@/components/FollowButton";
import { PollCard } from "@/components/PollCard";
import { StoryCard } from "@/components/StoryCard";
import { StorytimeExport } from "@/components/StorytimeExport";
import { samplePolls, sampleStories } from "@/lib/sample-data";
import { StoryOwnerActions } from "@/components/StoryOwnerActions";
import { supabase } from "@/lib/supabase";
import type { Comment, Story } from "@/lib/types";

async function getStory(id: string): Promise<Story | null> {
  if (!supabase) {
    return sampleStories.find((s) => s.id === id) ?? sampleStories[0];
  }
  const { data, error } = await supabase
    .from("stories")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) return null;
  return data as Story;
}

async function getComments(storyId: string): Promise<Comment[]> {
  if (!supabase || storyId.startsWith("sample-")) {
    return [
      {
        id: "comment-1",
        story_id: storyId,
        anonymous_name: "LowkeyLeo",
        body: "I need a part two immediately.",
        created_at: new Date().toISOString(),
      },
      {
        id: "comment-2",
        story_id: storyId,
        anonymous_name: "PlotTwistPal",
        body: "The way I would be overthinking every single word.",
        created_at: new Date().toISOString(),
      },
    ];
  }

  const { data } = await supabase
    .from("comments")
    .select("*, reply_to_id, reply_to_name")
    .eq("story_id", storyId)
    .order("created_at", { ascending: true });

  return (data ?? []) as Comment[];
}

async function getStoryArcFromDB(story: Story): Promise<Story[]> {
  if (!supabase || story.id.startsWith("sample-") || !story.story_arc_id) return [];

  const { data } = await supabase
    .from("stories")
    .select("*")
    .eq("story_arc_id", story.story_arc_id)
    .eq("is_hidden", false)
    .order("part_number", { ascending: true });

  return (data ?? []) as Story[];
}

async function getRelatedStories(story: Story): Promise<Story[]> {
  if (!supabase || story.id.startsWith("sample-")) {
    return sampleStories
      .filter(
        (item) =>
          item.id !== story.id &&
          (item.story_arc_id === story.story_arc_id ||
            item.category === "the update dropped" ||
            item.previous_story_reference === story.title)
      )
      .slice(0, 3);
  }

  const { data } = await supabase
    .from("stories")
    .select("*")
    .neq("id", story.id)
    .eq("is_hidden", false)
    .eq("category", "the update dropped")
    .order("created_at", { ascending: false })
    .limit(6);

  // Exclude other parts of the same arc to avoid duplicating what's shown in the arc section
  const arcSiblingIds: string[] = [];
  if (story.story_arc_id) {
    const { data: arcData } = await supabase
      .from("stories")
      .select("id")
      .eq("story_arc_id", story.story_arc_id)
      .neq("id", story.id);
    (arcData ?? []).forEach((s: { id: string }) => arcSiblingIds.push(s.id));
  }

  return ((data ?? []) as Story[]).filter((s) => !arcSiblingIds.includes(s.id)).slice(0, 3);
}

export default async function StoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const story = await getStory(id);

  if (!story) {
    return (
      <main className="pb-24">
        <BrandBar />
        <section className="mx-auto max-w-md px-4 py-5">
          <Link className="mb-4 flex items-center gap-2 text-sm font-medium text-[#4b4b47]" href="/">
            <ArrowLeft size={18} />
            Back to feed
          </Link>
          <div className="rounded-[2rem] border border-[#d8d3ce] bg-[#f8f8f6] p-8 text-center shadow-sm">
            <p className="text-2xl">📭</p>
            <p className="mt-3 text-lg font-medium text-[#4b4b47]">Story not found</p>
            <p className="mt-1 text-sm text-[#787775]">It may have been removed or never existed.</p>
            <Link href="/" className="mt-4 inline-block rounded-2xl bg-[#f8c0c8] px-5 py-2 text-sm font-medium text-[#4b4b47]">
              Back to feed →
            </Link>
          </div>
        </section>
        <AppNav />
      </main>
    );
  }

  const comments = await getComments(story.id);
  const arc = await getStoryArcFromDB(story);
  const poll = samplePolls.find(
    (item) => item.story_id === story.id && item.is_active
  );
  const related = await getRelatedStories(story);

  // Find next and previous parts in the arc
  const currentIndex = arc.findIndex((s) => s.id === story.id);
  const nextPart = currentIndex !== -1 && currentIndex < arc.length - 1 ? arc[currentIndex + 1] : null;
  const prevPart = currentIndex !== -1 && currentIndex > 0 ? arc[currentIndex - 1] : null;

  return (
    <main className="pb-24">
      <BrandBar />
      <section className="mx-auto max-w-md px-4 py-5">
        <Link
          className="mb-4 flex items-center gap-2 text-sm font-medium text-[#4b4b47]"
          href="/"
        >
          <ArrowLeft size={18} />
          Back to feed
        </Link>

        <StoryCard story={story} immersive={false} />

        <div className="mt-4 grid grid-cols-1 gap-3">
          <FollowButton storyId={story.id} />
        </div>

        {/* Prev / Next part navigation */}
        {(prevPart || nextPart) && (
          <div className="mt-4 flex gap-3">
            {prevPart && (
              <Link
                href={`/story/${prevPart.id}`}
                className="flex-1 rounded-2xl border border-[#d8d3ce] bg-[#f8f8f6] px-4 py-3 text-sm font-medium text-[#4b4b47] text-center hover:bg-[#e1e2e6] transition"
              >
                ← {prevPart.update_label ?? `Part ${prevPart.part_number ?? "?"}`}
              </Link>
            )}
            {nextPart && (
              <Link
                href={`/story/${nextPart.id}`}
                className="flex-1 rounded-2xl bg-[#f8c0c8] px-4 py-3 text-sm font-medium text-[#4b4b47] text-center hover:opacity-90 transition"
              >
                {nextPart.update_label ?? `Part ${nextPart.part_number ?? "?"}`} →
              </Link>
            )}
          </div>
        )}

        <StoryOwnerActions
          storyId={story.id}
          authorName={story.anonymous_name}
          initialTitle={story.title}
          initialBody={story.body}
          initialCategory={story.category}
          initialIsHidden={story.is_hidden ?? false}
        />

        {poll ? (
          <div className="mt-6" id="poll">
            <PollCard poll={poll} />
          </div>
        ) : null}

        {/* Story arc */}
        {arc.length > 1 && (
          <section className="mt-6 rounded-[2rem] border border-[#d8d3ce] bg-[#f8f8f6] p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <GitBranch size={20} />
              <h2 className="text-xl font-medium text-[#4b4b47]">
                {story.arc_title ?? "Story arc"}
              </h2>
            </div>
            <div className="grid gap-3">
              {arc.map((item) => (
                <Link
                  className={`rounded-3xl p-4 shadow-sm ${
                    item.id === story.id
                      ? "bg-[#f8c0c8] text-[#4b4b47]"
                      : "bg-[#e1e2e6] text-[#4b4b47]"
                  }`}
                  href={`/story/${item.id}`}
                  key={item.id}
                >
                  <p className="text-xs font-medium uppercase tracking-[0.2em] opacity-70">
                    {item.update_label ?? `Part ${item.part_number ?? 1}`}
                  </p>
                  <h3 className="mt-1 text-lg font-medium leading-tight">{item.title}</h3>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Comments with replies */}
        <CommentSection comments={comments} storyId={story.id} />

        <section className="mt-6">
          <StorytimeExport story={story} />
        </section>

        {related.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-3 text-xl font-medium text-[#4b4b47]">Related updates</h2>
            <div className="grid gap-3">
              {related.map((item) => (
                <Link
                  className="rounded-3xl bg-[#f8f8f6] p-4 shadow-lg"
                  href={`/story/${item.id}`}
                  key={item.id}
                >
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#787775]">
                    {item.category}
                  </p>
                  <h3 className="mt-1 text-lg font-medium text-[#4b4b47]">{item.title}</h3>
                </Link>
              ))}
            </div>
          </section>
        )}
      </section>
      <AppNav />
    </main>
  );
}
