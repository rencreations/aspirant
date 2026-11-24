/**
 * The words of the loading screen, made from what is true. The bar and the numbers come from the
 * real preload (`lib/home-flow.ts`); here the real labels of the running downloads are sorted into
 * a few groups (the drone, the art, the 3D models, the films) so the screen can say what is coming,
 * and a short line of company rotates while the wait is long. None of it moves the bar or claims a
 * state that is not real ("Nearly there" is said only past 90 percent of the real progress).
 * Pure strings, no DOM: tested.
 */

export type GroupId = "type" | "stage" | "drone" | "films" | "sound" | "models" | "art";

interface Group {
  id: GroupId;
  /** The short name shown on the screen. */
  name: string;
  test: RegExp;
}

/** The order is the order they are tested in and the order they are shown in. */
export const GROUPS: readonly Group[] = [
  { id: "type", name: "Type", test: /\btype\b|font|letters/i },
  { id: "stage", name: "The stage", test: /stage|engine|scene|\blogo\b/i },
  { id: "drone", name: "The drone", test: /drone|wings?\b/i },
  { id: "films", name: "Films", test: /film|video|trailer|clip|preview|loop/i },
  { id: "sound", name: "Sound", test: /voice|music|track|sound|record|gramophone/i },
  {
    id: "models",
    name: "3D models",
    test: /selena|silverbolt|doll|hand|tetra|camera|model|3d/i,
  },
  {
    id: "art",
    name: "The art",
    test: /art\b|picture|wall|splash|poster|cover|image|frame|card|logos/i,
  },
];

/** The group a loading label belongs to, or null when it fits none (it is still counted in the bar). */
export function groupOf(label: string): GroupId | null {
  for (const g of GROUPS) if (g.test.test(label)) return g.id;
  return null;
}

export interface GroupState {
  id: GroupId;
  name: string;
  /** Nothing of this group is still running. */
  done: boolean;
}

/**
 * The groups that are in the waited list, each with whether it is finished. `all` is every label of
 * the waited list (it does not change), `pending` the labels still running (the real progress
 * reports them). A group is done when none of its labels is still running.
 */
export function groupStates(all: readonly string[], pending: readonly string[]): GroupState[] {
  const present = new Set<GroupId>();
  for (const label of all) {
    const id = groupOf(label);
    if (id) present.add(id);
  }
  const running = new Set<GroupId>();
  for (const label of pending) {
    const id = groupOf(label);
    if (id) running.add(id);
  }
  return GROUPS.filter((g) => present.has(g.id)).map((g) => ({
    id: g.id,
    name: g.name,
    done: !running.has(g.id),
  }));
}

/** Short lines of company: light, true enough, never a number and never a claim about the state. */
export const COMPANY: readonly string[] = [
  "The drone is stretching its wings.",
  "A lot of pictures in this one.",
  "Good things take a moment.",
  "Warming up the animations.",
  "Every model is carried in whole.",
  "The art is hung one frame at a time.",
  "Nothing is skipped. It is all coming.",
  "The two helpers are getting the logo ready.",
];

/** The wait before the first line of company, and how long each stays. */
export const COMPANY_AFTER = 5;
export const COMPANY_EVERY = 4.5;

export interface CompanyInput {
  /** Seconds the loading screen has been up. */
  elapsed: number;
  /** The real progress, 0 to 1. */
  progress: number;
  offline: boolean;
  retrying: boolean;
  done: boolean;
}

/**
 * The line under the words: empty at first, then a line of company that changes every few seconds
 * while the wait goes on. Past 90 percent of the REAL progress it says so. Offline or while a
 * download is retried the host's own note speaks, so this stays quiet.
 */
export function companyLine(input: CompanyInput): string {
  if (input.done || input.offline || input.retrying) return "";
  if (input.progress >= 0.9) return "Nearly there.";
  if (input.elapsed < COMPANY_AFTER) return "";
  const n = Math.floor((input.elapsed - COMPANY_AFTER) / COMPANY_EVERY);
  return COMPANY[n % COMPANY.length] ?? "";
}

/** The words for the gate once everything is in. */
export const TAP_WORDS = "Touch anywhere to continue";
