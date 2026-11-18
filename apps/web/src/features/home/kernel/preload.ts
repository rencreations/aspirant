/**
 * Puts the loading lists of all sections into one. The loading screen and the page change wait for
 * the items that are not `deferred` (the first screen); the rest download in the background in the
 * order of their `priority`, which is the order of the scroll story. The page may never be given
 * less because of the device or the connection: nothing here is capped or timed.
 */
import type { PreloadItem } from "@/lib/preload";

import type { HomeSection } from "./types";

/**
 * The items of every section, in scroll order. An item two sections both ask for is kept once, and
 * if either wants it waited for, it is waited for.
 */
export function aggregateItems(sections: readonly HomeSection[]): PreloadItem[] {
  const byId = new Map<string, PreloadItem>();
  for (const section of sections) {
    for (const item of section.preload()) {
      const known = byId.get(item.id);
      if (!known) {
        byId.set(item.id, item);
        continue;
      }
      // Waited wins over deferred.
      if (known.deferred && !item.deferred) byId.set(item.id, { ...known, deferred: false });
    }
  }
  return Array.from(byId.values());
}

/** What the bar waits for, and what goes on in the background. */
export function splitItems(items: readonly PreloadItem[]): {
  waited: PreloadItem[];
  deferred: PreloadItem[];
} {
  return {
    waited: items.filter((i) => !i.deferred),
    deferred: items.filter((i) => i.deferred),
  };
}
