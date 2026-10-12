import type { Story } from "@/lib/types";

// The legacy update flag alone does not establish that a post continues a story.
export function isStoryUpdate(story: Story): boolean {
  return story.is_update === true && (story.part_number ?? 1) > 1 &&
    Boolean(story.story_arc_id) && story.story_arc_id !== story.id;
}
