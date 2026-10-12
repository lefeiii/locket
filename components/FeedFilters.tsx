import Link from "next/link";

const filters = [
  "For You",
  "Following",
  "Updates",
];

export function FeedFilters({ active }: { active: string }) {
  return (
    <div className="locket-feed-filters mx-auto max-w-lg px-4 pb-4">
      <div className="border-b border-[#c8b7a7] py-4">
        <p className="text-xs font-medium uppercase tracking-[0.1em] text-[#6b4a3a]">Reading {active}</p>
        <div className="mt-2 flex gap-x-4 gap-y-2 overflow-x-auto pb-1 text-sm font-medium text-[#4f3325] no-scrollbar">
          {filters.map((filter) => (
            <Link
              className={`shrink-0 ${active === filter ? "text-[#4f3325]" : "text-[#6b4a3a]"}`}
              href={`/?filter=${encodeURIComponent(filter)}#feed`}
              key={filter}
            >
              {filter}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
