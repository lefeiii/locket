"use client";

import { Flag, MessageCircle, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { reactionLabels } from "@/lib/sample-data";
import type { Comment, ReactionKey, Story } from "@/lib/types";
import { ReportModal } from "@/components/ReportModal";
import { supabase } from "@/lib/supabase";
import { InlineCommentForm } from "@/components/CommentForm";
import { FollowButton } from "@/components/FollowButton";

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
  isGuest?: boolean;
  isPinned?: boolean;
};

export function StoryCard({ story, immersive = false, isGuest = false, isPinned = false }: StoryCardProps) {
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
  const [reportOpen, setReportOpen] = useState(false);
  const [localCommentCount, setLocalCommentCount] = useState(story.comments_count ?? 0);
  const [commentOpen, setCommentOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [arcParts, setArcParts] = useState<{id: string; title: string; part_number: number | null; update_label: string | null}[]>([]);
  const [arcLoaded, setArcLoaded] = useState(false);
  const commentRef = useRef<HTMLDivElement>(null);

  // Fetch real comment count on mount
  useEffect(() => {
    const client = supabase;
    if (!client || story.id.startsWith("sample-")) return;
    client
      .from("comments")
      .select("id", { count: "exact", head: true })
      .eq("story_id", story.id)
      .then(({ count }) => {
        if (count !== null) setLocalCommentCount(count);
      });
  }, [story.id]);

  // Fetch all parts in this arc whenever story_arc_id exists — not just for updates
  useEffect(() => {
    if (!story.story_arc_id || arcLoaded) return;
    const client = supabase;
    if (!client || story.id.startsWith("sample-")) { setArcLoaded(true); return; }
    client
      .from("stories")
      .select("id, title, part_number, update_label")
      .eq("story_arc_id", story.story_arc_id)
      .eq("is_hidden", false)
      .order("part_number", { ascending: true })
      .then(({ data }) => {
        setArcParts((data ?? []).filter(p => p.id !== story.id));
        setArcLoaded(true);
      });
  }, [story.story_arc_id, story.id, arcLoaded]);

  // Fetch comments when panel opens
  useEffect(() => {
    if (!commentOpen || commentsLoaded) return;
    const client = supabase;
    if (!client || story.id.startsWith("sample-")) { setCommentsLoaded(true); return; }
    client
      .from("comments")
      .select("*")
      .eq("story_id", story.id)
      .order("created_at", { ascending: false })
      .limit(3)
      .then(({ data }) => {
        setComments(([...(data ?? [])] as Comment[]).reverse());
        setCommentsLoaded(true);
      });
  }, [commentOpen, commentsLoaded, story.id]);

  const hasActivePoll = story.has_active_poll ?? false;
  const storyContext = story.update_label ?? null;

  // Find the next part in the arc (higher part_number than current)
  const currentPartNumber = story.part_number ?? 1;
  const nextPart = arcParts
    .filter(p => (p.part_number ?? 0) > currentPartNumber)
    .sort((a, b) => (a.part_number ?? 0) - (b.part_number ?? 0))[0] ?? null;

  function react(label: ReactionKey) {
    if (isGuest) { window.location.href = "/login"; return; }

    const alreadyReacted = reactionState.userReaction === label;
    const next = { ...reactionState.counts };
    if (alreadyReacted) {
      next[label] = Math.max(0, (next[label] ?? 0) - 1);
    } else {
      if (reactionState.userReaction) {
        next[reactionState.userReaction] = Math.max(0, (next[reactionState.userReaction] ?? 0) - 1);
      }
      next[label] = (next[label] ?? 0) + 1;
    }

    setReactionState({ counts: next, userReaction: alreadyReacted ? null : label });

    const client = supabase;
    if (client && !story.id.startsWith("sample-")) {
      client.from("stories").update({ reactions: next }).eq("id", story.id).then(() => {});

      if (!alreadyReacted) {
        client.auth.getUser().then(({ data }) => {
          const uid = data?.user?.id;
          if (!uid) return;
          client.from("users").select("username").eq("id", uid).single().then(({ data: profile }) => {
            const actorName = profile?.username;
            if (!actorName || actorName === story.anonymous_name) return;
            client.from("notifications").insert({
              recipient_name: story.anonymous_name,
              actor_name: actorName,
              story_id: story.id,
              message: `@${actorName} reacted "${label}" to your story`,
            }).then(() => {});
          });
        });
      }
    }
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
          <div className="mt-3 flex min-w-0 items-center gap-2 text-sm font-medium text-[#787775]">
            <Link className="min-w-0 truncate" href={`/profile/${story.anonymous_name}`}>
              @{story.anonymous_name}
            </Link>
          </div>
          <div className="mt-4 space-y-2 text-sm font-medium leading-6 text-[#787775]">
            {storyContext ? <p className="text-[#787775]">{storyContext}</p> : null}
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
          {arcParts.length > 0 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              <span className="shrink-0 rounded-full border border-[#f8c0c8] bg-[#f8c0c8] px-3 py-1.5 text-xs font-medium text-[#4b4b47]">
                {story.update_label ?? `Part ${story.part_number ?? "?"}`} ← you are here
              </span>
              {arcParts.map((part) => (
                <Link
                  key={part.id}
                  href={`/story/${part.id}`}
                  className="shrink-0 rounded-full border border-[#d8d3ce] bg-[#f8f8f6] px-3 py-1.5 text-xs font-medium text-[#787775] hover:bg-[#e1e2e6]"
                >
                  {part.update_label ?? `Part ${part.part_number ?? "?"}`}
                </Link>
              ))}
            </div>
          )}
          <p className="mt-5 whitespace-pre-line text-[1.05rem] font-medium leading-7 text-[#4b4b47]">{story.body}</p>
          {story.cliffhanger ? (
            <p className="mt-4 rounded-3xl bg-[#f8c0c8] p-4 text-xl font-medium leading-snug text-[#4b4b47]">
              {story.cliffhanger}
            </p>
          ) : null}

          {/* Guest pinned prompt takes priority over next part button */}
          {isGuest && isPinned ? (
            <Link
              href="/login"
              className="mt-4 flex items-center justify-between rounded-3xl bg-[#4b4b47] px-5 py-4 text-[#f8f8f6]"
            >
              <span className="text-sm font-medium">see OP&apos;s update →</span>
              <span className="text-xs text-[#d8d3ce]">log in to keep reading</span>
            </Link>
          ) : nextPart ? (
            <Link
              href={`/story/${nextPart.id}`}
              className="mt-4 flex items-center justify-between rounded-3xl bg-[#4b4b47] px-5 py-4 text-[#f8f8f6]"
            >
              <span className="text-sm font-medium">
                {nextPart.update_label ?? `Part ${nextPart.part_number ?? "?"}`} is out →
              </span>
              <span className="text-xs text-[#d8d3ce]">keep reading</span>
            </Link>
          ) : null}
        </div>

        <div className="mt-7">
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {reactionLabels.map((label) => (
              <button
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium shadow-sm active:scale-95 ${
                  isGuest
                    ? "border-[#d8d3ce] bg-[#f8f8f6] text-[#787775] opacity-60"
                    : userReaction === label
                    ? "border-[#f8c0c8] bg-[#f8c0c8] text-[#4b4b47]"
                    : "border-[#d8d3ce] bg-[#f8f8f6] text-[#4b4b47]"
                }`}
                key={label}
                onClick={() => react(label)}
                type="button"
              >
                {label} <span className="text-[#787775]">{counts[label]}</span>
              </button>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-3 text-[#4b4b47]">
            {isGuest ? (
              <Link
                href="/login"
                className="flex items-center gap-2 rounded-full bg-[#f8c0c8] px-4 py-2 text-sm font-medium text-[#4b4b47]"
              >
                log in to react &amp; comment 👀
              </Link>
            ) : (
              <div className="flex items-center gap-2">
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
                  {localCommentCount}
                </button>
                <FollowButton compact storyId={story.id} />
              </div>
            )}
          </div>
        </div>

        {commentOpen && (
          <div ref={commentRef} className="mt-3 grid gap-2">
            {!commentsLoaded ? (
              <p className="px-1 text-xs text-[#787775]">loading comments…</p>
            ) : comments.length === 0 ? (
              <p className="px-1 text-xs text-[#787775]">no comments yet — be the first!</p>
            ) : (
              <>
                {comments.map((c) => (
                  <div key={c.id} className="rounded-2xl bg-[#e1e2e6] px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-[0.15em] text-[#787775]">@{c.anonymous_name}</p>
                    <p className="mt-1 text-sm font-medium leading-6 text-[#4b4b47]">{c.body}</p>
                  </div>
                ))}
                {localCommentCount > 3 && (
                  <Link
                    href={`/story/${story.id}`}
                    className="text-center text-xs font-medium text-[#787775] underline underline-offset-2"
                  >
                    see all {localCommentCount} comments →
                  </Link>
                )}
              </>
            )}
            <InlineCommentForm
              onDone={() => {
                setCommentOpen(false);
                setCommentsLoaded(false);
              }}
              onCommentAdded={() => setLocalCommentCount((c) => c + 1)}
              storyId={story.id}
            />
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
