"use client";

import { useEffect, useRef, useState } from "react";
import { StoryCard } from "@/components/StoryCard";
import { sampleStories } from "@/lib/sample-data";
import { supabase } from "@/lib/supabase";
import type { Story } from "@/lib/types";
import { isStoryUpdate } from "@/lib/story-updates";

const PAGE_SIZE = 10;
const PULL_THRESHOLD = 72;

export function StoryFeed({ initialStories, pinnedStoryId, updatesOnly }: {
  initialStories: Story[];
  pinnedStoryId: string;
  updatesOnly: boolean;
}) {
  const [stories, setStories] = useState(initialStories);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialStories.filter(s => s.id !== pinnedStoryId).length === PAGE_SIZE);
  const [error, setError] = useState("");
  const [pull, setPull] = useState(0);
  const sectionRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);

  async function loadOlder() {
    if (busyRef.current || !hasMore) return;
    busyRef.current = true;
    setLoading(true);
    setError("");
    try {
      const last = stories.filter(s => s.id !== pinnedStoryId).at(-1);
      if (!last) { setHasMore(false); return; }
      let older: Story[];
      if (supabase) {
        let query = supabase.from("stories").select("*")
          .eq("is_hidden", false).neq("id", pinnedStoryId)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .or(`created_at.lt.${last.created_at},and(created_at.eq.${last.created_at},id.lt.${last.id})`)
          .limit(PAGE_SIZE);
        if (updatesOnly) query = query.eq("is_update", true).gt("part_number", 1)
          .not("story_arc_id", "is", null).neq("story_arc_id", "");
        const result = await query;
        if (result.error) throw result.error;
        older = (result.data ?? []) as Story[];
      } else {
        older = [...sampleStories].filter(s => s.id !== pinnedStoryId && (!updatesOnly || isStoryUpdate(s)))
          .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))
          .filter(s => s.created_at < last.created_at || (s.created_at === last.created_at && s.id < last.id))
          .slice(0, PAGE_SIZE);
      }
      setStories(current => {
        const seen = new Set(current.map(s => s.id));
        return [...current, ...older.filter(s => !seen.has(s.id) && (!updatesOnly || isStoryUpdate(s)))];
      });
      setHasMore(older.length === PAGE_SIZE);
    } catch {
      setError("Could not load older stories. Please try again.");
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  }

  // Read current pagination state without reattaching listeners during a gesture.
  const loadRef = useRef(loadOlder);
  useEffect(() => { loadRef.current = loadOlder; });

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || !hasMore) return;
    let start: { x: number; y: number } | null = null;
    let distance = 0;
    const previousOverscroll = document.documentElement.style.overscrollBehaviorY;
    document.documentElement.style.overscrollBehaviorY = "contain";
    function reset() { start = null; distance = 0; setPull(0); }
    function onStart(event: TouchEvent) {
      if (window.scrollY > 0 || event.touches.length !== 1 || busyRef.current) return;
      const target = event.target as Element;
      if (target.closest("button, a, input, textarea, select")) return;
      start = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    }
    function onMove(event: TouchEvent) {
      if (!start) return;
      if (event.touches.length !== 1 || window.scrollY > 0) { reset(); return; }
      const dy = event.touches[0].clientY - start.y;
      const dx = event.touches[0].clientX - start.x;
      if (dy <= 0 || Math.abs(dx) > dy) { reset(); return; }
      if (event.cancelable) event.preventDefault();
      distance = Math.min(dy * 0.5, 100);
      setPull(distance);
    }
    function onEnd() {
      const shouldLoad = distance >= PULL_THRESHOLD;
      reset();
      if (shouldLoad) void loadRef.current();
    }
    section.addEventListener("touchstart", onStart, { passive: true });
    section.addEventListener("touchmove", onMove, { passive: false });
    section.addEventListener("touchend", onEnd);
    section.addEventListener("touchcancel", reset);
    return () => {
      section.removeEventListener("touchstart", onStart);
      section.removeEventListener("touchmove", onMove);
      section.removeEventListener("touchend", onEnd);
      section.removeEventListener("touchcancel", reset);
      document.documentElement.style.overscrollBehaviorY = previousOverscroll;
    };
  }, [hasMore]);

  return (
    <div ref={sectionRef} className="flex flex-col gap-7" aria-busy={loading}>
      <p className="text-center text-xs text-[#6b4a3a]" aria-live="polite">
        {loading ? "Loading older stories…" : pull >= PULL_THRESHOLD ? "Release to load older stories" :
          pull > 0 ? "Keep pulling to load older stories" : hasMore ? "Pull down at the top to discover older stories" : ""}
      </p>
      {stories.length === 0 ? (
        <div className="rounded-[2rem] border border-[#c8b7a7] bg-[#f1e9e1] p-8 text-center">
          <p className="text-base font-medium text-[#4f3325]">Nothing here yet.</p>
        </div>
      ) : stories.map(story => (
        <StoryCard key={story.id} story={story} isGuest={false} isPinned={story.id === pinnedStoryId} />
      ))}
      {error && <p role="alert" className="text-center text-sm text-[#6b4a3a]">{error}</p>}
      {hasMore ? (
        <button type="button" onClick={() => void loadOlder()} disabled={loading}
          className="rounded-2xl border border-[#c8b7a7] bg-[#f1e9e1] px-4 py-3 text-sm font-medium text-[#4f3325] disabled:opacity-50">
          {loading ? "Loading…" : error ? "Try again" : "Load older stories"}
        </button>
      ) : stories.length > 0 && <p className="text-center text-sm text-[#6b4a3a]">You’ve reached the oldest stories. Check back for new ones.</p>}
    </div>
  );
}

