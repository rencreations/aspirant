import type { CSSProperties } from "react";

import type { Who } from "./media";

/** Per page copy and colours. The facts themselves come from the content layer. */
export interface WhoConfig {
  /** Colours of the page. `*Text` colours read on the page ground; the others are for fills. */
  vars: CSSProperties;
  /** The word on the side rail, which fills as the page is read. */
  railLabel: string;
  /** What the pointer does on the first screen. */
  hint: string;
  /** The label the site cursor shows on the first screen. */
  cursor: string;
  /** Titles of the six notes, in the order of the content layer. */
  topics: readonly [string, string, string, string, string, string];
  profileLead: string;
  voiceLead: string;
  /** Player colours (ink plate, keyline, accent). */
  skin: { ink: string; keyline: string; accent: string };
  /** Viewer colours (ground, keyline, accent). */
  viewer: { ground: string; keyline: string; accent: string };
}

const v = (o: Record<string, string>) => o as CSSProperties;

export const CONFIG: Readonly<Record<Who, WhoConfig>> = {
  layla: {
    vars: v({
      "--lf-ground": "#fff5f2",
      "--lf-ground-2": "#ffe6e0",
      "--lf-ink": "#14222b",
      "--lf-ink-2": "#1f3440",
      "--lf-dim": "#4b5d68",
      "--lf-a": "#ff7f7a",
      "--lf-a-text": "#b0332f",
      "--lf-b": "#14b3a6",
      "--lf-b-text": "#086a62",
      "--lf-glow": "#7df7ec",
      "--lf-line": "rgb(20 34 43 / 16%)",
    }),
    railLabel: "Charge",
    hint: "Move to aim. Press to fire.",
    cursor: "FIRE",
    topics: ["Temper", "Look", "Fight", "Origin", "Why", "Cracks"],
    profileLead: "Small, proud and loud. The cannon is as tall as she is.",
    voiceLead: "Tap a line to hear her. One plays at a time.",
    skin: { ink: "#14222b", keyline: "#ff7f7a", accent: "#14b3a6" },
    viewer: { ground: "#0d1820", keyline: "#ff7f7a", accent: "#14b3a6" },
  },
  fanny: {
    vars: v({
      "--lf-ground": "#f6f1ff",
      "--lf-ground-2": "#e9e0fb",
      "--lf-ink": "#1e1430",
      "--lf-ink-2": "#2c1f47",
      "--lf-dim": "#5b4f73",
      "--lf-a": "#f5862a",
      "--lf-a-text": "#8f4205",
      "--lf-b": "#6a3fb5",
      "--lf-b-text": "#5a3099",
      "--lf-glow": "#f2ecff",
      "--lf-line": "rgb(30 20 48 / 16%)",
    }),
    railLabel: "Altitude",
    hint: "Press anywhere. She hooks on and hauls up.",
    cursor: "HOOK",
    topics: ["Manner", "Look", "Flight", "Origin", "Aim", "Doubts"],
    profileLead: "Warm, careful and polite. Every flight goes into the drill-book.",
    voiceLead: "Tap a line to hear her. One plays at a time.",
    skin: { ink: "#1e1430", keyline: "#f5862a", accent: "#6a3fb5" },
    viewer: { ground: "#150d24", keyline: "#f5862a", accent: "#6a3fb5" },
  },
};
