import { imageItem, runPreload } from "@/lib/preload";
import { routes } from "@/lib/site";

/**
 * The two aspirants shown beside each menu title. Art is built by `scripts/menu/build.py`: every
 * figure has the same size and the eyes of a pair sit on one line. The left figure faces right
 * and stands left of the title, the right figure faces left and stands right of it.
 */
export interface MenuPair {
  left: string;
  right: string;
  /** Soft background colour that blooms behind the menu while the item is hovered. */
  tint: string;
}

const path = (slug: string) => `/img/menu/${slug}.webp`;

export const MENU_PAIRS: Readonly<Record<string, MenuPair>> = {
  [routes.home]: { left: path("fanny"), right: path("layla"), tint: "#ffdcc8" },
  [routes.experience]: { left: path("angela"), right: path("ruby"), tint: "#ffd0e0" },
  [routes.story]: { left: path("change"), right: path("lesley"), tint: "#ffeeb3" },
  [routes.characters]: { left: path("guinevere"), right: path("vexana"), tint: "#dcd3ff" },
  [routes.collection]: { left: path("selena"), right: path("obsidia"), tint: "#cfe8ff" },
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
