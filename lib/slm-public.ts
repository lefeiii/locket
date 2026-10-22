export type PublicPreference = { connection_preference: string; topics: string[] };
export type PublicListing = { topics: string[]; experience_stage: string; offer_encouragement: boolean; review_status: string };
export type OwnPublicStory = { id: string; title: string; public: boolean; listing: PublicListing | null };
export type FamiliarStory = { id: string; title: string; topics: string[]; stage: string; offers_encouragement: boolean };
export type PublicSlmState = { available: boolean; moderator: boolean; preferences: PublicPreference | null; stories: OwnPublicStory[]; recommendations: FamiliarStory[] };
export type PublicReview = { available: boolean; stories: {id: string; title: string; body: string; topics: string[]; stage: string; offers_encouragement: boolean; status: string; revision: string; public: boolean}[]; metrics: Record<string, unknown> };
