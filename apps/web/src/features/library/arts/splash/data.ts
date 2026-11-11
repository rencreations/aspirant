import type { Slug } from "@/content/types";

import raw from "../../../../../public/data/library/arts-splash.json";
import type { ArtsFile, ArtsItem, FrameRect } from "../core/types";

/**
 * One picture of Splash art. `frame` is the part of the picture the stage's pane shows (a 16:9
 * cut, all of the picture when it already is 16:9) and `focus` the point that matters most in it.
 */
export interface SplashItem extends ArtsItem {
  room: "splash";
  eyebrow: string;
  line: string;
  order: number;
  frame: FrameRect;
  focus: { x: number; y: number };
  facts: {
    kind: string | null;
    date: string | null;
    artist: string | null;
    platform: string | null;
    source: string | null;
    sourceUrl: string | null;
  };
}

interface SplashHead {
  pairs?: Array<{ id: string; name: string }>;
}

/**
 * The data file is read at build time, not fetched: the title list is a real list of links in the
 * page's HTML (the text of a visitor without scripts and of a crawler), so the data has to be in
 * the code that draws it. The file is small (a few KB for each picture).
 */
const file = raw as unknown as ArtsFile<SplashItem> & SplashHead;

const byOrder = (a: SplashItem, b: SplashItem) => a.order - b.order;

/** The pictures in the order of the stage, the first one at the top of the list. */
export const SPLASH_ITEMS: readonly SplashItem[] = [...file.items].sort(byOrder);

/** The ten Aspirants, spelled as canon (`docs/design/canon-rules.md`). */
export const NAMES: Readonly<Record<Slug, string>> = {
  fanny: "Fanny",
  layla: "Layla",
  ruby: "Ruby",
  angela: "Angela",
  lesley: "Lesley",
  change: "Chang'e",
  guinevere: "Guinevere",
  vexana: "Vexana",
  obsidia: "Obsidia",
  selena: "Selena",
};
