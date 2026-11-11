import { NAVIGATED_EVENT } from "@/lib/hooks";
import { libUrl } from "@/lib/library";
import { chunkItem, type PreloadItem } from "@/lib/preload";

import { fetchLibraryJson, libraryDataItem, libraryDataPath } from "../../data";
import type { LibImage } from "../../types";
import { computeLayout } from "./model";
import { firstPlaces, laterPlaces, startIndex } from "./places";
import {
  GROUP,
  loadPicture,
  pickSize,
  pictureBytes,
  pictureItem,
  pictureState,
  subscribePicture,
} from "./pictures";

const ROUTE = "/collection/arts";

function onRoom(): boolean {
  return window.location.pathname.replace(/\/+$/u, "").endsWith(ROUTE);
}

/**
 * The query the room opens with (`?i=<id>`). On a first visit the address is already the room's. On a
 * page change the loading list starts before the address changes, so this waits for the change
 * itself (the transition tells when it has happened), never for a time.
 */
function roomQuery(): Promise<string> {
  if (onRoom()) return Promise.resolve(window.location.search);
  return new Promise((resolve) => {
    const check = () => {
      if (!onRoom()) return;
      window.removeEventListener(NAVIGATED_EVENT, check);
      window.removeEventListener("popstate", check);
      resolve(window.location.search);
    };
    window.addEventListener(NAVIGATED_EVENT, check);
    window.addEventListener("popstate", check);
  });
}

interface Entry {
  id: string;
  order: number;
  img: LibImage;
}

/**
 * The pictures of the room in the order of the stage, read from the data file (the room's own code
 * carries the same file for its HTML; this list must not, or every page of the site would carry it).
 */
async function readEntries(): Promise<Entry[]> {
  const file = await fetchLibraryJson<{ items: Entry[] }>(libraryDataPath("arts-splash"));
  return [...file.items].sort((a, b) => a.order - b.order);
}

/** The address of every picture at the size this display draws. The display decides, nothing else. */
function urlsAtThisSize(entries: readonly Entry[]): string[] {
  const layout = computeLayout(window.innerWidth, window.innerHeight);
  const size = pickSize(layout.pw, window.devicePixelRatio);
  return entries.map((entry) => libUrl(entry.img[size]));
}

/**
 * The first screen: the pictures at the places -1 to 3 around the picture the room opens on. The
 * entrance glides past three places and the loop shows the last picture above the first, so each of
 * them has to be there or one would pop in. The bar moves with the real bytes of the five.
 */
function firstItem(): PreloadItem {
  return {
    id: "splash-first",
    label: "Loading the first pictures",
    weight: 6,
    memo: false,
    run: async (report) => {
      const entries = await readEntries();
      const query = await roomQuery();
      const urls = urlsAtThisSize(entries);
      const start = startIndex(query, entries);
      const wanted = firstPlaces(start, entries.length)
        .map((k) => urls[k])
        .filter((u): u is string => !!u);
      const tell = () => {
        let fraction = 0;
        let received = 0;
        let total = 0;
        for (const u of wanted) {
          fraction += pictureState(u).fraction / wanted.length;
          const b = pictureBytes(u);
          received += b?.received ?? 0;
          total += b?.total ?? 0;
        }
        report(fraction, total > 0 ? { received, total } : undefined);
      };
      const stops = wanted.map((u) => subscribePicture(u, tell));
      try {
        await Promise.all(wanted.map((u) => loadPicture(u)));
      } finally {
        for (const stop of stops) stop();
      }
      report(1);
    },
  };
}

/**
 * The other pictures, in the background once the page is open, the nearest to the first screen
 * first. A step to one that has not arrived yet joins its download (`loadPicture`) and the window
 * shows its colour and the real share of its bytes meanwhile.
 */
function laterItems(): PreloadItem[] {
  return [
    {
      id: "splash-later",
      label: "Loading the other pictures",
      weight: 1,
      deferred: true,
      priority: 10,
      group: GROUP,
      memo: false,
      run: async () => {
        const entries = await readEntries();
        const query = await roomQuery();
        const urls = urlsAtThisSize(entries);
        const order = laterPlaces(startIndex(query, entries), entries.length)
          .map((k) => urls[k])
          .filter((u): u is string => !!u);
        const queue = [...order];
        const worker = async () => {
          for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
            // The visitor left the room: what has not started is not asked for (a visit later asks again).
            if (!onRoom()) return;
            await pictureItem(next, "Loading the other pictures").run(() => undefined, {
              background: true,
            });
          }
        };
        await Promise.all([worker(), worker()]);
      },
    },
  ];
}

/** The upright face of the caption. The shared list loads the italic one only. */
function typeItem(): PreloadItem {
  return {
    id: "splash-type",
    label: "Loading type",
    weight: 1,
    run: async () => {
      if (typeof document === "undefined" || !("fonts" in document)) return;
      await document.fonts.load('400 1em "Instrument Serif"');
    },
  };
}

/**
 * The loading list of `/collection/arts`. Waited for: the data file, the code and the first five
 * pictures. The rest comes in the background, nearest first.
 */
export function items(): PreloadItem[] {
  return [
    libraryDataItem("arts-splash"),
    typeItem(),
    chunkItem("library-arts-splash", "Opening the room", () => import("./page"), 2),
    firstItem(),
    ...laterItems(),
  ];
}
