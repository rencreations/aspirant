import type { MarkColor } from "./palette";

/**
 * Everything a section can ask the marks system for. Each kind is a recipe (`recipes.ts`) that
 * puts a few drawn parts on the stage; the parts are the shapes of `PRIM`.
 */
export const MARK_KINDS = [
  "bang",
  "question",
  "sweat",
  "vein",
  "annoyed",
  "spark",
  "starburst",
  "dizzy",
  "sparkle",
  "heart",
  "note",
  "dust",
  "zzz",
  "speed",
  "flash",
  "air",
  "cloud",
  "poof",
  "beads",
  "swear",
  "steam",
] as const;

export type MarkKind = (typeof MARK_KINDS)[number];

/** The shapes the shader draws. The numbers are the ones the shader branches on. */
export const PRIM = {
  bang: 0,
  question: 1,
  drop: 2,
  vein: 3,
  star: 4,
  sparkle: 5,
  heart: 6,
  note: 7,
  puff: 8,
  zed: 9,
  streak: 10,
  flash: 11,
  swear: 12,
} as const;

interface KindInfo {
  /** The height of the mark in CSS pixels when the caller gives none. */
  size: number;
  /** How many parts one call makes when the caller gives no count (a burst, a row of notes). */
  count: number;
  /** How long it lives in seconds when the caller gives none. */
  duration: number;
  color: MarkColor;
  accent: MarkColor;
  /**
   * A kind that can run as a loop (`sustain`): marks a second at intensity 1, and whether they
   * stay with the anchor (stream past it) or are left where they were made.
   */
  sustain?: { rate: number; follow: boolean };
}

export const KIND_INFO: Readonly<Record<MarkKind, KindInfo>> = {
  bang: { size: 76, count: 1, duration: 1.15, color: "gold", accent: "white" },
  question: { size: 70, count: 1, duration: 1.4, color: "pink", accent: "white" },
  sweat: { size: 26, count: 1, duration: 0.95, color: "sky", accent: "white" },
  vein: { size: 56, count: 1, duration: 1.05, color: "pink", accent: "white" },
  annoyed: { size: 64, count: 1, duration: 1.3, color: "pink", accent: "white" },
  spark: { size: 70, count: 9, duration: 0.55, color: "gold", accent: "white" },
  starburst: { size: 90, count: 7, duration: 0.95, color: "gold", accent: "white" },
  dizzy: { size: 80, count: 4, duration: 2.2, color: "gold", accent: "white" },
  sparkle: {
    size: 44,
    count: 1,
    duration: 0.95,
    color: "gold",
    accent: "white",
    sustain: { rate: 3, follow: false },
  },
  heart: {
    size: 42,
    count: 1,
    duration: 1.4,
    color: "pink",
    accent: "white",
    sustain: { rate: 1.6, follow: false },
  },
  note: {
    size: 46,
    count: 1,
    duration: 1.8,
    color: "pink",
    accent: "white",
    sustain: { rate: 2.4, follow: false },
  },
  dust: {
    size: 54,
    count: 3,
    duration: 0.8,
    color: "bone",
    accent: "white",
    sustain: { rate: 9, follow: false },
  },
  zzz: {
    size: 54,
    count: 1,
    duration: 2.0,
    color: "white",
    accent: "white",
    sustain: { rate: 0.5, follow: false },
  },
  speed: {
    size: 60,
    count: 5,
    duration: 0.34,
    color: "white",
    accent: "white",
    sustain: { rate: 16, follow: false },
  },
  flash: { size: 150, count: 1, duration: 0.34, color: "gold", accent: "white" },
  air: {
    size: 120,
    count: 14,
    duration: 0.5,
    color: "white",
    accent: "white",
    sustain: { rate: 26, follow: true },
  },
  cloud: {
    size: 120,
    count: 1,
    duration: 1.3,
    color: "bone",
    accent: "white",
    sustain: { rate: 1.2, follow: false },
  },
  poof: { size: 130, count: 7, duration: 0.7, color: "white", accent: "white" },
  beads: {
    size: 70,
    count: 6,
    duration: 0.9,
    color: "sky",
    accent: "white",
    sustain: { rate: 7, follow: false },
  },
  swear: { size: 96, count: 1, duration: 1.5, color: "white", accent: "pink" },
  steam: {
    size: 34,
    count: 2,
    duration: 0.9,
    color: "white",
    accent: "white",
    sustain: { rate: 4, follow: false },
  },
};

/** The direction a kind runs in when the caller gives none (a quarter turn is up). */
export function defaultDirection(kind: MarkKind): number {
  return kind === "air" ? Math.PI / 2 : 0;
}
