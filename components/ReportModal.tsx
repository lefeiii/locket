"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

const REASONS = [
  "Real name or personal info",
  "Threatening or violent content",
  "Harassment or bullying",
  "Explicit or inappropriate content",
  "Spam or fake story",
  "Other",
];

type Props = {
  open: boolean;
  onClose: () => void;
  storyId?: string;
  commentId?: string;
  storyTitle?: string;
};

export function ReportModal({ open, onClose, storyId, commentId, storyTitle }: Props) {
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");

  if (!open) return null;

  async function submit() {
    if (!reason) return;
    setStatus("saving");
    const client = supabase;
    if (!client) { setStatus("error"); return; }

    const { data: { user } } = await client.auth.getUser();
    if (!user) {
      // RLS requires reporter_id = auth.uid() — can't report anonymously
      setStatus("error");
      return;
    }
    const { error } = await client.from("reports").insert({
      reporter_id: user.id,
      story_id: storyId ?? null,
      comment_id: commentId ?? null,
      reason,
    });

    if (error) { setStatus("error"); return; }
    setStatus("done");
    setTimeout(() => {
      setStatus("idle");
      setReason("");
      onClose();
    }, 1500);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-8 sm:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-[2rem] border border-[#d8d3ce] bg-[#f8f8f6] p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-medium text-[#4b4b47]">Report this</h2>
          <button
            className="grid h-9 w-9 place-items-center rounded-full bg-[#e1e2e6] text-[#4b4b47]"
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </div>

        {storyTitle && (
          <p className="mb-4 rounded-2xl bg-[#e1e2e6] px-4 py-2 text-sm font-medium text-[#787775] line-clamp-1">
            "{storyTitle}"
          </p>
        )}

        {status === "done" ? (
          <div className="py-6 text-center">
            <p className="text-2xl">✓</p>
            <p className="mt-2 text-sm font-medium text-[#4b4b47]">Report submitted. Thank you for keeping Locket safe.</p>
          </div>
        ) : (
          <>
            <p className="mb-3 text-sm font-medium text-[#787775]">Why are you reporting this?</p>
            <div className="grid gap-2">
              {REASONS.map((r) => (
                <button
                  key={r}
                  className={`rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                    reason === r
                      ? "bg-[#f8c0c8] text-[#4b4b47]"
                      : "bg-[#e1e2e6] text-[#4b4b47]"
                  }`}
                  onClick={() => setReason(r)}
                  type="button"
                >
                  {r}
                </button>
              ))}
            </div>

            {status === "error" && (
              <p className="mt-3 text-center text-sm text-red-400">Something went wrong. Try again.</p>
            )}

            <button
              className="mt-4 w-full rounded-2xl bg-[#f8c0c8] py-3 text-sm font-medium text-[#4b4b47] disabled:opacity-50"
              disabled={!reason || status === "saving"}
              onClick={submit}
              type="button"
            >
              {status === "saving" ? "Submitting…" : "Submit report"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
