import { libUrl } from "@/lib/library";
import { chunkItem, imageItem, type PreloadItem } from "@/lib/preload";

import { libraryDataItem } from "../../data";
import { fetchArtsData } from "../core/data";
import { sheetKey } from "./layout";
import { firstShown } from "./model";
import type { DesignHead, DesignItem } from "./types";

/** About this many sheets are waited for: the ones on the first screen. */
const FIRST_SHEETS = 3;

/**
 * What the first screen of Design needs: the data file, the room's code and the first three
 * sheets (the ones the search and the filters of the address leave first), each in the size the
 * page will draw on this screen, and the sheet the address opens (`?i=`). The other sheets load
 * when they come near, and the full size of a sheet loads only when it is opened.
 */
function designFirstScreen(): PreloadItem {
  return {
    id: "library-arts-design-first",
    label: "Loading the first sheets",
    weight: 4,
    run: async (report, context) => {
      const file = await fetchArtsData<DesignItem, DesignHead>("design");
      const params = new URLSearchParams(window.location.search);
      const picks = firstShown(
        file,
        { q: params.get("q") ?? "", kind: params.get("k") ?? "", who: params.get("a") ?? "" },
        FIRST_SHEETS,
      );
      const vw = document.documentElement.clientWidth;
      const vh = window.innerHeight;
      const dpr = window.devicePixelRatio || 1;
      const keys = picks.map((item) => sheetKey(item.img, vw, vh, dpr));
      const open = params.get("i") ?? "";
      const linked = open ? file.items.find((item) => item.id === open) : undefined;
      if (linked) keys.push(linked.img.p);

      const unique = Array.from(new Set(keys));
      let done = 0;
      await Promise.all(
        unique.map(async (key) => {
          await imageItem(libUrl(key), "Loading the first sheets").run(() => undefined, context);
          done += 1;
          report(done / unique.length);
        }),
      );
    },
  };
}

export function items(): PreloadItem[] {
  return [
    libraryDataItem("arts-design"),
    chunkItem("library-arts-design", "Opening the room", () => import("./page"), 2),
    designFirstScreen(),
  ];
}
