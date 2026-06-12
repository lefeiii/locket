"use client";

import { useState } from "react";

const slides = [
  {
    emoji: "👀",
    title: "read anonymous drama",
    body: "Real stories from real people. No names, no faces — just the tea. Every post is 100% anonymous.",
    color: "bg-[#f8c0c8]",
  },
  {
    emoji: "🔔",
    title: "follow the arcs",
    body: "Subscribe to stories you're invested in. When OP drops an update, you'll know. The drama never ends.",
    color: "bg-[#e1e2e6]",
  },
  {
    emoji: "✍️",
    title: "post your own story",
    body: "Something happened? Drop it. Your username shows but your identity stays hidden. This is your safe space to spill.",
    color: "bg-[#f8c0c8]",
  },
];

type Props = {
  onDone: () => void;
};

export function Onboarding({ onDone }: Props) {
  const [current, setCurrent] = useState(0);
  const isLast = current === slides.length - 1;
  const slide = slides[current];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4 pb-8">
      <div className="w-full max-w-md overflow-hidden rounded-[2rem] border border-[#d8d3ce] bg-[#f8f8f6] shadow-xl">
        {/* Slide */}
        <div key={current} className={`${slide.color} px-6 pb-8 pt-10 text-center transition-all duration-200`}>
          <p className="text-6xl">{slide.emoji}</p>
          <h2 className="mt-4 text-2xl font-medium text-[#4b4b47]">{slide.title}</h2>
          <p className="mt-3 text-sm font-medium leading-6 text-[#4b4b47] opacity-80">{slide.body}</p>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 py-4">
          {slides.map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all ${
                i === current ? "h-2 w-6 bg-[#4b4b47]" : "h-2 w-2 bg-[#d8d3ce]"
              }`}
            />
          ))}
        </div>

        {/* Buttons */}
        <div className="grid grid-cols-2 gap-3 px-6 pb-6">
          <button
            className="rounded-2xl border border-[#d8d3ce] py-3 text-sm font-medium text-[#787775]"
            onClick={onDone}
            type="button"
          >
            skip
          </button>
          <button
            className="rounded-2xl bg-[#f8c0c8] py-3 text-sm font-medium text-[#4b4b47]"
            onClick={() => {
              if (isLast) {
                onDone();
              } else {
                setCurrent((c) => c + 1);
              }
            }}
            type="button"
          >
            {isLast ? "let's go 🎉" : "next →"}
          </button>
        </div>
      </div>
    </div>
  );
}
