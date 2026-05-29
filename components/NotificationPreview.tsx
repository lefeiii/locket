import { BellRing } from "lucide-react";
import type { Story } from "@/lib/types";

type NotificationPreviewProps = {
  stories: Story[];
};

export function NotificationPreview({ stories }: NotificationPreviewProps) {
  const active = stories.filter((story) => story.is_update || story.cliffhanger).slice(0, 2);

  return (
    <section className="mx-auto max-w-md px-4 pb-4">
      <div className="rounded-[2rem] border border-[#d8d3ce] bg-[#e1e2e6] p-4 text-[#4b4b47] shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <BellRing size={18} />
          <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-[#787775]">Return alerts</h2>
        </div>
        <div className="grid gap-2">
          {active.map((story) => (
            <p className="rounded-2xl bg-[#f8f8f6] p-3 text-sm font-medium leading-5" key={story.id}>
              {story.is_update
                ? `${story.anonymous_name} posted an update`
                : `${story.arc_title ?? story.title} has a new cliffhanger`}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
