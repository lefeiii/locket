export const slmTopics = [
  ["friendship_fallout", "friendship fallout"], ["feeling_left_out", "feeling left out"],
  ["family", "family problems"], ["relationships", "relationships"],
  ["school_stress", "school stress"], ["loneliness", "loneliness"],
] as const;
export const connectionLabels: Record<string, string> = {
  now: "someone going through it right now", been_through: "someone who’s been through it", both: "a little of both",
};
export const stageLabels: Record<string, string> = {
  going_through: "I’m going through it now", been_through: "I’ve been through it", both: "some of both",
};
export type SlmEnrollment = {
  connection_preference: string; experience_stage: string; topics: string[];
  offer_encouragement: boolean; age_band: string; review_status: string;
  consented_at: string; updated_at: string;
};
export type SlmReport = { id: string; category: string; status: string; created_at: string };
export type SlmState = { available: boolean; moderator: boolean; enrollment: SlmEnrollment | null; reports: SlmReport[] };
export const slmButton = "min-h-11 rounded-full bg-[#efd2dc] px-5 py-3 text-sm font-medium text-[#513940] disabled:opacity-50";
export const slmInput = "mt-2 min-h-11 w-full rounded-2xl border border-[#e3cdd5] bg-[#fffdfa] px-3 py-3 text-sm text-[#513940]";
