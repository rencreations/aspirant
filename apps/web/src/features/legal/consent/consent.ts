import { CONSENT_KEY, CONSENT_MAX_AGE_DAYS } from "@/lib/legal";

/**
 * The visitor's answer to "may Google Analytics count this visit?". Kept in this browser only
 * (localStorage), asked again after a year. Nothing is sent anywhere when a choice is saved.
 */
export type Choice = "accepted" | "rejected";

export interface SavedChoice {
  choice: Choice;
  /** When it was given (ms since 1970). */
  at: number;
}

const DAY_MS = 86_400_000;

/** A saved value, or null when there is none, it cannot be read, it is from the future or it has expired. */
export function parseSaved(raw: string | null, now: number): SavedChoice | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const { choice, at } = value as Record<string, unknown>;
    if (choice !== "accepted" && choice !== "rejected") return null;
    if (typeof at !== "number" || !Number.isFinite(at)) return null;
    if (at > now + DAY_MS) return null;
    if (now - at > CONSENT_MAX_AGE_DAYS * DAY_MS) return null;
    return { choice, at };
  } catch {
    return null;
  }
}

/** The saved choice, or null. Never throws (private mode, blocked storage). */
export function readSaved(now: number = Date.now()): SavedChoice | null {
  try {
    return parseSaved(window.localStorage.getItem(CONSENT_KEY), now);
  } catch {
    return null;
  }
}

/** Keep a choice. When storage is blocked the choice holds for this page only. */
export function saveChoice(choice: Choice, now: number = Date.now()): void {
  try {
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify({ choice, at: now }));
  } catch {
    /* storage unavailable: the choice still applies until the page closes */
  }
}

/** The browser says "do not sell or share my data" (Global Privacy Control). It counts as a refusal. */
export function globalPrivacyControl(): boolean {
  const nav = window.navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.globalPrivacyControl === true;
}
