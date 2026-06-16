"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type CommentFormProps = {
  storyId: string;
  replyToId?: string;
  replyToName?: string;
  onCancelReply?: () => void;
};

async function insertNotification(
  recipientName: string,
  actorName: string,
  storyId: string,
  message: string
) {
  const client = supabase;
  if (!client || recipientName === actorName) return;
  await client.from("notifications").insert({
    recipient_name: recipientName,
    actor_name: actorName,
    story_id: storyId,
    message,
  });
}

async function getStoryOwner(storyId: string): Promise<string | null> {
  const client = supabase;
  if (!client) return null;
  const { data } = await client
    .from("stories")
    .select("anonymous_name")
    .eq("id", storyId)
    .single();
  return data?.anonymous_name ?? null;
}

function truncate(text: string, max = 60) {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

export function CommentForm({ storyId, replyToId, replyToName, onCancelReply }: CommentFormProps) {
  const [username, setUsername] = useState<string>("");
  const [authLoaded, setAuthLoaded] = useState(false);
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const router = useRouter();

  useEffect(() => {
    const client = supabase;
    if (!client) { setAuthLoaded(true); return; }
    client.auth.getUser().then(({ data }) => {
      const uid = data?.user?.id;
      if (!uid) { setAuthLoaded(true); return; }
      client
        .from("users")
        .select("username")
        .eq("id", uid)
        .single()
        .then(({ data: profile }) => {
          if (profile?.username) setUsername(profile.username);
          setAuthLoaded(true);
        });
    });
  }, []);

  async function submitComment() {
    if (!body.trim() || !username) return;
    setStatus("saving");

    const client = supabase;
    if (client && !storyId.startsWith("sample-")) {
      const trimmedBody = body.trim();
      const { error } = await client.from("comments").insert({
        story_id: storyId,
        anonymous_name: username,
        body: trimmedBody,
        reply_to_id: replyToId ?? null,
        reply_to_name: replyToName ?? null,
      });

      if (error) { setStatus("error"); return; }

      // Notify story owner
      const owner = await getStoryOwner(storyId);
      if (owner) {
        await insertNotification(
          owner,
          username,
          storyId,
          `@${username} commented on your story: "${truncate(trimmedBody)}"`
        );
      }

      // Notify the person being replied to (only if different from story owner)
      if (replyToName && replyToName !== username && replyToName !== (owner ?? "")) {
        await insertNotification(
          replyToName,
          username,
          storyId,
          `@${username} replied to your comment: "${truncate(trimmedBody)}"`
        );
      }

      setBody("");
      setStatus("saved");
      router.refresh();
      setTimeout(() => setStatus("idle"), 3000);
    } else {
      setStatus("error");
    }
  }

  return (
    <div className="mt-4 grid gap-2">
      <div className="rounded-2xl bg-[#e1e2e6] px-4 py-3 text-sm font-medium text-[#4b4b47]">
        {username ? (
          <>commenting as <span className="font-semibold">@{username}</span></>
        ) : authLoaded ? (
          <span className="text-[#787775]"><a href="/login" className="underline underline-offset-2 text-[#4b4b47]">Log in</a> to comment.</span>
        ) : (
          <span className="text-[#787775]">loading…</span>
        )}
      </div>

      {replyToName && (
        <div className="flex items-center justify-between rounded-2xl bg-[#f8c0c8] px-4 py-2">
          <p className="text-xs font-medium text-[#4b4b47]">replying to <span className="font-semibold">@{replyToName}</span></p>
          {onCancelReply && (
            <button onClick={onCancelReply} className="text-xs text-[#787775] underline underline-offset-2" type="button">cancel</button>
          )}
        </div>
      )}
      <textarea
        className="min-h-24 resize-none rounded-2xl border border-[#d8d3ce] bg-[#f8f8f6] p-4 text-sm font-medium text-[#4b4b47] outline-none ring-[#f8c0c8] focus:ring-4"
        onChange={(e) => setBody(e.target.value)}
        placeholder={replyToName ? `Reply to @${replyToName}…` : "Add a comment… 💬"}
        value={body}
        autoComplete="off"
      />

      <button
        className="rounded-2xl bg-[#f8c0c8] px-4 py-3 text-sm font-medium text-[#4b4b47] disabled:opacity-60"
        disabled={status === "saving" || !username || !body.trim()}
        onClick={submitComment}
        type="button"
      >
        {status === "saving" ? "Adding…" : "Add comment"}
      </button>

      {status === "saved" && (
        <p className="text-center text-sm font-medium text-[#4b4b47]">Comment added ✓</p>
      )}
      {status === "error" && (
        <p className="text-center text-sm font-medium text-red-400">Something went wrong. Try again.</p>
      )}
    </div>
  );
}

// ── Inline version for use inside StoryCard on the feed ──────────────────────
type InlineCommentFormProps = {
  storyId: string;
  onDone: () => void;
  onCommentAdded?: () => void;
};

export function InlineCommentForm({ storyId, onDone, onCommentAdded }: InlineCommentFormProps) {
  const [username, setUsername] = useState<string>("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const focusTimer = setTimeout(() => textareaRef.current?.focus(), 100);
    const client = supabase;
    if (!client) return () => clearTimeout(focusTimer);
    client.auth.getUser().then(({ data }) => {
      const uid = data?.user?.id;
      if (!uid) return;
      client
        .from("users")
        .select("username")
        .eq("id", uid)
        .single()
        .then(({ data: profile }) => {
          if (profile?.username) setUsername(profile.username);
        });
    });
    return () => clearTimeout(focusTimer);
  }, []);

  async function submit() {
    if (!body.trim() || !username) return;
    setStatus("saving");
    const client = supabase;
    if (client && !storyId.startsWith("sample-")) {
      const trimmedBody = body.trim();
      const { error } = await client.from("comments").insert({
        story_id: storyId,
        anonymous_name: username,
        body: trimmedBody,
      });
      if (error) { setStatus("error"); return; }

      // Notify story owner
      const owner = await getStoryOwner(storyId);
      if (owner) {
        await insertNotification(
          owner,
          username,
          storyId,
          `@${username} commented on your story: "${truncate(trimmedBody)}"`
        );
      }

      setStatus("saved");
      onCommentAdded?.();
      setTimeout(onDone, 1200);
    } else {
      setStatus("error");
    }
  }

  if (status === "saved") {
    return (
      <div className="rounded-2xl bg-[#e1e2e6] px-4 py-3 text-center text-sm font-medium text-[#4b4b47]">
        Comment added ✓
      </div>
    );
  }

  return (
    <div className="grid gap-2 rounded-[2rem] border border-[#d8d3ce] bg-[#f8f8f6] p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[#787775]">
          {username ? <>as <span className="font-semibold text-[#4b4b47]">@{username}</span></> : "loading…"}
        </span>
        <button
          className="text-xs font-medium text-[#787775] underline underline-offset-2"
          onClick={onDone}
          type="button"
        >
          cancel
        </button>
      </div>
      <textarea
        ref={textareaRef}
        className="min-h-20 resize-none rounded-2xl border border-[#d8d3ce] bg-white p-3 text-sm font-medium text-[#4b4b47] outline-none ring-[#f8c0c8] focus:ring-4"
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add a comment…"
        value={body}
        autoComplete="off"
      />
      {!username ? (
        <p className="text-center text-sm text-[#787775]">
          <a href="/login" className="underline underline-offset-2 text-[#4b4b47]">Log in</a> to comment.
        </p>
      ) : (
        <button
          className="rounded-2xl bg-[#f8c0c8] px-4 py-3 text-sm font-medium text-[#4b4b47] disabled:opacity-60"
          disabled={status === "saving" || !body.trim()}
          onClick={submit}
          type="button"
        >
          {status === "saving" ? "Adding…" : "Add comment"}
        </button>
      )}
      {status === "error" && (
        <p className="text-center text-sm text-red-400">Something went wrong. Try again.</p>
      )}
    </div>
  );
}
