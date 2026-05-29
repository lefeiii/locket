import { Download, Share, Sparkles } from "lucide-react";
import Link from "next/link";
import { AppNav, BrandBar } from "@/components/AppNav";
import { sampleWrapped } from "@/lib/sample-data";

export default function WrappedPage() {
  return (
    <main className="pb-24">
      <BrandBar />
      <section className="mx-auto max-w-md px-4 py-6">
        <div className="mb-5">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#787775]">Seasonal Wrapped</p>
          <h1 className="mt-2 text-3xl font-medium leading-tight text-[#4b4b47]">Your drama era, screenshot-ready</h1>
        </div>

        <section className="mb-5 rounded-[2rem] border border-[#d8d3ce] bg-[#f8f8f6] p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#787775]">Wrapped categories</p>
          <div className="mt-4 grid gap-3">
            <a className="rounded-2xl bg-[#f8c0c8] p-4 text-[#4b4b47]" href="#winter-wildin">
              <h2 className="text-xl font-medium">Winter Wildin&apos;</h2>
              <p className="mt-1 text-sm font-medium leading-6">September to December school-year chaos.</p>
            </a>
            <a className="rounded-2xl bg-[#e1e2e6] p-4 text-[#4b4b47]" href="#summer-special">
              <h2 className="text-xl font-medium">Summer Special</h2>
              <p className="mt-1 text-sm font-medium leading-6">January to June recaps for finals, prom, and summer lore.</p>
            </a>
          </div>
        </section>

        <div className="grid gap-5">
          {sampleWrapped.map((recap) => (
            <article
              className="overflow-hidden rounded-[2rem] border border-[#d8d3ce] bg-[#f8f8f6] shadow-sm"
              id={recap.season_name === "Winter Wildin'" ? "winter-wildin" : "summer-special"}
              key={recap.id}
            >
              <div className="bg-[#f8c0c8] p-5 text-[#4b4b47]">
                <p className="text-xs font-medium uppercase tracking-[0.2em]">{recap.season_name}</p>
                <h2 className="mt-3 text-4xl font-medium leading-tight">{recap.recap_data.headline}</h2>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-[#e1e2e6] p-4">
                    <p className="text-3xl font-medium text-[#4b4b47]">{recap.recap_data.stories_read}</p>
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#787775]">Read</p>
                  </div>
                  <div className="rounded-2xl bg-[#e1e2e6] p-4">
                    <p className="text-3xl font-medium text-[#4b4b47]">{recap.recap_data.votes_cast}</p>
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#787775]">Votes</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3">
                  {recap.recap_data.lines.map((line) => (
                    <p className="rounded-2xl bg-[#e1e2e6] p-4 text-sm font-medium leading-6 text-[#4b4b47]" key={line}>
                      {line}
                    </p>
                  ))}
                </div>
                <div className="mt-4 rounded-2xl border border-[#d8d3ce] p-4">
                  <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-[#787775]">
                    <Sparkles size={15} />
                    Top drama era
                  </p>
                  <p className="mt-2 text-xl font-medium leading-tight text-[#4b4b47]">
                    {recap.recap_data.top_emotional_label} in {recap.recap_data.most_followed_story_arc}
                  </p>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button className="flex min-h-11 items-center justify-center gap-1 rounded-2xl bg-[#f8c0c8] px-2 text-xs font-medium text-[#4b4b47]" type="button">
                    <Download size={15} />
                    Save Card
                  </button>
                  <button className="flex min-h-11 items-center justify-center gap-1 rounded-2xl bg-[#e1e2e6] px-2 text-xs font-medium text-[#4b4b47]" type="button">
                    <Share size={15} />
                    Share Recap
                  </button>
                  <Link
                    className="flex min-h-11 items-center justify-center rounded-2xl bg-[#e1e2e6] px-2 text-center text-xs font-medium text-[#4b4b47]"
                    href="/?filter=Unresolved"
                  >
                    Top Era
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
      <AppNav />
    </main>
  );
}
