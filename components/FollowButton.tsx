"use client";

import { Bell, HeartHandshake } from "lucide-react";
import { useEffect, useState } from "react";
import { followingStorageKey, isInList, storySubscriptionsKey, toggleListValue } from "@/lib/storage";

type FollowButtonProps = {
  posterName?: string;
  storyId?: string;
  compact?: boolean;
};

export function FollowButton({ posterName, storyId, compact = false }: FollowButtonProps) {
  const key = posterName ? followingStorageKey : storySubscriptionsKey;
  const value = posterName ?? storyId ?? "";
  const [active, setActive] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (value) {
        setActive(isInList(key, value));
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [key, value]);

  if (!value) {
    return null;
  }

  return (
    <button
      className={`flex items-center justify-center gap-2 rounded-full text-xs font-medium transition active:scale-95 ${
        compact ? "min-h-10 px-3" : "min-h-12 px-4"
      } ${active ? "bg-[#f8c0c8] text-[#4b4b47]" : "bg-[#f8f8f6] text-[#4b4b47] shadow-sm"}`}
      onClick={() => setActive(toggleListValue(key, value))}
      type="button"
    >
      {posterName ? <HeartHandshake size={17} /> : <Bell size={17} />}
      {active ? "Following" : posterName ? "Follow for updates" : "Subscribe to story"}
    </button>
  );
}
