"use client";

import { EyeOff, Pencil, Trash2, X, Check, Eye } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { StoryCategory } from "@/lib/types";

const categories: StoryCategory[] = [
  "my crush era",
  "mommy issues",
  "daddy issues",
  "not a girls girl today because:",
  "im the girl bestfriend yall",
  "school was NOT it",
  "slay or be slayed",
  "he's so cooked",
  "she's so cooked",
  "ok but AITA tho",
  "the update dropped",
];

type Props = {
  storyId: string;
  authorName: string;
  initialTitle: string;
  initialBody: string;
  initialCategory: StoryCategory;
  initialIsHidden: boolean;
};

export function StoryOwnerActions({
  storyId,
  authorName,
  initialTitle,
  initialBody,
  initialCategory,
  initialIsHidden,
}: Props) {
  const router = useRouter();
  const [isOwner, setIsOwner] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [category, setCategory] = useState<StoryCategory>(initialCategory);
  // Track last saved values so cancel always reverts to them, not stale initial props
  const [savedTitle, setSavedTitle] = useState(initialTitle);
  const [savedBody, setSavedBody] = useState(initialBody);
  const [savedCategory, setSavedCategory] = useState<StoryCategory>(initialCategory);
  const [isHidden, setIsHidden] = useState(initialIsHidden);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

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
          if (profile?.username === authorName) setIsOwner(true);
        });
    });
  }, [authorName]);

  if (!isOwner) return null;

  async function handleSave() {
    if (!title.trim() || !body.trim()) return;
    setSaving(true);
    const client = supabase;
    if (!client) { setSaving(false); return; }
    const { error } = await client
      .from("stories")
      .update({ title: title.trim(), body: body.trim(), category })
      .eq("id", storyId);
    setSaving(false);
    if (error) { setMsg("Could not save changes."); return; }
    setSavedTitle(title.trim());
    setSavedBody(body.trim());
    setSavedCategory(category);
    setMsg("Saved!");
    setEditing(false);
    router.refresh();
    setTimeout(() => setMsg(""), 3000);
  }

  async function handleToggleVisibility() {
    const client = supabase;
    if (!client) return;
    const next = !isHidden;
    const { error } = await client
      .from("stories")
      .update({ is_hidden: next })
      .eq("id", storyId);
    if (error) {
      setMsg("Could not update visibility. Try again.");
    } else {
      setIsHidden(next);
      setMsg(next ? "Story hidden from feed." : "Story visible in feed.");
      router.refresh();
    }
    setTimeout(() => setMsg(""), 3000);
  }

  async function handleDelete() {
    if (!confirm("Delete this story permanently? This cannot be undone.")) return;
    const client = supabase;
    if (!client) return;
    const { error } = await client.from("stories").delete().eq("id", storyId);
    if (error) {
      setMsg("Could not delete story. Try again.");
    } else {
      router.push("/");
    }
  }

  return (
    <div className="mt-4 rounded-[2rem] border border-[#d8d3ce] bg-[#f8f8f6] p-5 shadow-sm">
      <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-[#787775]">
        Your story
      </p>

      {editing ? (
        <div className="grid gap-3">
          <label className="block text-sm font-medium text-[#4b4b47]">
            Title
            <input
              className="mt-1 w-full rounded-2xl border border-[#d8d3ce] bg-white px-4 py-3 text-sm font-medium text-[#4b4b47] outline-none ring-[#f8c0c8] focus:ring-4"
              maxLength={90}
              onChange={(e) => setTitle(e.target.value)}
              value={title}
            />
          </label>
          <label className="block text-sm font-medium text-[#4b4b47]">
            Category
            <select
              className="mt-1 w-full rounded-2xl border border-[#d8d3ce] bg-white px-4 py-3 text-sm font-medium text-[#4b4b47] outline-none ring-[#f8c0c8] focus:ring-4"
              onChange={(e) => setCategory(e.target.value as StoryCategory)}
              value={category}
            >
              {categories.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-[#4b4b47]">
            Story
            <textarea
              className="mt-1 min-h-48 w-full resize-none rounded-2xl border border-[#d8d3ce] bg-white p-4 text-sm font-medium leading-7 text-[#4b4b47] outline-none ring-[#f8c0c8] focus:ring-4"
              maxLength={1400}
              onChange={(e) => setBody(e.target.value)}
              value={body}
            />
          </label>
          <div className="flex gap-2">
            <button
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#f8c0c8] py-3 text-sm font-medium text-[#4b4b47] disabled:opacity-60"
              disabled={saving}
              onClick={handleSave}
              type="button"
            >
              <Check size={16} />
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button
              className="flex items-center justify-center gap-2 rounded-2xl bg-[#e1e2e6] px-4 py-3 text-sm font-medium text-[#4b4b47]"
              onClick={() => { setEditing(false); setTitle(savedTitle); setBody(savedBody); setCategory(savedCategory); }}
              type="button"
            >
              <X size={16} />
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            className="flex items-center gap-2 rounded-2xl bg-[#e1e2e6] px-4 py-2.5 text-sm font-medium text-[#4b4b47]"
            onClick={() => setEditing(true)}
            type="button"
          >
            <Pencil size={15} />
            Edit
          </button>
          <button
            className="flex items-center gap-2 rounded-2xl bg-[#e1e2e6] px-4 py-2.5 text-sm font-medium text-[#4b4b47]"
            onClick={handleToggleVisibility}
            type="button"
          >
            {isHidden ? <Eye size={15} /> : <EyeOff size={15} />}
            {isHidden ? "Make public" : "Make private"}
          </button>
          <button
            className="flex items-center gap-2 rounded-2xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-500"
            onClick={handleDelete}
            type="button"
          >
            <Trash2 size={15} />
            Delete
          </button>
        </div>
      )}

      {msg && (
        <p className="mt-3 text-center text-sm font-medium text-[#4b4b47]">{msg}</p>
      )}
    </div>
  );
}
