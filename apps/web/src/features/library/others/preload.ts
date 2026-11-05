import { chunkItem, type PreloadItem } from "@/lib/preload";

import { fetchLibraryJson, libraryDataItem, libraryDataPath } from "../data";
import { loadBundle } from "./model-bundle";
import type { ModelItem, OthersFile } from "./types";

/** The model the page opens on: the one named by `?i=`, else the first. */
async function modelsOf(): Promise<ModelItem[]> {
  const file = await fetchLibraryJson<OthersFile>(libraryDataPath("others"));
  return file.items.filter((i): i is ModelItem => i.kind === "model");
}

function pickFirst(models: ModelItem[]): ModelItem | undefined {
  const wanted = new URLSearchParams(window.location.search).get("i");
  return models.find((m) => m.id === wanted) ?? models[0];
}

/**
 * What the others room needs on first paint: its data, its code, the viewer's code and the first
 * model (the .obj and its textures, about 4.4 MB). The other eight models are not shown until the
 * visitor picks one: the stage loads it then and says so (it is not in the loading bar, and it is
 * not downloaded in the background, since together they are about 60 MB). Posters, clips and
 * pictures further down load lazily.
 */
export function items(): PreloadItem[] {
  return [
    libraryDataItem("others"),
    chunkItem("library-others", "Opening the others room", () => import("./page"), 2),
    chunkItem("library-others-engine", "Loading the 3D viewer", () => import("./engine"), 3),
    {
      id: "others:model-first",
      label: "Loading the 3D model",
      weight: 5,
      run: async (report) => {
        const first = pickFirst(await modelsOf());
        if (first) await loadBundle(first, report);
      },
    },
  ];
}
