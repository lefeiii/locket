// ── Blocked terms ─────────────────────────────────────────────────────────────
// These run both client-side (UX feedback) AND server-side (in the API route)
// so they can't be bypassed by disabling JS or using dev tools.

const blockedTerms = [
  // Personal info
  "full name:",
  "address:",
  "phone:",
  "school:",
  "real address",
  "home address",
  "lives at",
  "goes to",
  // Threats & harm
  "kill yourself",
  "kys",
  "kill her",
  "kill him",
  "i will find you",
  "you will pay",
  "leaked photo",
  "leak her",
  "leak his",
  // Explicit
  "send nudes",
  "nude photo",
  // Doxxing patterns
  "snapchat:",
  "instagram:",
  "tiktok:",
  "their @ is",
  "her @ is",
  "his @ is",
];

export function findSafetyIssues(text: string): string[] {
  const normalized = text.toLowerCase();
  return blockedTerms.filter((term) => normalized.includes(term));
}

export const safetyWarning =
  "Do not include real full names, addresses, phone numbers, school names, private photos, threats, or anything that could identify or harm someone. Violations are reported and reviewed.";
