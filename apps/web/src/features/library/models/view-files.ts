import { libUrl } from "@/lib/library";
import { loadMedia, promoteMedia, releaseMedia, type ByteCount } from "@/lib/media-store";

import { fractionOf } from "./logic";
import type { ModelView } from "./types";

/**
 * The model file of each view, ready for the stage: the GLB's bytes. Nothing here needs WebGL or
 * three, so the loading list can fetch a file before the stage opens.
 *
 * Every file goes through the site's media store (`lib/media-store.ts`): downloaded whole, the bytes
 * counted for the loading bar, a drop or a stall carried on from the bytes in hand, and saved in the
 * browser, so the next visit does not download it again.
 */

/** What the stage knows about a view's download. */
interface FileState {
  /** 0 to 1. Never 1 until the file is in. */
  fraction: number;
  ready: boolean;
}

interface Entry {
  promise: Promise<ArrayBuffer>;
  state: FileState;
  bytes: ByteCount;
  listeners: Set<(state: FileState, bytes: ByteCount) => void>;
}

const entries = new Map<string, Entry>();

/** The group of the room's background downloads, so leaving the room drops the ones still waiting. */
export const MODELS_GROUP = "library-models";
/** Counts the times the room was left. A download that ends after that frees what it got. */
let generation = 0;
/** Every model file of the room is under this key. */
const FILES_PREFIX = "models/";

function start(view: ModelView, background: boolean): Entry {
  const born = generation;
  const total = view.bytes;
  const entry: Entry = {
    promise: Promise.resolve(new ArrayBuffer(0)),
    state: { fraction: 0, ready: false },
    bytes: { received: 0, total },
    listeners: new Set(),
  };
  const tell = (received: number) => {
    entry.state = { fraction: fractionOf(received, total), ready: entry.state.ready };
    entry.bytes = { received: Math.min(received, total), total };
    entry.listeners.forEach((l) => {
      l(entry.state, entry.bytes);
    });
  };
  entry.promise = (async (): Promise<ArrayBuffer> => {
    const url = await loadMedia(libUrl(view.file), {
      type: "model/gltf-binary",
      ...(total > 0 ? { expectedBytes: total } : {}),
      background,
      onFraction: (fraction, bytes) => {
        tell(bytes?.received ?? fraction * total);
      },
    });
    // The visitor left the room while this came in: nobody wants it, so it is let go at once.
    if (born !== generation) {
      releaseMedia(libUrl(view.file));
      throw new Error("The room was left");
    }
    // A file the server says is gone comes back as its plain address.
    if (!url.startsWith("blob:")) throw new Error(`The model file is missing: ${url}`);
    const buffer = await (await fetch(url)).arrayBuffer();
    entry.state = { fraction: 1, ready: true };
    entry.bytes = { received: total, total };
    entry.listeners.forEach((l) => {
      l(entry.state, entry.bytes);
    });
    return buffer;
  })();
  entry.promise.catch(() => {
    // A try that failed is forgotten, so the next ask starts again.
    if (entries.get(view.id) === entry) entries.delete(view.id);
  });
  return entry;
}

interface LoadOptions {
  /** Not needed yet: behind everything the visitor is waiting for. */
  background?: boolean;
  /** Told as bytes arrive, and once at the start with what is in already. */
  onProgress?: (fraction: number, bytes: ByteCount) => void;
}

/**
 * Fetch (once) the file of a view. A second ask shares the download; an ask that is not
 * `background` makes a download that was waiting in the background urgent.
 */
export function loadViewFile(view: ModelView, options: LoadOptions = {}): Promise<ArrayBuffer> {
  let entry = entries.get(view.id);
  if (!entry) {
    entry = start(view, options.background === true);
    entries.set(view.id, entry);
  } else if (!options.background && !entry.state.ready) {
    promoteMedia(libUrl(view.file));
  }
  const { onProgress } = options;
  if (onProgress) {
    const listener = (state: FileState, bytes: ByteCount) => {
      onProgress(state.fraction, bytes);
    };
    entry.listeners.add(listener);
    listener(entry.state, entry.bytes);
    const live = entry;
    void entry.promise.then(
      () => live.listeners.delete(listener),
      () => live.listeners.delete(listener),
    );
  }
  return entry.promise;
}

/** Free every view's file from memory (the visitor left the room). A saved copy stays in the browser. */
export function releaseViewFiles(): void {
  generation += 1;
  entries.clear();
  releaseMedia(libUrl(FILES_PREFIX));
}
