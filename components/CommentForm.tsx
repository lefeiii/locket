"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type CommentFormProps = {
  storyId: string;
};

export function CommentForm({ storyId }: CommentFormProps) {
  const [username, setUsername] = useState<string>("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  // Load the real logged-in username on mount
  useEffect(() => {
    const client = supabase;
    if (!client) return;
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
  }, []);

  async function submitComment() {
    if (!body.trim() || !username) return;

    setStatus("saving");

    const client = supabase;
    if (client && !storyId.startsWith("sample-")) {
      const { error } = await client.from("comments").insert({
        story_id: storyId,
        anonymous_name: username,
        body: body.trim(),
      });

      if (error) {
        setStatus("error");
        return;
      }

      setBody("");
      setStatus("saved");
      // Re-fetch the server component so the new comment shows immediately
      router.refresh();
      setTimeout(() => setStatus("idle"), 3000);
    } else {
      setStatus("error");
    }
  }

  return (
    <div className="mt-4 grid gap-2">
      {/* Show who is commenting — read-only, no anonymous name input */}
      <div className="rounded-2xl bg-[#e1e2e6] px-4 py-3 text-sm font-medium text-[#4b4b47]">
        {username ? (
          <>commenting as <span className="font-semibold">@{username}</span></>
        ) : (
          <span className="text-[#787775]">loading your profile…</span>
        )}
      </div>

      <textarea
        ref={textareaRef}
        className="min-h-24 resize-none rounded-2xl border border-[#d8d3ce] bg-[#f8f8f6] p-4 text-sm font-medium text-[#4b4b47] outline-none ring-[#f8c0c8] focus:ring-4"
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add a comment… 💬"
        value={body}
        // These let emoji keyboards work on iOS/iPadOS
        autoComplete="off"
        autoCorrect="on"
        spellCheck={true}
        enterKeyHint="send"
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
        <p className="text-center text-sm font-medium text-red-400">
          Something went wrong. Try again.
        </p>
      )}
    </div>
  );
}
