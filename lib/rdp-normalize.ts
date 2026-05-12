export const DIRECT_ACCESS_LABEL = "Acces direct non identifie";

export const TECHNICAL_USERS = [
  "autocad_user",
  "s.cotti",
  "n/a",
  "na",
  "null",
  "undefined",
  "domaine",
  "domaine:",
  "domain",
  "domain:",
];

export function normalizeText(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeLower(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

export function isTechnicalOrInvalidUser(value: unknown): boolean {
  const user = normalizeLower(value);

  if (!user) return true;

  if (TECHNICAL_USERS.includes(user)) return true;

  if (/^(domaine|domain)\s*:?\s*$/i.test(user)) return true;

  if (user.startsWith("domaine:")) return true;
  if (user.startsWith("domain:")) return true;

  return false;
}

export function cleanRdpUser(value: unknown): string {
  const user = normalizeText(value);

  if (isTechnicalOrInvalidUser(user)) {
    return DIRECT_ACCESS_LABEL;
  }

  return user;
}