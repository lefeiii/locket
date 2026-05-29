const blockedTerms = [
  "full name:",
  "address:",
  "phone:",
  "school:",
  "kill yourself",
  "leaked photo",
  "real address"
];

export function findSafetyIssues(text: string) {
  const normalized = text.toLowerCase();
  return blockedTerms.filter((term) => normalized.includes(term));
}

export const safetyWarning =
  "Do not include real full names, addresses, phone numbers, school names, private photos, threats, or accusations that could identify someone.";
