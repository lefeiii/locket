"use client";

import { Flag, HeartHandshake } from "lucide-react";
import { useMemo, useState } from "react";
import type { StoryPoll } from "@/lib/types";

type PollCardProps = {
  poll: StoryPoll;
};

function voteKey(pollId: string) {
  return `locket.poll.${pollId}`;
}

export function PollCard({ poll }: PollCardProps) {
  const [selected, setSelected] = useState<string | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }
    return window.localStorage.getItem(voteKey(poll.id));
  });
  const [votes, setVotes] = useState(poll.votes);
  const totalVotes = useMemo(() => Object.values(votes).reduce((sum, count) => sum + count, 0), [votes]);

  function vote(option: string) {
    if (selected) {
      return;
    }
    setSelected(option);
    setVotes((current) => ({ ...current, [option]: (current[option] ?? 0) + 1 }));
    window.localStorage.setItem(voteKey(poll.id), option);
  }

  return (
    <section className="rounded-[2rem] border border-[#d8d3ce] bg-[#f8f8f6] p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#787775]">Choose the next move</p>
          <h2 className="mt-2 text-2xl font-medium leading-tight text-[#4b4b47]">{poll.question}</h2>
        </div>
        <button
          aria-label="Report poll"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#e1e2e6] text-[#4b4b47]"
          type="button"
        >
          <Flag size={18} />
        </button>
      </div>

      <div className="grid gap-2">
        {poll.options.map((option) => {
          const count = votes[option] ?? 0;
          const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          return (
            <button
              className={`overflow-hidden rounded-2xl border border-[#d8d3ce] bg-[#f8f8f6] text-left text-sm font-medium text-[#4b4b47] ${
                selected === option ? "ring-2 ring-[#f8c0c8]" : ""
              }`}
              disabled={Boolean(selected)}
              key={option}
              onClick={() => vote(option)}
              type="button"
            >
              <span className="relative block px-4 py-3">
                {selected ? (
                  <span
                    className="absolute inset-y-0 left-0 bg-[#f8c0c8]"
                    style={{ width: `${percent}%` }}
                  />
                ) : null}
                <span className="relative flex items-center justify-between gap-3">
                  <span>{option}</span>
                  {selected ? <span>{percent}%</span> : null}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {selected ? (
        <div className="mt-4 rounded-2xl bg-[#e1e2e6] p-4 text-sm font-medium leading-6 text-[#4b4b47]">
          <div className="mb-1 flex items-center gap-2">
            <HeartHandshake size={17} />
            Follow to see what happens next
          </div>
          You helped steer the next update. No coins, no paywall, just emotional responsibility.
        </div>
      ) : null}
    </section>
  );
}
