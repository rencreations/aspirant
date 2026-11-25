import { NAVIGATED_EVENT } from "@/lib/hooks";
import { libUrl } from "@/lib/library";
import { chunkItem, imageItem, type PreloadItem } from "@/lib/preload";

import { fetchLibraryJson, libraryDataItem, libraryDataPath } from "../data";
import { fetchOrder, flatViews, placeOf } from "./logic";
import type { ModelView, ModelsFile } from "./types";
import { loadViewFile, MODELS_GROUP } from "./view-files";

const ROUTE = "/collection/models";

function readModels(): Promise<ModelsFile> {
  return fetchLibraryJson<ModelsFile>(libraryDataPath("models"));
}

function onRoom(): boolean {
  return window.location.pathname.replace(/\/+$/u, "").endsWith(ROUTE);
}

/**
 * The query the room opens with (`?i=<entry>&v=<view>`). On a first visit the address is already
 * the room's. On a page change the loading list starts before the address changes, so this waits
 * for the change itself (the transition tells when it has happened), never for a time.
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

/** The index (in the flat list of views) of the view the room opens on. */
async function startView(file: ModelsFile): Promise<number> {
  const q = new URLSearchParams(await roomQuery());
  const place = placeOf(file.items, q.get("i") ?? "", q.get("v") ?? "");
  let index = 0;
  for (let e = 0; e < place.entry; e += 1) index += file.items[e]?.views.length ?? 0;
  return index + place.view;
}

/** The small pictures of the list, decoded into the browser cache. */
function thumbsItem(): PreloadItem {
  return {
    id: "models:thumbs",
    label: "Loading the list",
    weight: 2,
    run: async (report, context) => {
      const file = await readModels();
      const views = file.items.map((e) => e.views[0]).filter((v): v is ModelView => !!v);
      let done = 0;
      await Promise.all(
        views.map((view) =>
          imageItem(libUrl(view.poster.t), "Loading the list")
            .run(() => undefined, context)
            .then(() => {
              done += 1;
              report(done / views.length);
            }),
        ),
      );
    },
  };
}

/** The model the room opens on, whole in memory and saved in the browser. The bar moves with the real bytes. */
function firstViewItem(): PreloadItem {
  return {
    id: "models:first",
    label: "Loading the 3D model",
    weight: 8,
    memo: false,
    run: async (report) => {
      const file = await readModels();
      const view = flatViews(file.items)[await startView(file)];
      if (!view) return;
      await loadViewFile(view, {
        onProgress: (fraction, bytes) => {
          report(fraction, bytes);
        },
      });
    },
  };
}

/** How many views after the first can have an item of their own (the room has 29). */
const BACKGROUND_SLOTS = 36;

/** The view after the first that is nearest to it in the list, number `k` from 1. */
async function backgroundView(k: number): Promise<ModelView | null> {
  const file = await readModels();
  const views = flatViews(file.items);
  const order = fetchOrder(views.length, await startView(file));
  const at = order[k];
  return at === undefined ? null : (views[at] ?? null);
}

/**
 * One of the other views. The visitor must ask for these (a press in the list), so the bar does not
 * wait: each downloads in the background once the room is open, the ones next to the view on show
 * first, a few at a time. Each is an item of its own so that leaving the room drops the ones that
 * have not started (`cancelDeferred`). A view that is pressed before its file has come loads it
 * behind the stage's own percentage.
 */
function backgroundItem(k: number): PreloadItem {
  return {
    id: `models:more:${k}`,
    label: "Loading the other models",
    weight: 1,
    memo: false,
    deferred: true,
    priority: 40 + k,
    group: MODELS_GROUP,
    run: async () => {
      const view = await backgroundView(k);
      if (view) await loadViewFile(view, { background: true });
    },
  };
}

/**
 * What the 3D Models room needs on first paint: its data, its code, the stage's code (three), the
 * pictures of the list and the model it opens on. The other views are deferred, one item each.
 */
export function items(): PreloadItem[] {
  return [
    libraryDataItem("models", "Reading the 3D models"),
    chunkItem("library-models", "Opening the models", () => import("./page"), 2),
    chunkItem("library-models-stage", "Loading the 3D viewer", () => import("./stage"), 3),
    thumbsItem(),
    firstViewItem(),
    ...Array.from({ length: BACKGROUND_SLOTS }, (_, i) => backgroundItem(i + 1)),
  ];
}
