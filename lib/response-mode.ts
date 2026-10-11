import { reactionLabels } from "@/lib/sample-data";
import type { ReactionKey } from "@/lib/types";

export const responseModes = {
  listen: {
    label: "Just letting it out",
    description: "No comments or reactions. A little space to let it out.",
    reminder: "Just listening today. Replies are off.",
    placeholder: "",
  },
  comfort: {
    label: "Comfort welcome",
    description: "Kind comments and a “Here for you” reaction.",
    reminder: "OP would welcome comfort. Offer kindness rather than unsolicited advice.",
    placeholder: "Leave a little kindness…",
  },
  advice: {
    label: "Advice welcome",
    description: "Thoughtful suggestions and supportive reactions.",
    reminder: "OP would welcome advice. Offer thoughtful suggestions without judging.",
    placeholder: "Offer a thoughtful suggestion…",
  },
  anything: {
    label: "Anything welcome",
    description: "Comments and the usual reactions. Please keep it respectful.",
    reminder: "",
    placeholder: "Add a comment…",
  },
} as const;

export type ResponseMode = keyof typeof responseModes;
export function isResponseMode(value: unknown): value is ResponseMode {
  return typeof value === "string" && Object.hasOwn(responseModes, value);
}
export function getResponseMode(value: unknown): ResponseMode {
  return isResponseMode(value) ? value : "anything";
}
export function commentsAllowed(value: unknown) {
  return getResponseMode(value) !== "listen";
}
export function allowedReactions(value: unknown): readonly ReactionKey[] {
  switch (getResponseMode(value)) {
    case "listen": return [];
    case "comfort": return ["Here for you"];
    case "advice": return ["Here for you", "Team OP"];
    default: return reactionLabels;
  }
}
