"use client";

import { useEffect, useState } from "react";
import { BellPlus } from "lucide-react";
import { categorySubscriptionsKey, isInList, toggleListValue } from "@/lib/storage";
import type { StoryCategory } from "@/lib/types";

type SubscriptionControlsProps = {
  categories: StoryCategory[];
};

export function SubscriptionControls({ categories }: SubscriptionControlsProps) {
  const [active, setActive] = useState<string[]>([]);
  const [selected, setSelected] = useState<StoryCategory>(categories[0]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setActive(categories.filter((category) => isInList(categorySubscriptionsKey, category)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [categories]);

  function toggleSelected() {
    const subscribed = toggleListValue(categorySubscriptionsKey, selected);
    setActive((current) => (subscribed ? [...current, selected] : current.filter((item) => item !== selected)));
  }

  return (
    <div className="mt-3 rounded-3xl bg-[#d8d6d2] p-3">
      <div className="flex gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Choose a category to subscribe to</span>
          <select
            className="min-h-11 w-full rounded-2xl border border-[#c8b7a7] bg-[#f1e9e1] px-4 text-sm font-medium text-[#4f3325] outline-none ring-[#c88d7d] focus:ring-4"
            onChange={(event) => setSelected(event.target.value as StoryCategory)}
            value={selected}
          >
            {categories.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </label>
        <button
          className={`flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-medium ${
            active.includes(selected) ? "bg-[#c88d7d] text-[#4f3325]" : "bg-[#f1e9e1] text-[#4f3325]"
          }`}
          onClick={toggleSelected}
          type="button"
        >
          <BellPlus size={16} />
          {active.includes(selected) ? "Following" : "Follow"}
        </button>
      </div>
      <p className="mt-2 text-xs font-medium leading-5 text-[#6b4a3a]">
        {active.length ? `Following: ${active.join(", ")}` : "Pick a category when you want more of that lane."}
      </p>
    </div>
  );
}
