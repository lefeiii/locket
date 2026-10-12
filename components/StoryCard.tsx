"use client";

import { Flag, MessageCircle, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { allowedReactions, commentsAllowed, getResponseMode, responseModes } from "@/lib/response-mode";
import { reactionLabels } from "@/lib/sample-data";
import type { Comment, ReactionKey, Story } from "@/lib/types";
import { ReportModal } from "@/components/ReportModal";
import { supabase } from "@/lib/supabase";
import { InlineCommentForm } from "@/components/CommentForm";
import { FollowButton } from "@/components/FollowButton";

const categoryStyles: Record<Story["category"], string> = {
  "my crush era": "bg-[#e9b3ad] text-[#514137]",
  "mommy issues": "bg-[#eee2d3] text-[#514137]",
  "daddy issues": "bg-[#eee2d3] text-[#514137]",
  "not a girls girl today because:": "bg-[#eee2d3] text-[#514137]",
  "im the girl bestfriend yall": "bg-[#eee2d3] text-[#514137]",
  "school was NOT it": "bg-[#eee2d3] text-[#514137]",
  "slay or be slayed": "bg-[#eee2d3] text-[#514137]",
  "he's so cooked": "bg-[#eee2d3] text-[#514137]",
  "she's so cooked": "bg-[#eee2d3] text-[#514137]",
  "ok but AITA tho": "bg-[#eee2d3] text-[#514137]",
  "the update dropped": "bg-[#eee2d3] text-[#514137]"
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
  const responseMode = getResponseMode(story.response_mode);
  const canComment = commentsAllowed(responseMode);
  const visibleReactions = allowedReactions(responseMode);
  const [reactionError, setReactionError] = useState("");
  const [reacting, setReacting] = useState(false);
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
    if (!client || story.id.startsWith("sample-")) return;
    client
      .from("stories")
      .select("id, title, part_number, update_label")
      .eq("story_arc_id", story.story_arc_id)
      .eq("anonymous_name", story.anonymous_name)
      .eq("is_hidden", false)
      .order("part_number", { ascending: true })
      .then(({ data }) => {
        setArcParts((data ?? []).filter(p => p.id !== story.id));
        setArcLoaded(true);
      });
  }, [story.story_arc_id, story.id, story.anonymous_name, arcLoaded]);

  // Fetch comments when panel opens
  useEffect(() => {
    if (!canComment || !commentOpen || commentsLoaded) return;
    const client = supabase;
    if (!client || story.id.startsWith("sample-")) return;
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
  }, [canComment, commentOpen, commentsLoaded, story.id]);

  const hasActivePoll = story.has_active_poll ?? false;
  const storyContext = story.update_label ?? null;

  // Find the next part in the arc (higher part_number than current)
  const currentPartNumber = story.part_number ?? 1;
  const nextPart = arcParts
    .filter(p => (p.part_number ?? 0) > currentPartNumber)
    .sort((a, b) => (a.part_number ?? 0) - (b.part_number ?? 0))[0] ?? null;

  async function react(label: ReactionKey) {
    if (reacting || !visibleReactions.includes(label)) return;
    setReactionError("");
    if (isGuest) { window.location.assign("/login"); return; }

    const alreadyReacted = reactionState.userReaction === label;
    const next = { ...reactionState.counts };
    if (alreadyReacted) {
      next[label] = Math.max(0, (next[label] ?? 0) - 1);
    } else {
      if (reactionState.userReaction && visibleReactions.includes(reactionState.userReaction)) {
        next[reactionState.userReaction] = Math.max(0, (next[reactionState.userReaction] ?? 0) - 1);
      }
      next[label] = (next[label] ?? 0) + 1;
    }

    setReactionState({ counts: next, userReaction: alreadyReacted ? null : label });

    const client = supabase;
    if (client && !story.id.startsWith("sample-")) {
      setReacting(true);
      try {
        const { error } = await client.from("stories").update({ reactions: next }).eq("id", story.id);
        if (error) throw error;
      } catch {
        setReactionState(reactionState);
        setReactionError("Could not save your reaction. The author may have changed their response preference.");
        return;
      } finally {
        setReacting(false);
      }

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
        className={`flex ${immersive ? "min-h-[calc(100svh-5rem)]" : ""} w-full flex-col justify-between rounded-[2rem] border border-[#e5d5c2] bg-[#fffaf2] p-6 shadow-sm sm:p-7`}
      >
        <div>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${categoryStyles[story.category] ?? "bg-[#eee2d3] text-[#514137]"}`}>
                {story.category}
              </span>
            </div>
            <button
              aria-label="Report story"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#eee2d3] text-[#514137]"
              onClick={() => setReportOpen(true)}
              type="button"
            >
              <Flag size={18} />
            </button>
          </div>

          <Link href={`/story/${story.id}`}>
            <h2 className="text-[1.65rem] font-medium leading-snug text-[#514137] sm:text-3xl">{story.title}</h2>
          </Link>
          <div className="mt-3 flex min-w-0 items-center gap-2 text-sm font-medium text-[#7d695a]">
            <Link className="min-w-0 truncate" href={`/profile/${story.anonymous_name}`}>
              @{story.anonymous_name}
            </Link>
          </div>
          <div className="mt-4 space-y-2 text-sm font-medium leading-6 text-[#7d695a]">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[#7d695a]">
              {storyContext && <><span>{storyContext}</span><span aria-hidden="true">·</span></>}
              <span className="text-[#94616c]">{responseModes[responseMode].label}</span>
            </p>
            {hasActivePoll ? (
              <Link className="inline-flex items-center gap-2 text-[#514137]" href={`/story/${story.id}#poll`}>
                <Sparkles size={15} />
                Readers are choosing the next move
              </Link>
            ) : null}
          </div>
          {story.previous_story_reference ? (
            <p className="mt-3 border-l-2 border-[#e9b3ad] pl-3 text-xs font-medium leading-5 text-[#7d695a]">
              Previous: {story.previous_story_reference}
            </p>
          ) : null}
          {arcParts.length > 0 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              <span className="shrink-0 rounded-full border border-[#e9b3ad] bg-[#e9b3ad] px-3 py-1.5 text-xs font-medium text-[#514137]">
                {story.update_label ?? `Part ${story.part_number ?? "?"}`} ← you are here
              </span>
              {arcParts.map((part) => (
                <Link
                  key={part.id}
                  href={`/story/${part.id}`}
                  className="shrink-0 rounded-full border border-[#e5d5c2] bg-[#fffaf2] px-3 py-1.5 text-xs font-medium text-[#7d695a] hover:bg-[#eee2d3]"
                >
                  {part.update_label ?? `Part ${part.part_number ?? "?"}`}
                </Link>
              ))}
            </div>
          )}
          <p className="mt-5 whitespace-pre-line text-[1.05rem] font-medium leading-7 text-[#514137]">{story.body}</p>
          {story.cliffhanger ? (
            <p className="mt-4 rounded-3xl bg-[#e9b3ad] p-4 text-xl font-medium leading-snug text-[#514137]">
              {story.cliffhanger}
            </p>
          ) : null}

          {/* Guest pinned prompt takes priority over next part button */}
          {isGuest && isPinned ? (
            <Link
              href="/login"
              className="mt-4 flex items-center justify-between rounded-3xl bg-[#514137] px-5 py-4 text-[#fffaf2]"
            >
              <span className="text-sm font-medium">see OP&apos;s update →</span>
              <span className="text-xs text-[#e5d5c2]">log in to keep reading</span>
            </Link>
          ) : nextPart ? (
            <Link
              href={`/story/${nextPart.id}`}
              className="mt-4 flex items-center justify-between rounded-3xl bg-[#514137] px-5 py-4 text-[#fffaf2]"
            >
              <span className="text-sm font-medium">
                {nextPart.update_label ?? `Part ${nextPart.part_number ?? "?"}`} is out →
              </span>
              <span className="text-xs text-[#e5d5c2]">keep reading</span>
            </Link>
          ) : null}
        </div>

        <div className="mt-7">
          {visibleReactions.length > 0 && <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {visibleReactions.map((label) => (
              <button
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium shadow-sm active:scale-95 ${
                  isGuest
                    ? "border-[#e5d5c2] bg-[#fffaf2] text-[#7d695a] opacity-60"
                    : userReaction === label
                    ? "border-[#e9b3ad] bg-[#e9b3ad] text-[#514137]"
                    : "border-[#e5d5c2] bg-[#fffaf2] text-[#514137]"
                }`}
                key={label}
                onClick={() => void react(label)}
                disabled={reacting}
                aria-pressed={userReaction === label}
                type="button"
              >
                {label} <span className="text-[#7d695a]">{counts[label] ?? 0}</span>
              </button>
            ))}
          </div>}
          {reactionError && <p role="alert" className="mt-2 text-xs text-[#7d695a]">{reactionError}</p>}
          {!canComment && <p className="text-sm text-[#7d695a]">{responseModes.listen.reminder}</p>}

          <div className="mt-4 flex items-center gap-3 text-[#514137]">
            {isGuest ? (
              <Link
                href="/login"
                className="flex items-center gap-2 rounded-full bg-[#e9b3ad] px-4 py-2 text-sm font-medium text-[#514137]"
              >
                {canComment ? "Log in to react and comment" : "Log in to follow this story"}
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                {canComment && <button
                  aria-label="Show comments"
                  className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium ${commentOpen ? "bg-[#e9b3ad] text-[#514137]" : "bg-[#eee2d3] text-[#514137]"}`}
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
                </button>}
                <FollowButton compact storyId={story.id} />
              </div>
            )}
          </div>
        </div>

        {canComment && commentOpen && (
          <div ref={commentRef} className="mt-3 grid gap-2">
            {!commentsLoaded ? (
              <p className="px-1 text-xs text-[#7d695a]">loading comments…</p>
            ) : comments.length === 0 ? (
              <p className="px-1 text-xs text-[#7d695a]">no comments yet — be the first!</p>
            ) : (
              <>
                {comments.map((c) => (
                  <div key={c.id} className="rounded-2xl bg-[#eee2d3] px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-[0.15em] text-[#7d695a]">@{c.anonymous_name}</p>
                    <p className="mt-1 text-sm font-medium leading-6 text-[#514137]">{c.body}</p>
                  </div>
                ))}
                {localCommentCount > 3 && (
                  <Link
                    href={`/story/${story.id}`}
                    className="text-center text-xs font-medium text-[#7d695a] underline underline-offset-2"
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
              responseMode={responseMode}
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
