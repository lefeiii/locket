import { ArrowLeft, Flag, GitBranch, MessageCircle } from "lucide-react";
import Link from "next/link";
import { AppNav, BrandBar } from "@/components/AppNav";
import { CommentForm } from "@/components/CommentForm";
import { FollowButton } from "@/components/FollowButton";
import { PollCard } from "@/components/PollCard";
import { StoryCard } from "@/components/StoryCard";
import { StorytimeExport } from "@/components/StorytimeExport";
import { UpdateAlarmButton } from "@/components/UpdateAlarmButton";
import { getStoryArc, samplePolls, sampleStories } from "@/lib/sample-data";
import { supabase } from "@/lib/supabase";
import type { Comment, Story } from "@/lib/types";

async function getStory(id: string): Promise<Story> {
  const sample = sampleStories.find((story) => story.id === id);
  if (!supabase) {
    return sample ?? sampleStories[0];
  }

  const { data, error } = await supabase.from("stories").select("*").eq("id", id).single();
  if (error || !data) {
    return sample ?? sampleStories[0];
  }

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
        created_at: new Date().toISOString()
      },
      {
        id: "comment-2",
        story_id: storyId,
        anonymous_name: "PlotTwistPal",
        body: "The way I would be overthinking every single word.",
        created_at: new Date().toISOString()
      }
    ];
  }

  const { data } = await supabase
    .from("comments")
    .select("*")
    .eq("story_id", storyId)
    .order("created_at", { ascending: true });

  return (data ?? []) as Comment[];
}

export default async function StoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const story = await getStory(id);
  const comments = await getComments(story.id);
  const arc = getStoryArc(story);
  const poll = samplePolls.find((item) => item.story_id === story.id && item.is_active);
  const related = sampleStories.filter(
    (item) =>
      item.id !== story.id &&
      (item.story_arc_id === story.story_arc_id || item.category === "the update dropped" || item.previous_story_reference === story.title)
  );

  return (
    <main className="pb-24">
      <BrandBar />
      <section className="mx-auto max-w-md px-4 py-5">
        <Link className="mb-4 flex items-center gap-2 text-sm font-medium text-[#4b4b47]" href="/">
          <ArrowLeft size={18} />
          Back to feed
        </Link>

        <StoryCard story={story} />

        <div className="mt-4 grid grid-cols-1 gap-3">
          <FollowButton storyId={story.id} />
          <FollowButton posterName={story.anonymous_name} />
          <UpdateAlarmButton />
        </div>

        {poll ? (
          <div className="mt-6" id="poll">
            <PollCard poll={poll} />
          </div>
        ) : null}

        <section className="mt-6 rounded-[2rem] border border-[#d8d3ce] bg-[#f8f8f6] p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <GitBranch size={20} />
            <h2 className="text-xl font-medium text-[#4b4b47]">{story.arc_title ?? "Story arc"}</h2>
          </div>
          <div className="grid gap-3">
            {arc.map((item) => (
              <Link
                className={`rounded-3xl p-4 shadow-sm ${item.id === story.id ? "bg-[#f8c0c8] text-[#4b4b47]" : "bg-[#e1e2e6] text-[#4b4b47]"}`}
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

        <section className="mt-6 rounded-[2rem] border border-[#d8d3ce] bg-[#f8f8f6] p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <MessageCircle size={20} />
            <h2 className="text-xl font-medium text-[#4b4b47]">Comments</h2>
          </div>

          <div className="grid gap-3">
            {comments.map((comment) => (
              <div className="rounded-2xl bg-[#e1e2e6] p-4" key={comment.id}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#787775]">
                    @{comment.anonymous_name}
                  </p>
                  <button aria-label="Report comment" className="text-[#787775]" type="button">
                    <Flag size={15} />
                  </button>
                </div>
                <p className="mt-1 text-sm font-medium leading-6 text-[#4b4b47]">{comment.body}</p>
              </div>
            ))}
          </div>

          <CommentForm storyId={story.id} />
        </section>

        <section className="mt-6">
          <StorytimeExport story={story} />
        </section>

        <section className="mt-6">
          <h2 className="mb-3 text-xl font-medium text-[#4b4b47]">Related updates</h2>
          <div className="grid gap-3">
            {(related.length ? related : sampleStories.slice(0, 2)).map((item) => (
              <Link className="rounded-3xl bg-[#f8f8f6] p-4 shadow-lg" href={`/story/${item.id}`} key={item.id}>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#787775]">{item.category}</p>
                <h3 className="mt-1 text-lg font-medium text-[#4b4b47]">{item.title}</h3>
              </Link>
            ))}
          </div>
        </section>
      </section>
      <AppNav />
    </main>
  );
}
