import type { SupabaseClient } from "@supabase/supabase-js";
import type { Story } from "@/lib/types";

export class StoryLinkError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

// Arc IDs and part numbers are determined by the server, never by typed titles.
export async function resolveStoryLink(
  client: SupabaseClient,
  userId: string,
  username: string,
  storyId: string,
  title: string,
  isUpdate: boolean,
  previousStoryId: unknown
) {
  if (!isUpdate) {
    return {
      story_arc_id: storyId,
      arc_title: title,
      part_number: 1,
      update_label: "Part 1",
      previous_story_reference: null,
    };
  }
  if (typeof previousStoryId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(previousStoryId)) {
    throw new StoryLinkError("Choose one of your previous stories before posting an update.");
  }
  const { data, error } = await client.from("stories").select("*")
    .eq("id", previousStoryId).maybeSingle();
  if (error) throw new StoryLinkError("Could not load the selected story. Please try again.", 500);
  const previous = data as Story | null;
  // Older posts have no user_id; the authenticated account's unique username
  // is the compatibility fallback. Explicit ownership always takes precedence.
  const ownsStory = previous && (previous.user_id
    ? previous.user_id === userId
    : previous.anonymous_name === username);
  if (!previous || !ownsStory || previous.is_hidden || previous.is_private || previous.is_diary_only) {
    throw new StoryLinkError("Choose one of your available public stories.");
  }
  const arcId = previous.story_arc_id || previous.id;
  const arcTitle = previous.arc_title || previous.title;
  if (!previous.story_arc_id) {
    let attach = client.from("stories")
      .update({ story_arc_id: arcId, arc_title: arcTitle, part_number: 1, update_label: "Part 1" })
      .eq("id", previous.id);
    attach = previous.story_arc_id === ""
      ? attach.eq("story_arc_id", "") : attach.is("story_arc_id", null);
    const { error: linkError } = await attach;
    if (linkError) throw new StoryLinkError("Could not link the selected story. Please try again.", 500);
  }
  // Include hidden parts so hiding a part does not reuse its number.
  const { data: latest, error: partsError } = await client.from("stories")
    .select("part_number").eq("story_arc_id", arcId)
    .eq("anonymous_name", previous.anonymous_name)
    .or(`user_id.eq.${userId},user_id.is.null`)
    .order("part_number", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
  if (partsError) throw new StoryLinkError("Could not determine the next part. Please try again.", 500);
  const partNumber = Math.max(latest?.part_number ?? 1, previous.part_number ?? 1, 1) + 1;
  return {
    story_arc_id: arcId,
    arc_title: arcTitle,
    part_number: partNumber,
    update_label: `Part ${partNumber}`,
    previous_story_reference: previous.title,
  };
}
