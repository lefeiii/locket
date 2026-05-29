export type StoryCategory = "Crush" | "Friendship" | "School" | "Family" | "AITA" | "Update" | "Cheating";

export type ReactionKey =
  | "I NEED THE UPDATE"
  | "Girl stand up"
  | "This is insane"
  | "Crying for you"
  | "That would ruin me"
  | "Team OP";

export type ReactionCounts = Record<ReactionKey, number>;

export type Story = {
  id: string;
  anonymous_name: string;
  title: string;
  category: StoryCategory;
  body: string;
  is_update: boolean;
  previous_story_reference: string | null;
  story_arc_id?: string | null;
  arc_title?: string | null;
  part_number?: number | null;
  update_label?: string | null;
  cliffhanger?: string | null;
  is_resolved?: boolean;
  status?: StoryStatus;
  status_updated_at?: string | null;
  has_active_poll?: boolean;
  reactions: ReactionCounts;
  created_at: string;
  comments_count?: number;
  follower_count?: number;
};

export type StoryStatus =
  | "Unresolved"
  | "He replied"
  | "Blocked"
  | "Currently avoiding them"
  | "Friend group found out"
  | "Update pending"
  | "Resolved"
  | "Crashed out again";

export type StoryPoll = {
  id: string;
  story_id: string;
  question: string;
  options: string[];
  votes: Record<string, number>;
  created_at: string;
  closes_at?: string | null;
  is_active: boolean;
};

export type SeasonalWrapped = {
  id: string;
  user_or_device_id: string;
  season_name: "Winter Wildin'" | "Summer Special";
  period_start: string;
  period_end: string;
  recap_data: {
    stories_read: number;
    stories_posted: number;
    most_reacted_category: StoryCategory;
    votes_cast: number;
    most_used_reaction: ReactionKey;
    most_followed_story_arc: string;
    updates_followed: number;
    top_emotional_label: string;
    headline: string;
    lines: string[];
  };
  created_at: string;
};

export type PersonaBadge = {
  id: string;
  persona_id: string;
  badge_name: string;
  badge_description: string;
  unlocked_at: string;
  is_equipped: boolean;
};

export type Comment = {
  id: string;
  story_id: string;
  anonymous_name: string;
  body: string;
  created_at: string;
};

export type ReportReason =
  | "Bullying"
  | "Doxxing"
  | "Harassment"
  | "Hate"
  | "Sexual content involving minors"
  | "Other";
