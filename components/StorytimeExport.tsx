"use client";

import { Download, Images, Share } from "lucide-react";
import { useMemo } from "react";
import type { Story } from "@/lib/types";

type StorytimeExportProps = {
  story: Story;
};

function splitSlides(text: string) {
  const chunks = text.match(/.{1,210}(\s|$)/g) ?? [text];
  return chunks.map((chunk) => chunk.trim()).filter(Boolean).slice(0, 5);
}

export function StorytimeExport({ story }: StorytimeExportProps) {
  const slides = useMemo(() => splitSlides(story.body), [story.body]);

  function downloadFirstSlide() {
    const text = `${story.title}\n\n${slides[0] ?? story.body}\n\n@${story.anonymous_name} · Locket`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><rect width="100%" height="100%" fill="#f1e9e1"/><rect x="90" y="120" width="900" height="1680" rx="72" fill="#d8d6d2"/><text x="140" y="230" font-family="Times New Roman" font-size="42" fill="#6b4a3a">${story.category}</text><foreignObject x="140" y="310" width="800" height="1100"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Times New Roman;color:#4f3325;font-size:72px;line-height:1.12;font-weight:500;">${text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</div></foreignObject><text x="140" y="1690" font-family="Times New Roman" font-size="40" fill="#6b4a3a">locket · anonymous stories</text></svg>`;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${story.id}-storytime.svg`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="rounded-[2rem] border border-[#c8b7a7] bg-[#f1e9e1] p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Images size={20} />
        <h2 className="text-xl font-medium text-[#4f3325]">Storytime export</h2>
      </div>
      <div className="aspect-[9/16] rounded-[2rem] bg-[#d8d6d2] p-5 text-[#4f3325] shadow-sm">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#6b4a3a]">{story.category}</p>
        <h3 className="mt-4 text-3xl font-medium leading-tight">{story.title}</h3>
        <p className="mt-4 text-base font-medium leading-7">{slides[0]}</p>
        <p className="mt-6 text-sm font-medium text-[#6b4a3a]">@{story.anonymous_name} · Locket</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#c88d7d] px-4 text-sm font-medium text-[#4f3325]"
          onClick={downloadFirstSlide}
          type="button"
        >
          <Download size={18} />
          Save Card
        </button>
        <button
          className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#d8d6d2] px-4 text-sm font-medium text-[#4f3325]"
          type="button"
        >
          <Share size={18} />
          Share
        </button>
      </div>
    </section>
  );
}
