import { Download, Share, Sparkles } from "lucide-react";
import Link from "next/link";
import { AppNav, BrandBar } from "@/components/AppNav";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

// ── Season windows ────────────────────────────────────────────────────────────
// Winter Wildin' = Sep 1 → Dec 31 of the *previous* calendar year
// Summer Special  = Jan 1 → Jun 30 of the *current* calendar year
// We derive dates relative to "now" so they stay correct year-over-year.

function getSeasonWindows() {
  const now = new Date();
  const year = now.getFullYear();

  return [
    {
      id: "winter-wildin",
      slug: "winter-wildin",
      season_name: "Winter Wildin'",
      description: "September to December school-year chaos.",
      color: "bg-[#f8c0c8]",
      from: new Date(`${year - 1}-09-01T00:00:00.000Z`).toISOString(),
      to: new Date(`${year - 1}-12-31T23:59:59.999Z`).toISOString(),
    },
    {
      id: "summer-special",
      slug: "summer-special",
      season_name: "Summer Special",
      description: "January to June recaps for finals, prom, and summer lore.",
      color: "bg-[#e1e2e6]",
      from: new Date(`${year}-01-01T00:00:00.000Z`).toISOString(),
      to: new Date(`${year}-06-30T23:59:59.999Z`).toISOString(),
    },
  ];
}

// ── Headline generator ────────────────────────────────────────────────────────
function makeHeadline(storiesRead: number, votescast: number): string {
  if (storiesRead === 0) return "Your season starts now.";
  if (storiesRead < 5) return `You dipped your toes in with ${storiesRead} stories.`;
  if (storiesRead < 20) return `You survived ${storiesRead} friendship disasters.`;
  if (storiesRead < 50) return `Your ${season_name ?? "season"} lore was dangerously active.`;
  return `${storiesRead} stories. You are the main character.`;
}

// ── Insight lines ─────────────────────────────────────────────────────────────
function makeLines(
  storiesRead: number,
  votescast: number,
  topCategory: string | null,
  mostFollowed: string | null,
  topReaction: string | null,
  followed: number
): string[] {
  if (storiesRead === 0) {
    return [
      "Nothing to report yet — the drama is out there waiting.",
      "Start reading stories and come back for your recap.",
    ];
  }

  const lines: string[] = [];

  if (votescast > 0) {
    lines.push(`You cast ${votescast} ${votescast === 1 ? "vote" : "votes"} on people's decisions. Power move.`);
  }
  if (topCategory) {
    lines.push(`Your top category was ${topCategory}. Be honest, you knew that.`);
  }
  if (topReaction) {
    lines.push(`Your most used reaction was '${topReaction}.' Accurate.`);
  }
  if (followed > 0) {
    lines.push(`You followed ${followed} unresolved ${followed === 1 ? "situation" : "situations"}.`);
  }
  if (mostFollowed) {
    lines.push(`The arc everyone couldn't stop following: ${mostFollowed}.`);
  }

  return lines.length > 0 ? lines : [`You read ${storiesRead} stories and said nothing. Lurker behaviour.`];
}

// ── Types ─────────────────────────────────────────────────────────────────────
type SeasonRecap = {
  id: string;
  slug: string;
  season_name: string;
  description: string;
  color: string;
  storiesRead: number;
  votescast: number;
  topCategory: string | null;
  topReaction: string | null;
  topDramaLabel: string | null;
  topDramaArc: string | null;
  followed: number;
  headline: string;
  lines: string[];
};

// ── Data fetching ─────────────────────────────────────────────────────────────
async function fetchRecaps(): Promise<{ recaps: SeasonRecap[]; isLoggedIn: boolean }> {
  const supabase = createServerComponentClient({ cookies });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const seasons = getSeasonWindows();
  const recaps: SeasonRecap[] = [];

  for (const season of seasons) {
    // Stories read (all stories visible in the feed during this window)
    const { count: storiesRead } = await supabase
      .from("stories")
      .select("id", { count: "exact", head: true })
      .gte("created_at", season.from)
      .lte("created_at", season.to)
      .eq("is_hidden", false);

    // Votes cast by this user during the window (only if logged in)
    let votescast = 0;
    if (user) {
      const { count } = await supabase
        .from("poll_votes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", season.from)
        .lte("created_at", season.to);
      votescast = count ?? 0;
    }

    // Top category by story count in window
    const { data: categoryRows } = await supabase
      .from("stories")
      .select("category")
      .gte("created_at", season.from)
      .lte("created_at", season.to)
      .eq("is_hidden", false);

    const categoryCounts: Record<string, number> = {};
    for (const row of categoryRows ?? []) {
      if (row.category) categoryCounts[row.category] = (categoryCounts[row.category] ?? 0) + 1;
    }
    const topCategory =
      Object.keys(categoryCounts).sort((a, b) => categoryCounts[b] - categoryCounts[a])[0] ?? null;

    // Top reaction across all stories in the window
    const { data: reactionRows } = await supabase
      .from("stories")
      .select("reactions")
      .gte("created_at", season.from)
      .lte("created_at", season.to)
      .eq("is_hidden", false);

    const reactionTotals: Record<string, number> = {};
    for (const row of reactionRows ?? []) {
      if (row.reactions && typeof row.reactions === "object") {
        for (const [key, val] of Object.entries(row.reactions as Record<string, number>)) {
          reactionTotals[key] = (reactionTotals[key] ?? 0) + (val ?? 0);
        }
      }
    }
    const topReaction =
      Object.keys(reactionTotals).sort((a, b) => reactionTotals[b] - reactionTotals[a])[0] ?? null;

    // Most followed story arc (by follower_count on stories)
    const { data: arcRows } = await supabase
      .from("stories")
      .select("arc_title, follower_count")
      .gte("created_at", season.from)
      .lte("created_at", season.to)
      .eq("is_hidden", false)
      .not("arc_title", "is", null)
      .order("follower_count", { ascending: false })
      .limit(1);

    const topDramaArc = arcRows?.[0]?.arc_title ?? null;

    // Stories this user is following (only if logged in)
    let followed = 0;
    if (user) {
      const { count } = await supabase
        .from("story_follows")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", season.from)
        .lte("created_at", season.to);
      followed = count ?? 0;
    }

    // Top emotional label = top reaction key mapped to a short label
    const labelMap: Record<string, string> = {
      "I NEED THE UPDATE": "Cliffhanger addict",
      "Girl stand up": "Hype girl",
      "This is insane": "Chaos witness",
      "Crying for you": "Empath",
      "That would ruin me": "Dramatic empath",
      "Team OP": "Loyal ally",
    };
    const topDramaLabel = topReaction ? (labelMap[topReaction] ?? topReaction) : null;

    const headline = makeHeadlineForSeason(storiesRead ?? 0, votescast, season.season_name);
    const lines = makeLines(
      storiesRead ?? 0,
      votescast,
      topCategory,
      topDramaArc,
      topReaction,
      followed
    );

    recaps.push({
      id: season.id,
      slug: season.slug,
      season_name: season.season_name,
      description: season.description,
      color: season.color,
      storiesRead: storiesRead ?? 0,
      votescast,
      topCategory,
      topReaction,
      topDramaLabel,
      topDramaArc,
      followed,
      headline,
      lines,
    });
  }

  return { recaps, isLoggedIn: !!user };
}

// Headline needs the season name, so extract it here
function makeHeadlineForSeason(storiesRead: number, votescast: number, seasonName: string): string {
  if (storiesRead === 0) return "Your season starts now.";
  if (storiesRead < 5) return `You dipped your toes in with ${storiesRead} stories.`;
  if (storiesRead < 20) return `You survived ${storiesRead} friendship disasters.`;
  if (storiesRead < 50) return `Your ${seasonName} lore was dangerously active.`;
  return `${storiesRead} stories. You are the main character.`;
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function WrappedPage() {
  const { recaps, isLoggedIn } = await fetchRecaps();

  return (
    <main className="pb-24">
      <BrandBar />
      <section className="mx-auto max-w-md px-4 py-6">
        <div className="mb-5">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#787775]">Seasonal Wrapped</p>
          <h1 className="mt-2 text-3xl font-medium leading-tight text-[#4b4b47]">
            Your drama era, screenshot-ready
          </h1>
          {!isLoggedIn && (
            <p className="mt-2 text-sm text-[#787775]">
              <Link className="underline underline-offset-2" href="/login">
                Log in
              </Link>{" "}
              to see your personal vote counts and follows.
            </p>
          )}
        </div>

        {/* Season jump links */}
        <section className="mb-5 rounded-[2rem] border border-[#d8d3ce] bg-[#f8f8f6] p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#787775]">Wrapped categories</p>
          <div className="mt-4 grid gap-3">
            {recaps.map((recap) => (
              <a
                key={recap.id}
                className={`rounded-2xl ${recap.color} p-4 text-[#4b4b47]`}
                href={`#${recap.slug}`}
              >
                <h2 className="text-xl font-medium">{recap.season_name}</h2>
                <p className="mt-1 text-sm font-medium leading-6">{recap.description}</p>
              </a>
            ))}
          </div>
        </section>

        {/* Recap cards */}
        <div className="grid gap-5">
          {recaps.map((recap) => (
            <article
              key={recap.id}
              id={recap.slug}
              className="overflow-hidden rounded-[2rem] border border-[#d8d3ce] bg-[#f8f8f6] shadow-sm"
            >
              {/* Header */}
              <div className="bg-[#f8c0c8] p-5 text-[#4b4b47]">
                <p className="text-xs font-medium uppercase tracking-[0.2em]">{recap.season_name}</p>
                <h2 className="mt-3 text-4xl font-medium leading-tight">{recap.headline}</h2>
              </div>

              <div className="p-5">
                {recap.storiesRead === 0 ? (
                  /* ── Empty state ── */
                  <div className="rounded-2xl bg-[#e1e2e6] px-5 py-8 text-center">
                    <p className="text-2xl">📭</p>
                    <p className="mt-3 text-sm font-medium text-[#4b4b47]">
                      No drama logged for this season yet.
                    </p>
                    <p className="mt-1 text-xs text-[#787775]">
                      Read some stories and come back — your recap builds itself.
                    </p>
                    <Link
                      href="/"
                      className="mt-4 inline-block rounded-2xl bg-[#f8c0c8] px-5 py-2 text-xs font-medium text-[#4b4b47]"
                    >
                      Browse the feed →
                    </Link>
                  </div>
                ) : (
                  <>
                    {/* Stats row */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-[#e1e2e6] p-4">
                        <p className="text-3xl font-medium text-[#4b4b47]">{recap.storiesRead}</p>
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#787775]">Read</p>
                      </div>
                      <div className="rounded-2xl bg-[#e1e2e6] p-4">
                        <p className="text-3xl font-medium text-[#4b4b47]">{recap.votescast}</p>
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#787775]">Votes</p>
                      </div>
                    </div>

                    {/* Insight lines */}
                    <div className="mt-4 grid gap-3">
                      {recap.lines.map((line) => (
                        <p
                          key={line}
                          className="rounded-2xl bg-[#e1e2e6] p-4 text-sm font-medium leading-6 text-[#4b4b47]"
                        >
                          {line}
                        </p>
                      ))}
                    </div>

                    {/* Top drama era */}
                    {(recap.topDramaLabel || recap.topDramaArc) && (
                      <div className="mt-4 rounded-2xl border border-[#d8d3ce] p-4">
                        <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-[#787775]">
                          <Sparkles size={15} />
                          Top drama era
                        </p>
                        <p className="mt-2 text-xl font-medium leading-tight text-[#4b4b47]">
                          {recap.topDramaLabel ?? ""}
                          {recap.topDramaLabel && recap.topDramaArc ? " in " : ""}
                          {recap.topDramaArc ?? ""}
                        </p>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <button
                        className="flex min-h-11 items-center justify-center gap-1 rounded-2xl bg-[#f8c0c8] px-2 text-xs font-medium text-[#4b4b47]"
                        type="button"
                      >
                        <Download size={15} />
                        Save Card
                      </button>
                      <button
                        className="flex min-h-11 items-center justify-center gap-1 rounded-2xl bg-[#e1e2e6] px-2 text-xs font-medium text-[#4b4b47]"
                        type="button"
                      >
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
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
      <AppNav />
    </main>
  );
}
