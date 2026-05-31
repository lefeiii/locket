import Link from "next/link";

const filters = [
  "For You",
  "Following",
  "Updates",
];

export function FeedFilters({ active }: { active: string }) {
  return (
    <div className="mx-auto max-w-lg px-4 pb-4">
      <div className="border-y border-[#d8d3ce] py-3">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#787775]">Reading {active}</p>
        <div className="mt-2 flex gap-x-4 gap-y-2 overflow-x-auto pb-1 text-sm font-medium text-[#4b4b47] no-scrollbar">
          {filters.map((filter) => (
            <Link
              className={`shrink-0 ${active === filter ? "text-[#4b4b47]" : "text-[#787775]"}`}
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
