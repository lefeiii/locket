"use client";

import { useState } from "react";
import { generateAnonymousName } from "@/lib/sample-data";
import { supabase } from "@/lib/supabase";

type CommentFormProps = {
  storyId: string;
};

export function CommentForm({ storyId }: CommentFormProps) {
  const [anonymousName, setAnonymousName] = useState(generateAnonymousName());
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "local">("idle");

  async function submitComment() {
    if (!body.trim()) {
      return;
    }

    setStatus("saving");
    if (supabase && !storyId.startsWith("sample-")) {
      const { error } = await supabase.from("comments").insert({
        story_id: storyId,
        anonymous_name: anonymousName.trim() || generateAnonymousName(),
        body
      });
      setStatus(error ? "local" : "saved");
    } else {
      setStatus("local");
    }
    setBody("");
  }

  return (
    <form className="mt-4 grid gap-2">
      <input
        className="min-h-12 rounded-2xl border border-[#d8d3ce] px-4 text-sm font-medium outline-none ring-[#f8c0c8] focus:ring-4"
        onChange={(event) => setAnonymousName(event.target.value)}
        value={anonymousName}
      />
      <textarea
        className="min-h-24 resize-none rounded-2xl border border-[#d8d3ce] p-4 text-sm font-medium outline-none ring-[#f8c0c8] focus:ring-4"
        onChange={(event) => setBody(event.target.value)}
        placeholder="Add an anonymous comment"
        value={body}
      />
      <button
        className="rounded-2xl bg-[#f8c0c8] px-4 py-3 text-sm font-medium text-[#4b4b47] disabled:opacity-60"
        disabled={status === "saving"}
        onClick={submitComment}
        type="button"
      >
        {status === "saving" ? "Adding..." : "Add comment"}
      </button>
      {status === "saved" ? <p className="text-center text-sm font-medium text-[#4b4b47]">Comment added.</p> : null}
      {status === "local" ? (
        <p className="text-center text-sm font-medium text-[#4b4b47]">
          Demo comment captured locally. Connect Supabase to persist comments.
        </p>
      ) : null}
    </form>
  );
}
