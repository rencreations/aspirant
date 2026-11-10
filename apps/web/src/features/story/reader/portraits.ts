/**
 * Small portraits for cards: each Aspirant's `splash-sm.webp` (800 x 450) with the point where
 * her face sits, so a tight crop still shows it. Paths go through `asset()` at the call site.
 */
const FACES: Readonly<Record<string, readonly [number, number]>> = {
  fanny: [63, 24],
  layla: [65, 50],
  ruby: [40, 22],
  angela: [72, 30],
  lesley: [85, 30],
  change: [18, 22],
  guinevere: [66, 32],
  vexana: [52, 72],
  obsidia: [65, 26],
  selena: [70, 22],
};

/**
 * Where the subject sits across a tall 4:5 card cut from the 16:9 splash (only the horizontal
 * position matters there, because the card shows the whole height). Slugs left out use `FACES`.
 */
const CARD_X: Readonly<Record<string, number>> = {
  angela: 66,
  lesley: 68,
  change: 74,
  obsidia: 44,
};

export interface Portrait {
  readonly src: string;
  /** CSS object-position. */
  readonly position: string;
}

export function portraitFor(
  slug: string | null | undefined,
  shape: "face" | "card" = "face",
): Portrait | null {
  if (!slug) return null;
  const face = FACES[slug];
  if (!face) return null;
  const x = shape === "card" ? (CARD_X[slug] ?? face[0]) : face[0];
  return { src: `/img/char/${slug}/splash-sm.webp`, position: `${x}% ${face[1]}%` };
}

/** Aspirant names (canon rules, rule 7). */
export const ASPIRANT_NAMES: Readonly<Record<string, string>> = {
  layla: "Miss Hikari",
  fanny: "Blade of Kibou",
  ruby: "Mecha Maiden",
  angela: "Cyber Cherubin",
  lesley: "Deadeye Spectre",
  change: "Tech Tensai",
  vexana: "Twilight Star",
  guinevere: "Daybreak Halo",
  selena: "Silverbolt Raiko",
  obsidia: "Imperatrix Arashi",
};

/** Accent token per Aspirant, for speaker hints and card trims (themed, 4.5:1 or more). */
export const SPEAKER_ACCENT: Readonly<Record<string, string>> = {
  fanny: "var(--amber)",
  layla: "var(--crimson)",
  ruby: "var(--magenta)",
  angela: "var(--magenta)",
  lesley: "var(--amber)",
  change: "var(--cyan)",
  guinevere: "var(--gold)",
  vexana: "var(--violet)",
  obsidia: "var(--crimson)",
  selena: "var(--cyan)",
};
