import { imageItem, chunkItem, type PreloadItem } from "@/lib/preload";

import { libraryDataItem } from "../data";
import { loadCoreFiles } from "./bundle";
import { firstReady, loadBundle, ROOM_ORDER } from "./characters";

/**
 * What the animation room needs on first paint: its data file, its code, the ten portraits of the
 * picker, and the welcome and the idle loop of the first character, in the size that suits the
 * display (the real bytes move the bar). Every other clip of that character and every other
 * character is deferred: the room loads them in the background and warms a tab when the pointer
 * rests on it.
 */
export function items(): PreloadItem[] {
  const first = firstReady();
  return [
    libraryDataItem("animation"),
    chunkItem("library-animation", "Opening the animation room", () => import("./page"), 2),
    ...ROOM_ORDER.map((slug) =>
      imageItem(`/img/char/${slug}/splash-sm.webp`, "Loading the portraits", 1),
    ),
    {
      id: `animation:first:${first}`,
      label: "Loading the first animation",
      weight: 30,
      memo: false,
      run: async (report) => {
        const bundle = await loadBundle(first);
        if (bundle) await loadCoreFiles(bundle, { onFraction: report });
      },
    },
  ];
}
