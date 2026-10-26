import type { CSSProperties } from "react";

import type { Who } from "./media";

/** Per page copy and colours. The facts themselves come from the content layer. */
export interface WhoConfig {
  /** Colours of the page. `*Text` colours read on the page ground; the others are for fills. */
  vars: CSSProperties;
  /** What the pointer does on the first screen. */
  hint: string;
  /** The label the site cursor shows on the first screen. */
  cursor: string;
  /** The button that does the same for keyboard and touch. */
  action: string;
  /** Titles of the six notes, in the order of the content layer. */
  topics: readonly [string, string, string, string, string, string];
  profileLead: string;
  voiceLead: string;
  /** What the channel pill says about who is on the other end. */
  channel: string;
  /** Player colours (ink plate, keyline, accent). */
  skin: { ink: string; keyline: string; accent: string };
  /** Viewer colours (ground, keyline, accent). */
  viewer: { ground: string; keyline: string; accent: string };
}

const v = (o: Record<string, string>) => o as CSSProperties;

export const CONFIG: Readonly<Record<Who, WhoConfig>> = {
  lesley: {
    vars: v({
      "--lc-ground": "#f6f1ee",
      "--lc-ground-2": "#ece3de",
      "--lc-ink": "#1c0f0d",
      "--lc-ink-2": "#2d1a16",
      "--lc-dim": "#5a4640",
      "--lc-a": "#e4512b",
      "--lc-a-text": "#b23a1a",
      "--lc-b": "#39d3e3",
      "--lc-b-text": "#0a6672",
      "--lc-gold": "#f2c35b",
      "--lc-line": "rgb(28 15 13 / 18%)",
    }),
    hint: "Move to aim. Hold to steady her breath, let go to fire.",
    cursor: "HOLD",
    action: "Take a shot",
    topics: ["Manner", "Look", "Shot", "Origin", "Reason", "Weight"],
    profileLead: "Quiet, exact and steady. She writes the hour in the log.",
    voiceLead: "Tap a line to hear her. One plays at a time.",
    channel: "Chang'e on the line",
    skin: { ink: "#1c0f0d", keyline: "#e4512b", accent: "#39d3e3" },
    viewer: { ground: "#150b09", keyline: "#e4512b", accent: "#39d3e3" },
  },
  change: {
    vars: v({
      "--lc-ground": "#f6f2fc",
      "--lc-ground-2": "#ebe4f7",
      "--lc-ink": "#24132f",
      "--lc-ink-2": "#33204a",
      "--lc-dim": "#5c4a72",
      "--lc-a": "#ff8fc7",
      "--lc-a-text": "#a02f6c",
      "--lc-b": "#3fd3b8",
      "--lc-b-text": "#0b6a58",
      "--lc-gold": "#7a56d8",
      "--lc-line": "rgb(36 19 47 / 18%)",
    }),
    hint: "Move to measure. Press to drop a pin. Press a marker to read it.",
    cursor: "PIN",
    action: "Drop a pin",
    topics: ["Mind", "Look", "Gadgets", "Origin", "Wish", "Slips"],
    profileLead: "Very small, very clever and not a kid. She measures everything.",
    voiceLead: "Tap a line to hear her. One plays at a time.",
    channel: "Lesley on the line",
    skin: { ink: "#24132f", keyline: "#ff8fc7", accent: "#3fd3b8" },
    viewer: { ground: "#170c20", keyline: "#ff8fc7", accent: "#3fd3b8" },
  },
};
