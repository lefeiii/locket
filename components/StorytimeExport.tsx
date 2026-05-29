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
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><rect width="100%" height="100%" fill="#f8f8f6"/><rect x="90" y="120" width="900" height="1680" rx="72" fill="#e1e2e6"/><text x="140" y="230" font-family="Arial" font-size="42" fill="#787775">${story.category}</text><foreignObject x="140" y="310" width="800" height="1100"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Arial;color:#4b4b47;font-size:72px;line-height:1.12;font-weight:500;">${text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</div></foreignObject><text x="140" y="1690" font-family="Arial" font-size="40" fill="#787775">locket · anonymous stories</text></svg>`;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${story.id}-storytime.svg`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="rounded-[2rem] border border-[#d8d3ce] bg-[#f8f8f6] p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Images size={20} />
        <h2 className="text-xl font-medium text-[#4b4b47]">Storytime export</h2>
      </div>
      <div className="aspect-[9/16] rounded-[2rem] bg-[#e1e2e6] p-5 text-[#4b4b47] shadow-sm">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#787775]">{story.category}</p>
        <h3 className="mt-4 text-3xl font-medium leading-tight">{story.title}</h3>
        <p className="mt-4 text-base font-medium leading-7">{slides[0]}</p>
        <p className="mt-6 text-sm font-medium text-[#787775]">@{story.anonymous_name} · Locket</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#f8c0c8] px-4 text-sm font-medium text-[#4b4b47]"
          onClick={downloadFirstSlide}
          type="button"
        >
          <Download size={18} />
          Save Card
        </button>
        <button
          className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#e1e2e6] px-4 text-sm font-medium text-[#4b4b47]"
          type="button"
        >
          <Share size={18} />
          Share
        </button>
      </div>
    </section>
  );
}
