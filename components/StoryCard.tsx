"use client";

import { Bookmark, Flag, MessageCircle, Send, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { reactionLabels, samplePolls } from "@/lib/sample-data";
import type { ReactionKey, Story } from "@/lib/types";
import { FollowButton } from "@/components/FollowButton";
import { ReportModal } from "@/components/ReportModal";
import { supabase } from "@/lib/supabase";
import { InlineCommentForm } from "@/components/CommentForm";

const categoryStyles: Record<Story["category"], string> = {
  "my crush era": "bg-[#f8c0c8] text-[#4b4b47]",
  "mommy issues": "bg-[#e1e2e6] text-[#4b4b47]",
  "daddy issues": "bg-[#e1e2e6] text-[#4b4b47]",
  "not a girls girl today because:": "bg-[#e1e2e6] text-[#4b4b47]",
  "im the girl bestfriend yall": "bg-[#e1e2e6] text-[#4b4b47]",
  "school was NOT it": "bg-[#e1e2e6] text-[#4b4b47]",
  "slay or be slayed": "bg-[#e1e2e6] text-[#4b4b47]",
  "he's so cooked": "bg-[#e1e2e6] text-[#4b4b47]",
  "she's so cooked": "bg-[#e1e2e6] text-[#4b4b47]",
  "ok but AITA tho": "bg-[#e1e2e6] text-[#4b4b47]",
  "the update dropped": "bg-[#e1e2e6] text-[#4b4b47]"
};

type StoryCardProps = {
  story: Story;
  immersive?: boolean;
};

export function StoryCard({ story, immersive = false }: StoryCardProps) {
  const [reactionState, setReactionState] = useState<{
    counts: Story["reactions"];
    userReaction: ReactionKey | null;
  }>(() => ({
    counts: {
      ...Object.fromEntries(reactionLabels.map((label) => [label, 0])),
      ...story.reactions
    } as Story["reactions"],
    userReaction: null,
  }));
  const { counts, userReaction } = reactionState;
  const [saved, setSaved] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const commentRef = useRef<HTMLDivElement>(null);
  const hasActivePoll = story.has_active_poll || samplePolls.some((poll) => poll.story_id === story.id && poll.is_active);
  const storyContext = [story.update_label, story.status, story.cliffhanger && !story.is_resolved ? "unresolved" : null]
    .filter(Boolean)
    .join(" · ");

  function react(label: ReactionKey) {
    setReactionState((prev) => {
      const alreadyReacted = prev.userReaction === label;
      const next = { ...prev.counts };
      if (alreadyReacted) {
        next[label] = Math.max(0, (next[label] ?? 0) - 1);
      } else {
        if (prev.userReaction) {
          next[prev.userReaction] = Math.max(0, (next[prev.userReaction] ?? 0) - 1);
        }
        next[label] = (next[label] ?? 0) + 1;
      }
      // Persist to Supabase — fire and forget
      const client = supabase;
      if (client && !story.id.startsWith("sample-")) {
        client
          .from("stories")
          .update({ reactions: next })
          .eq("id", story.id)
          .then(() => {});
      }
      return { counts: next, userReaction: alreadyReacted ? null : label };
    });
  }

  return (
    <>
      <article
        className={`flex ${immersive ? "min-h-[calc(100svh-5rem)]" : ""} w-full flex-col justify-between rounded-[2rem] border border-[#d8d3ce] bg-[#f8f8f6] p-5 shadow-sm`}
      >
        <div>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${categoryStyles[story.category] ?? "bg-[#e1e2e6] text-[#4b4b47]"}`}>
                {story.category}
              </span>
            </div>
            <button
              aria-label="Report story"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#e1e2e6] text-[#4b4b47]"
              onClick={() => setReportOpen(true)}
              type="button"
            >
              <Flag size={18} />
            </button>
          </div>

          <Link href={`/story/${story.id}`}>
            <h2 className="text-3xl font-medium leading-tight text-[#4b4b47] sm:text-4xl">{story.title}</h2>
          </Link>
          <div className="mt-3 flex items-center justify-between gap-3">
            <Link className="flex min-w-0 items-center gap-2 text-sm font-medium text-[#787775]" href={`/profile/${story.anonymous_name}`}>
              <span className="min-w-0 truncate">@{story.anonymous_name}</span>
            </Link>
            <FollowButton compact posterName={story.anonymous_name} />
          </div>
          <div className="mt-4 space-y-2 text-sm font-medium leading-6 text-[#787775]">
            {storyContext ? <p>{storyContext}</p> : null}
            {hasActivePoll ? (
              <Link className="inline-flex items-center gap-2 text-[#4b4b47]" href={`/story/${story.id}#poll`}>
                <Sparkles size={15} />
                Readers are choosing the next move
              </Link>
            ) : null}
          </div>
          {story.previous_story_reference ? (
            <p className="mt-3 border-l-2 border-[#f8c0c8] pl-3 text-xs font-medium leading-5 text-[#787775]">
              Previous: {story.previous_story_reference}
            </p>
          ) : null}
          <p className="mt-5 whitespace-pre-line text-[1.05rem] font-medium leading-7 text-[#4b4b47]">{story.body}</p>
          {story.cliffhanger ? (
            <p className="mt-4 rounded-3xl bg-[#f8c0c8] p-4 text-xl font-medium leading-snug text-[#4b4b47]">
              {story.cliffhanger}
            </p>
          ) : null}
        </div>

        <div className="mt-7">
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {reactionLabels.map((label) => (
              <button
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium shadow-sm active:scale-95 ${
                  userReaction === label
                    ? "border-[#f8c0c8] bg-[#f8c0c8] text-[#4b4b47]"
                    : "border-[#d8d3ce] bg-[#f8f8f6] text-[#4b4b47]"
                }`}
                key={label}
                onClick={() => react(label)}
                type="button"
              >
                {label} <span className={userReaction === label ? "text-[#4b4b47]" : "text-[#787775]"}>{counts[label]}</span>
              </button>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 text-[#4b4b47]">
            <button
              className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium ${commentOpen ? "bg-[#f8c0c8] text-[#4b4b47]" : "bg-[#e1e2e6] text-[#4b4b47]"}`}
              onClick={() => {
                setCommentOpen((v) => {
                  const next = !v;
                  if (next) {
                    setTimeout(() => {
                      commentRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                    }, 50);
                  }
                  return next;
                });
              }}
              type="button"
            >
              <MessageCircle size={18} />
              {story.comments_count ?? 0}
            </button>
            <div className="flex gap-2">
              <button
                aria-label="Save story"
                className={`grid h-11 w-11 place-items-center rounded-full ${saved ? "bg-[#f8c0c8] text-[#f8f8f6]" : "bg-[#e1e2e6] text-[#4b4b47]"}`}
                onClick={() => setSaved((value) => !value)}
                type="button"
              >
                <Bookmark fill={saved ? "currentColor" : "none"} size={19} />
              </button>
              <button
                aria-label="Share story"
                className="grid h-11 w-11 place-items-center rounded-full bg-[#e1e2e6] text-[#4b4b47]"
                type="button"
              >
                <Send size={19} />
              </button>
            </div>
          </div>
        </div>

        {commentOpen && (
          <div ref={commentRef} className="mt-3">
            <InlineCommentForm onDone={() => setCommentOpen(false)} storyId={story.id} />
          </div>
        )}
      </article>

      <ReportModal
        onClose={() => setReportOpen(false)}
        open={reportOpen}
        storyId={story.id}
        storyTitle={story.title}
      />
    </>
  );
}
