import { imageItem, runPreload } from "@/lib/preload";
import { routes } from "@/lib/site";

/**
 * The two aspirants of each page, shown large on the left and right of the menu while the page is
 * hovered (or is the current one). Art is built by `scripts/menu/build.py`: every figure has the
 * same size and the eyes of a pair sit on one line. The left figure faces right and stands on the
 * left of the screen, the right figure faces left and stands on the right.
 */
export interface MenuPair {
  left: string;
  right: string;
  /** Soft background colour that blooms behind the menu while the item is hovered. */
  tint: string;
}

const path = (page: string, side: "left" | "right") => `/img/menu/${page}-${side}.webp`;

export const MENU_PAIRS: Readonly<Record<string, MenuPair>> = {
  [routes.home]: { left: path("home", "left"), right: path("home", "right"), tint: "#ffdcc8" },
  [routes.experience]: {
    left: path("experience", "left"),
    right: path("experience", "right"),
    tint: "#ffd0e0",
  },
  [routes.story]: { left: path("story", "left"), right: path("story", "right"), tint: "#ffeeb3" },
  [routes.characters]: {
    left: path("character", "left"),
    right: path("character", "right"),
    tint: "#dcd3ff",
  },
  [routes.collection]: {
    left: path("collection", "left"),
    right: path("collection", "right"),
    tint: "#cfe8ff",
  },
};

/** Warm the cache for these routes' portraits so the menu never shows an empty pair. */
export function warmMenuPairs(hrefs: readonly string[]): Promise<void> {
  const items = hrefs.flatMap((href) => {
    const pair = MENU_PAIRS[href];
    return pair
      ? [
          imageItem(pair.left, "Loading the menu art"),
          imageItem(pair.right, "Loading the menu art"),
        ]
      : [];
  });
  return runPreload(items);
}
