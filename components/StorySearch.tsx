"use client";

import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { FollowButton } from "@/components/FollowButton";

type Result = {
  id: string;
  title: string;
  category: string;
  anonymous_name: string;
};

export function StorySearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Search Supabase whenever query changes (debounced 300ms)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (!trimmed) { setResults([]); setOpen(false); return; }
    // Clear stale results immediately so old results don't flash while new ones load
    setResults([]);
    setLoading(true);

    let mounted = true;
    debounceRef.current = setTimeout(async () => {
      if (!mounted) return;
      const client = supabase;
      if (!client) { if (mounted) setLoading(false); return; }

      const { data } = await client
        .from("stories")
        .select("id, title, category, anonymous_name")
        .ilike("title", `%${trimmed}%`)
        .eq("is_hidden", false)
        .order("created_at", { ascending: false })
        .limit(10);

      if (mounted) {
        setResults((data ?? []) as Result[]);
        setOpen(true);
        setLoading(false);
      }
    }, 300);

    return () => {
      mounted = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="mx-auto max-w-lg px-4 pb-4" ref={containerRef}>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
          <Search size={16} className="text-[#787775]" />
        </div>
        <input
          className="w-full rounded-2xl border border-[#d8d3ce] bg-[#f8f8f6] py-3 pl-10 pr-10 text-sm font-medium text-[#4b4b47] outline-none ring-[#f8c0c8] focus:ring-4"
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search stories to follow…"
          type="text"
          value={query}
          autoComplete="off"
        />
        {query && (
          <button
            className="absolute inset-y-0 right-3 flex items-center px-1 text-[#787775]"
            onClick={() => { setQuery(""); setResults([]); setOpen(false); }}
            type="button"
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {open && (
        <div className="mt-2 overflow-hidden rounded-2xl border border-[#d8d3ce] bg-[#f8f8f6] shadow-sm">
          {loading ? (
            <p className="px-4 py-3 text-sm text-[#787775]">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-[#787775]">No stories found for "{query}"</p>
          ) : (
            <ul>
              {results.map((result, i) => (
                <li
                  key={result.id}
                  className={`flex items-center justify-between gap-3 px-4 py-3 ${
                    i < results.length - 1 ? "border-b border-[#d8d3ce]" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#4b4b47]">{result.title}</p>
                    <p className="mt-0.5 text-xs text-[#787775]">
                      {result.category} · @{result.anonymous_name}
                    </p>
                  </div>
                  <div className="shrink-0">
                    <FollowButton compact storyId={result.id} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
