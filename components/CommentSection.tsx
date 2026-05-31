"use client";

import { Flag, MessageCircle, CornerDownRight } from "lucide-react";
import { useState } from "react";
import { CommentForm } from "@/components/CommentForm";
import { ReportModal } from "@/components/ReportModal";

type Comment = {
  id: string;
  story_id: string;
  anonymous_name: string;
  body: string;
  created_at: string;
  reply_to_id?: string | null;
  reply_to_name?: string | null;
};

type Props = {
  comments: Comment[];
  storyId: string;
};

export function CommentSection({ comments, storyId }: Props) {
  const [replyingTo, setReplyingTo] = useState<{ id: string; name: string } | null>(null);
  const [reportingComment, setReportingComment] = useState<string | null>(null);

  // Separate top-level comments from replies
  const topLevel = comments.filter((c) => !c.reply_to_id);
  const replies = comments.filter((c) => c.reply_to_id);

  // Group replies by parent comment id
  const replyMap: Record<string, Comment[]> = {};
  for (const reply of replies) {
    const pid = reply.reply_to_id!;
    if (!replyMap[pid]) replyMap[pid] = [];
    replyMap[pid].push(reply);
  }

  return (
    <section className="mt-6 rounded-[2rem] border border-[#d8d3ce] bg-[#f8f8f6] p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <MessageCircle size={20} />
        <h2 className="text-xl font-medium text-[#4b4b47]">
          Comments{" "}
          {comments.length > 0 && (
            <span className="text-[#787775]">({comments.length})</span>
          )}
        </h2>
      </div>

      {topLevel.length === 0 ? (
        <p className="rounded-2xl bg-[#e1e2e6] p-4 text-sm font-medium text-[#787775]">
          No comments yet. Be the first 👀
        </p>
      ) : (
        <div className="grid gap-3">
          {topLevel.map((comment) => (
            <div key={comment.id}>
              {/* Parent comment */}
              <div className="rounded-2xl bg-[#e1e2e6] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#787775]">
                    @{comment.anonymous_name}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      className="text-xs font-medium text-[#787775] underline underline-offset-2"
                      onClick={() =>
                        setReplyingTo(
                          replyingTo?.id === comment.id
                            ? null
                            : { id: comment.id, name: comment.anonymous_name }
                        )
                      }
                      type="button"
                    >
                      {replyingTo?.id === comment.id ? "cancel" : "reply"}
                    </button>
                    <button
                      aria-label="Report comment"
                      className="text-[#787775]"
                      onClick={() => setReportingComment(comment.id)}
                      type="button"
                    >
                      <Flag size={14} />
                    </button>
                  </div>
                </div>
                <p className="mt-1 text-sm font-medium leading-6 text-[#4b4b47]">
                  {comment.body}
                </p>
              </div>

              {/* Inline reply form */}
              {replyingTo?.id === comment.id && (
                <div className="ml-6 mt-2">
                  <CommentForm
                    storyId={storyId}
                    replyToId={comment.id}
                    replyToName={comment.anonymous_name}
                    onCancelReply={() => setReplyingTo(null)}
                  />
                </div>
              )}

              {/* Replies to this comment */}
              {(replyMap[comment.id] ?? []).map((reply) => (
                <div key={reply.id} className="ml-6 mt-2 flex gap-2">
                  <CornerDownRight size={14} className="mt-3 shrink-0 text-[#787775]" />
                  <div className="flex-1 rounded-2xl bg-[#f8f8f6] border border-[#d8d3ce] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#787775]">
                        @{reply.anonymous_name}
                        {reply.reply_to_name && (
                          <span className="ml-1 text-[#f8c0c8]">→ @{reply.reply_to_name}</span>
                        )}
                      </p>
                      <button
                        aria-label="Report comment"
                        className="text-[#787775]"
                        onClick={() => setReportingComment(reply.id)}
                        type="button"
                      >
                        <Flag size={14} />
                      </button>
                    </div>
                    <p className="mt-1 text-sm font-medium leading-6 text-[#4b4b47]">
                      {reply.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Main comment form — only shows when not replying */}
      {!replyingTo && (
        <CommentForm storyId={storyId} />
      )}
    </section>

    <ReportModal
      open={reportingComment !== null}
      onClose={() => setReportingComment(null)}
      commentId={reportingComment ?? undefined}
      storyId={storyId}
    />
  );
}
