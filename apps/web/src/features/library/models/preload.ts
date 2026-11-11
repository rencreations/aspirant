import { NAVIGATED_EVENT } from "@/lib/hooks";
import { libUrl } from "@/lib/library";
import { chunkItem, imageItem, type PreloadItem } from "@/lib/preload";

import { fetchLibraryJson, libraryDataItem, libraryDataPath } from "../data";
import { fetchOrder, indexOfId } from "./logic";
import { loadBundle, MODELS_GROUP } from "./model-bundle";
import type { ModelItem, ModelsFile } from "./types";

const ROUTE = "/collection/models";

function readModels(): Promise<ModelsFile> {
  return fetchLibraryJson<ModelsFile>(libraryDataPath("models"));
}

function onRoom(): boolean {
  return window.location.pathname.replace(/\/+$/u, "").endsWith(ROUTE);
}

/**
 * The query the room opens with (`?i=<id>`). On a first visit the address is already the room's.
 * On a page change the loading list starts before the address changes, so this waits for the
 * change itself (the transition tells when it has happened), never for a time.
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

/** The index of the model the room opens on: the one `?i=` names, else the first. */
async function startIndex(file: ModelsFile): Promise<number> {
  const id = new URLSearchParams(await roomQuery()).get("i") ?? "";
  return indexOfId(file.items, id);
}

/** The nine small pictures of the picker, decoded into the browser cache. */
function platesItem(): PreloadItem {
  return {
    id: "models:plates",
    label: "Loading the previews",
    weight: 2,
    run: async (report, context) => {
      const file = await readModels();
      let done = 0;
      await Promise.all(
        file.items.map((model) =>
          imageItem(libUrl(model.img.t), "Loading the previews")
            .run(() => undefined, context)
            .then(() => {
              done += 1;
              report(done / file.items.length);
            }),
        ),
      );
    },
  };
}

/**
 * The model the room opens on: its file, its textures and (for Fanny and Layla) the nine sheets
 * of the robot's face, whole in memory and saved in the browser. The bar moves with the real bytes.
 */
function firstModelItem(): PreloadItem {
  return {
    id: "models:first",
    label: "Loading the 3D model",
    weight: 6,
    memo: false,
    run: async (report) => {
      const file = await readModels();
      const model = file.items[await startIndex(file)];
      if (!model) return;
      await loadBundle(model, {
        onProgress: (fraction, bytes) => {
          report(fraction, bytes);
        },
      });
    },
  };
}

/** How many models after the first can have an item of their own (the room has nine, so eight are used). */
const BACKGROUND_SLOTS = 12;

/**
 * The model after the first that is nearest to it in the picker, number `k` from 1 (the ones next
 * to the model on show first). Null when the room has fewer models.
 */
async function backgroundModel(k: number): Promise<ModelItem | null> {
  const file = await readModels();
  const order = fetchOrder(file.items.length, await startIndex(file));
  const at = order[k];
  return at === undefined ? null : (file.items[at] ?? null);
}

/**
 * One of the other models. The visitor must ask for these (a press on a plate), so the bar does not
 * wait: each downloads in the background once the room is open, the ones next to the model on
 * show first, a few at a time. Each is an item of its own so that leaving the room drops the
 * ones that have not started (`cancelDeferred`). A plate that is pressed before its model has come
 * loads it behind the stage's own percentage.
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
      const model = await backgroundModel(k);
      if (model) await loadBundle(model, { background: true });
    },
  };
}

/**
 * What the 3D Models room needs on first paint: its data, its code, the viewer's code (three), the
 * nine previews of the picker and the first model. The other models are deferred, one item each.
 */
export function items(): PreloadItem[] {
  return [
    libraryDataItem("models", "Reading the 3D models"),
    chunkItem("library-models", "Opening the models", () => import("./page"), 2),
    chunkItem("library-models-engine", "Loading the 3D viewer", () => import("./engine"), 3),
    platesItem(),
    firstModelItem(),
    ...Array.from({ length: BACKGROUND_SLOTS }, (_, i) => backgroundItem(i + 1)),
  ];
}
