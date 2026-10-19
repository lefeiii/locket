export type Introduction = { id: string; topics: string[]; state: string; my_accepted: boolean; opened: boolean; expires_at: string; ready: boolean };
export type ContactState = { enabled: boolean; enrolled: boolean; opted_in: boolean; age_checked: boolean; connections: Introduction[] };
export type PeerMessage = { id: string; body: string; from_me: boolean; status: string; created_at: string };
export type ConversationState = { id: string; state: string; topics: string[]; can_send: boolean; feedback: string | null; messages: PeerMessage[] };
export type ContactParticipant = { id: string; age_band: string; review_status: string; updated_at: string; topics: string[]; connection: string; stage: string; offers_encouragement: boolean; contact_consent: boolean; age_checked: boolean | null; age_expires: string | null };
export type ContactReview = {
 enabled: boolean; participants: ContactParticipant[];
 introductions: { id: string; user_a: string; user_b: string; state: string; opened_at: string | null; expires_at: string }[];
 pending_messages: { id: string; intro_id: string; body: string; urgent: boolean; created_at: string }[];
 reports: { id: string; intro_id: string | null; reason: string; evidence: string | null; created_at: string }[];
 metrics: { proposed: number; mutually_accepted: number; understood: Record<string,number>; reports: number; unwanted_contact: number };
};
export const contactReasons = [['privacy','privacy or personal information'],['harassment','harassment'],['unwanted_contact','unwanted contact'],['urgent_safety','urgent safety concern'],['other','another concern']] as const;
