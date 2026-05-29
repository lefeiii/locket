import { ArrowLeft, GitBranch, UserRound } from "lucide-react";
import Link from "next/link";
import { AppNav, BrandBar } from "@/components/AppNav";
import { FollowButton } from "@/components/FollowButton";
import { UpdateAlarmButton } from "@/components/UpdateAlarmButton";
import { samplePersonaBadges, sampleStories } from "@/lib/sample-data";
import { supabase } from "@/lib/supabase";
import type { Story } from "@/lib/types";

async function getPersonaStories(name: string): Promise<Story[]> {
  const decoded = decodeURIComponent(name);
  if (!supabase) {
    return sampleStories.filter((story) => story.anonymous_name === decoded);
  }

  const { data, error } = await supabase
    .from("stories")
    .select("*")
    .eq("anonymous_name", decoded)
    .order("created_at", { ascending: false });

  if (error || !data?.length) {
    return sampleStories.filter((story) => story.anonymous_name === decoded);
  }

  return data as Story[];
}

export default async function ProfilePage({ params }: { params: Promise<{ name: string }> }) {
  const { name: rawName } = await params;
  const name = decodeURIComponent(rawName);
  const stories = await getPersonaStories(rawName);
  const visibleStories = (stories.length ? stories : sampleStories.filter((story) => story.anonymous_name === name))
    .sort((a, b) => (a.story_arc_id ?? "").localeCompare(b.story_arc_id ?? "") || (a.part_number ?? 1) - (b.part_number ?? 1));
  const fallbackStories = visibleStories.length ? visibleStories : sampleStories.slice(0, 3);
  const badges = samplePersonaBadges.filter((badge) => badge.persona_id === name);
  const equippedBadge = badges.find((badge) => badge.is_equipped);

  return (
    <main className="pb-24">
      <BrandBar />
      <section className="mx-auto max-w-md px-4 py-5">
        <Link className="mb-4 flex items-center gap-2 text-sm font-medium text-[#4b4b47]" href="/">
          <ArrowLeft size={18} />
          Back to feed
        </Link>

        <div className="rounded-[2rem] border border-[#d8d3ce] bg-[#f8f8f6] p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-3xl bg-[#f8c0c8] text-[#4b4b47]">
              <UserRound size={30} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#787775]">Anonymous profile</p>
              <h1 className="text-3xl font-medium text-[#4b4b47]">{name}</h1>
            </div>
          </div>
          <div className="mt-4">
            <FollowButton posterName={name} />
          </div>
          <div className="mt-3">
            <UpdateAlarmButton label="Turn On Persona Alarm" />
          </div>

          {equippedBadge ? (
            <div className="mt-4 rounded-2xl bg-[#e1e2e6] p-4">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#787775]">Equipped label</p>
              <p className="mt-1 text-lg font-medium text-[#4b4b47]">{equippedBadge.badge_name}</p>
              <p className="mt-1 text-sm font-medium leading-6 text-[#787775]">{equippedBadge.badge_description}</p>
            </div>
          ) : null}

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-[#e1e2e6] p-4">
              <p className="text-3xl font-medium text-[#4b4b47]">{fallbackStories.length}</p>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#787775]">Stories</p>
            </div>
            <div className="rounded-2xl bg-[#e1e2e6] p-4">
              <p className="text-3xl font-medium text-[#4b4b47]">2.4k</p>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#787775]">Followers</p>
            </div>
          </div>
        </div>

        <section className="mt-6">
          <div className="mb-3 flex items-center gap-2">
            <GitBranch size={19} />
            <h2 className="text-xl font-medium text-[#4b4b47]">Binge their drama history</h2>
          </div>
          <div className="grid gap-3">
            {fallbackStories.map((story) => (
              <Link className="rounded-3xl bg-[#f8f8f6] p-4 shadow-lg" href={`/story/${story.id}`} key={story.id}>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#787775]">
                  {story.arc_title} · {story.update_label ?? story.category}
                </p>
                <h3 className="mt-1 text-xl font-medium leading-tight text-[#4b4b47]">{story.title}</h3>
                {story.status ? (
                  <p className="mt-2 inline-flex rounded-full bg-[#e1e2e6] px-3 py-1 text-xs font-medium text-[#4b4b47]">
                    {story.status}
                  </p>
                ) : null}
                {story.cliffhanger ? (
                  <p className="mt-2 rounded-2xl bg-[#f8c0c8] p-3 text-sm font-medium text-[#4b4b47]">{story.cliffhanger}</p>
                ) : null}
                <p className="mt-2 line-clamp-2 text-sm font-medium leading-6 text-[#4b4b47]">{story.body}</p>
              </Link>
            ))}
          </div>
        </section>
      </section>
      <AppNav />
    </main>
  );
}
