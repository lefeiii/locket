import type { PersonaBadge, ReactionCounts, SeasonalWrapped, Story, StoryPoll } from "@/lib/types";

export const categories = ["Crush", "Friendship", "School", "Family", "AITA", "Update", "Cheating"] as const;

export const reactionLabels = [
  "I NEED THE UPDATE",
  "Girl stand up",
  "This is insane",
  "Crying for you",
  "That would ruin me",
  "Team OP"
] as const;

export const emptyReactions = (): ReactionCounts => ({
  "I NEED THE UPDATE": 0,
  "Girl stand up": 0,
  "This is insane": 0,
  "Crying for you": 0,
  "That would ruin me": 0,
  "Team OP": 0
});

export const anonymousNames = [
  "DramaBunny",
  "Crybaby444",
  "SchoolTeaGhost",
  "DramaGhost247",
  "SecretSprite",
  "MysteryMain",
  "DiaryBandit",
  "PlotTwistPal"
];

export function generateAnonymousName() {
  return anonymousNames[Math.floor(Math.random() * anonymousNames.length)];
}

export const sampleStories: Story[] = [
  {
    id: "sample-crush",
    anonymous_name: "DramaBunny",
    title: "My hallway crush asked for my playlist",
    category: "Crush",
    body:
      "He said he needed new music for practice, but then he liked every single sad song on it within ten minutes. Today he walked past me and said track seven was too specific. Track seven is literally called 'I know you know.'",
    is_update: false,
    previous_story_reference: null,
    story_arc_id: "playlist-boy",
    arc_title: "The playlist boy saga",
    part_number: 1,
    update_label: "Part 1",
    cliffhanger: "Then he asked why track seven sounded like him.",
    is_resolved: false,
    status: "Unresolved",
    status_updated_at: new Date().toISOString(),
    has_active_poll: true,
    reactions: {
      "I NEED THE UPDATE": 342,
      "Girl stand up": 18,
      "This is insane": 281,
      "Crying for you": 63,
      "That would ruin me": 207,
      "Team OP": 207
    },
    created_at: new Date().toISOString(),
    comments_count: 39,
    follower_count: 18400
  },
  {
    id: "sample-friendship",
    anonymous_name: "Crybaby444",
    title: "My best friend has a private group chat without me",
    category: "Friendship",
    body:
      "I found out because she accidentally screenshared it during homework help. The chat name is an inside joke from my own birthday party. I acted normal, but my stomach has been doing gymnastics since.",
    is_update: false,
    previous_story_reference: null,
    story_arc_id: "private-group-chat",
    arc_title: "The private group chat fallout",
    part_number: 1,
    update_label: "Part 1",
    cliffhanger: "Then I saw my birthday nickname in the chat title.",
    is_resolved: false,
    status: "Friend group found out",
    status_updated_at: new Date().toISOString(),
    reactions: {
      "I NEED THE UPDATE": 410,
      "Girl stand up": 256,
      "This is insane": 398,
      "Crying for you": 232,
      "That would ruin me": 355,
      "Team OP": 255
    },
    created_at: new Date().toISOString(),
    comments_count: 74,
    follower_count: 9300
  },
  {
    id: "sample-school",
    anonymous_name: "SchoolTeaGhost",
    title: "Someone submitted my poem to the assembly",
    category: "School",
    body:
      "It was in a shared doc for class feedback only. Now the teacher wants me to read it Friday, and everyone keeps asking who it is about. The answer is: nobody who needs that much public attention.",
    is_update: false,
    previous_story_reference: null,
    story_arc_id: "assembly-poem",
    arc_title: "The assembly poem incident",
    part_number: 1,
    update_label: "Part 1",
    cliffhanger: "The teacher said she already printed my name on the program.",
    is_resolved: false,
    status: "Update pending",
    status_updated_at: new Date().toISOString(),
    reactions: {
      "I NEED THE UPDATE": 197,
      "Girl stand up": 41,
      "This is insane": 236,
      "Crying for you": 88,
      "That would ruin me": 219,
      "Team OP": 119
    },
    created_at: new Date().toISOString(),
    comments_count: 22
  },
  {
    id: "sample-aita",
    anonymous_name: "DiaryBandit",
    title: "AITA for not covering for my lab partner?",
    category: "AITA",
    body:
      "We had two weeks. I did my half, they kept saying 'tonight for sure,' and then asked me to say we both lost access to the file. I told the teacher the truth, and now their friends are acting like I betrayed them.",
    is_update: false,
    previous_story_reference: null,
    story_arc_id: "lab-partner",
    arc_title: "The lab partner receipts",
    part_number: 1,
    update_label: "Part 1",
    cliffhanger: "Then their friends found out I had screenshots.",
    is_resolved: false,
    status: "Crashed out again",
    status_updated_at: new Date().toISOString(),
    reactions: {
      "I NEED THE UPDATE": 177,
      "Girl stand up": 152,
      "This is insane": 204,
      "Crying for you": 45,
      "That would ruin me": 101,
      "Team OP": 301
    },
    created_at: new Date().toISOString(),
    comments_count: 58
  },
  {
    id: "sample-update",
    anonymous_name: "DramaBunny",
    title: "Update 2: the playlist boy made me one back",
    category: "Update",
    body:
      "He sent a playlist called 'track seven response' and the first song was so obvious I had to put my phone face down. I have not replied because I need three business days and maybe a committee.",
    is_update: true,
    previous_story_reference: "My hallway crush asked for my playlist",
    story_arc_id: "playlist-boy",
    arc_title: "The playlist boy saga",
    part_number: 2,
    update_label: "Part 2",
    cliffhanger: "He named the playlist after the lyric I posted at midnight.",
    is_resolved: false,
    status: "He replied",
    status_updated_at: new Date().toISOString(),
    has_active_poll: true,
    reactions: {
      "I NEED THE UPDATE": 699,
      "Girl stand up": 42,
      "This is insane": 620,
      "Crying for you": 171,
      "That would ruin me": 511,
      "Team OP": 411
    },
    created_at: new Date().toISOString(),
    comments_count: 103,
    follower_count: 18400
  },
  {
    id: "sample-family",
    anonymous_name: "SecretSprite",
    title: "My cousin read my notes app at dinner",
    category: "Family",
    body:
      "She grabbed my phone to pick music and somehow opened a note titled 'things I cannot say out loud.' Now she keeps giving me meaningful looks across the table like she has a Netflix recap to deliver.",
    is_update: false,
    previous_story_reference: null,
    story_arc_id: "notes-app-dinner",
    arc_title: "The notes app dinner disaster",
    part_number: 1,
    update_label: "Part 1",
    cliffhanger: "Then she asked if 'J' was coming to the family party.",
    is_resolved: false,
    status: "Currently avoiding them",
    status_updated_at: new Date().toISOString(),
    reactions: {
      "I NEED THE UPDATE": 231,
      "Girl stand up": 188,
      "This is insane": 277,
      "Crying for you": 144,
      "That would ruin me": 190,
      "Team OP": 90
    },
    created_at: new Date().toISOString(),
    comments_count: 31
  }
];

export const samplePolls: StoryPoll[] = [
  {
    id: "poll-playlist-text-back",
    story_id: "sample-update",
    question: "Should I text him back tonight?",
    options: ["Text him", "Wait until tomorrow", "Ask what track seven means", "Absolutely do not"],
    votes: {
      "Text him": 44,
      "Wait until tomorrow": 128,
      "Ask what track seven means": 211,
      "Absolutely do not": 87
    },
    created_at: new Date().toISOString(),
    closes_at: null,
    is_active: true
  },
  {
    id: "poll-playlist-original",
    story_id: "sample-crush",
    question: "Should I admit track seven was about him?",
    options: ["Yes", "Deny everything", "Send another playlist"],
    votes: {
      Yes: 96,
      "Deny everything": 54,
      "Send another playlist": 143
    },
    created_at: new Date().toISOString(),
    closes_at: null,
    is_active: true
  }
];

export const sampleWrapped: SeasonalWrapped[] = [
  {
    id: "wrapped-winter",
    user_or_device_id: "sample-device",
    season_name: "Winter Wildin'",
    period_start: "2026-09-01",
    period_end: "2026-12-31",
    recap_data: {
      stories_read: 47,
      stories_posted: 3,
      most_reacted_category: "Crush",
      votes_cast: 12,
      most_used_reaction: "I NEED THE UPDATE",
      most_followed_story_arc: "The playlist boy saga",
      updates_followed: 8,
      top_emotional_label: "Emotionally invested",
      headline: "You survived 47 friendship disasters.",
      lines: [
        "You voted 'Do not text him' 12 times. They texted him anyway.",
        "Your top category was Crush. Be honest, you knew that.",
        "You followed 8 unresolved situations."
      ]
    },
    created_at: new Date().toISOString()
  },
  {
    id: "wrapped-summer",
    user_or_device_id: "sample-device",
    season_name: "Summer Special",
    period_start: "2026-01-01",
    period_end: "2026-06-30",
    recap_data: {
      stories_read: 68,
      stories_posted: 5,
      most_reacted_category: "Friendship",
      votes_cast: 19,
      most_used_reaction: "Girl stand up",
      most_followed_story_arc: "The private group chat fallout",
      updates_followed: 6,
      top_emotional_label: "Red flag historian",
      headline: "Your summer lore was dangerously active.",
      lines: [
        "You read 23 prom disasters and somehow kept going.",
        "Your most used reaction was 'Girl stand up.' Accurate.",
        "You were emotionally invested in 6 unfinished arcs."
      ]
    },
    created_at: new Date().toISOString()
  }
];

export const samplePersonaBadges: PersonaBadge[] = [
  {
    id: "badge-drama-bunny-update-queen",
    persona_id: "DramaBunny",
    badge_name: "Update Queen",
    badge_description: "Keeps the timeline fed with part twos.",
    unlocked_at: new Date().toISOString(),
    is_equipped: true
  },
  {
    id: "badge-drama-bunny-cliffhanger",
    persona_id: "DramaBunny",
    badge_name: "Cliffhanger Criminal",
    badge_description: "Ends every update at the worst possible moment.",
    unlocked_at: new Date().toISOString(),
    is_equipped: false
  }
];

export function getStoryArc(story: Story, stories = sampleStories) {
  if (!story.story_arc_id) {
    return [story];
  }

  return stories
    .filter((item) => item.story_arc_id === story.story_arc_id)
    .sort((a, b) => (a.part_number ?? 1) - (b.part_number ?? 1));
}

export function emotionalScore(story: Story) {
  const reactionScore = Object.values(story.reactions).reduce((sum, count) => sum + count, 0);
  const unresolvedBoost = story.is_resolved ? 0 : 900;
  const pollBoost = story.has_active_poll ? 1200 : 0;
  const statusBoost = story.status === "Unresolved" || story.status === "Update pending" ? 700 : 0;
  const cliffhangerBoost = story.cliffhanger ? 650 : 0;
  const chainBoost = story.part_number ? story.part_number * 120 : 0;
  const followerBoost = Math.min(story.follower_count ?? 0, 20000) / 10;

  return reactionScore + unresolvedBoost + pollBoost + statusBoost + cliffhangerBoost + chainBoost + followerBoost;
}
