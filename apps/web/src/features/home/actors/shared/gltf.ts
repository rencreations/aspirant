/**
 * The one way the home loads a model. The bytes come through the media store (a saved copy in the
 * browser, a real progress for the loading list) and are parsed once: a second ask for the same
 * path gets the same promise. The models of the home are meshopt packed (`scripts/home/models/`),
 * so the decoder is set here, and it is a lazy import of this module's chunk, never of a page.
 */
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

import { loadMedia } from "@/lib/media-store";

const MODEL_TYPE = "model/gltf-binary";

const parsed = new Map<string, Promise<GLTF>>();

/** Parse a GLB that the loading list may already have fetched. Clones are the caller's business. */
export function loadGltf(path: string): Promise<GLTF> {
  const known = parsed.get(path);
  if (known) return known;
  const made = (async () => {
    const url = await loadMedia(path, { type: MODEL_TYPE });
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    return loader.loadAsync(url);
  })();
  // A failed load must not be remembered: the next ask tries again.
  made.catch(() => parsed.delete(path));
  parsed.set(path, made);
  return made;
}

/** Forget a parsed model (an actor that disposes its own copy of the scene). */
export function forgetGltf(path: string): void {
  parsed.delete(path);
}
