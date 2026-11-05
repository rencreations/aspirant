import { libUrl } from "@/lib/library";
import { fetchWhole } from "@/lib/media-store";
import { untilItArrives } from "@/lib/retry";

import type { ModelItem } from "./types";

/**
 * The bytes of one model: the .obj text and the texture of each material. Nothing here needs
 * WebGL or three, so the loading list can fetch it before the viewer opens. The viewer turns the
 * bytes into geometry and textures, so each file is fetched once (through `fetch`, a CORS request,
 * the way WebGL needs it).
 */
export interface ModelBundle {
  /** The .obj text (format "obj"). */
  obj?: string;
  /** The .fbx bytes (format "fbx"). */
  fbx?: ArrayBuffer;
  /** Material name to the texture picture. */
  maps: Map<string, Blob>;
}

const bundles = new Map<string, Promise<ModelBundle>>();
const faceSheets = new Map<string, Promise<Blob>>();

const dirKey = (item: ModelItem, file: string) => `${item.model.dir}/${file}`;

async function fetchKey(key: string, onBytes?: (received: number) => void): Promise<Blob> {
  const { blob } = await untilItArrives(() =>
    fetchWhole(libUrl(key), {
      onBytes: (received) => {
        onBytes?.(received);
      },
    }),
  );
  return blob;
}

/** Fetch (once) the .obj and the textures of a model. `report` gets 0 to 1 as bytes arrive. */
export function loadBundle(
  item: ModelItem,
  report?: (fraction: number) => void,
): Promise<ModelBundle> {
  const cached = bundles.get(item.id);
  if (cached) {
    void cached.then(() => report?.(1));
    return cached;
  }
  const total = item.model.bytes + item.model.texBytes;
  const got = new Map<string, number>();
  const tick = (name: string) => (received: number) => {
    got.set(name, received);
    let sum = 0;
    got.forEach((n) => {
      sum += n;
    });
    report?.(Math.min(0.98, sum / total));
  };
  const promise = (async (): Promise<ModelBundle> => {
    const files = Array.from(new Set(Object.values(item.model.maps)));
    const [objBlob, ...texBlobs] = await Promise.all([
      fetchKey(dirKey(item, item.model.obj), tick(item.model.obj)),
      ...files.map((f) => fetchKey(dirKey(item, f), tick(f))),
    ]);
    const byFile = new Map(files.map((f, i) => [f, texBlobs[i]!]));
    const maps = new Map<string, Blob>();
    for (const [material, file] of Object.entries(item.model.maps)) {
      const blob = byFile.get(file);
      if (blob) maps.set(material, blob);
    }
    return item.model.format === "fbx"
      ? { fbx: await objBlob.arrayBuffer(), maps }
      : { obj: await objBlob.text(), maps };
  })();
  promise.catch(() => bundles.delete(item.id));
  bundles.set(item.id, promise);
  return promise;
}

/** Fetch (once) one of the eight other expression sheets of the robot's face. */
export function loadFaceSheet(item: ModelItem, index: number): Promise<Blob> {
  const file = item.model.faces[index];
  if (!file) return Promise.reject(new Error(`No face sheet ${index}`));
  const key = dirKey(item, file);
  let p = faceSheets.get(key);
  if (!p) {
    p = fetchKey(key);
    p.catch(() => faceSheets.delete(key));
    faceSheets.set(key, p);
  }
  return p;
}
