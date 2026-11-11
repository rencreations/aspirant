import { libUrl } from "@/lib/library";
import { loadMedia, promoteMedia, releaseMedia, type ByteCount } from "@/lib/media-store";

import { fractionOf } from "./logic";
import type { ModelItem } from "./types";

/**
 * The files of one model, ready for the viewer: the .obj text (or the .fbx bytes), the address of
 * each texture picture and of each expression sheet of the robot's face. Nothing here needs WebGL
 * or three, so the loading list can fetch it before the viewer opens.
 *
 * Every file goes through the site's media store (`lib/media-store.ts`): downloaded whole, the
 * bytes counted for the loading bar, a drop or a stall carried on from the bytes in hand, and saved
 * in the browser, so the next visit does not download it again. A texture or a sheet is an object
 * address that the viewer decodes itself.
 */
export interface ModelBundle {
  /** The .obj text (format "obj"). */
  obj?: string;
  /** The .fbx bytes (format "fbx"). */
  fbx?: ArrayBuffer;
  /** Material name to the address of its texture picture. */
  maps: Map<string, string>;
  /** The address of each expression sheet of the robot's face, in the order of `model.faces`. */
  faces: string[];
}

/** What the picker and the stage know about a model's download. */
export interface BundleState {
  /** 0 to 1. Never 1 until every file is in. */
  fraction: number;
  ready: boolean;
}

interface Entry {
  promise: Promise<ModelBundle>;
  state: BundleState;
  bytes: ByteCount;
  listeners: Set<(state: BundleState, bytes: ByteCount) => void>;
}

const entries = new Map<string, Entry>();
/** Counts the times the room was left. A download that ends after that frees what it got. */
let generation = 0;
const watchers = new Set<() => void>();
let version = 0;
let lastBump = 0;

/** The group of the room's background downloads, so leaving the room drops the ones still waiting. */
export const MODELS_GROUP = "library-models";

/** Everything a model's files are saved under (the bucket keeps the files where they always were). */
const FILES_PREFIX = "others/3d/";

const IDLE: BundleState = { fraction: 0, ready: false };

function bump(force: boolean): void {
  const now = performance.now();
  if (!force && now - lastBump < 100) return;
  lastBump = now;
  version += 1;
  watchers.forEach((w) => {
    w();
  });
}

/** For `useSyncExternalStore`: the picker redraws as downloads move (at most ten times a second). */
export function subscribeBundles(onChange: () => void): () => void {
  watchers.add(onChange);
  return () => {
    watchers.delete(onChange);
  };
}

export function bundlesVersion(): number {
  return version;
}

/** The download state of one model: idle until something asks for it. */
export function bundleState(id: string): BundleState {
  return entries.get(id)?.state ?? IDLE;
}

const typeOf = (name: string) => (name.endsWith(".png") ? "image/png" : "application/octet-stream");

const keyOf = (item: ModelItem, name: string) => `${item.model.dir}/${name}`;

/** The files that make up a bundle, once each: the model, the textures, the face sheets. */
function filesOf(item: ModelItem): string[] {
  return Array.from(
    new Set([item.model.obj, ...Object.values(item.model.maps), ...item.model.faces]),
  );
}

function totalOf(item: ModelItem, files: readonly string[]): number {
  const sum = files.reduce((n, f) => n + (item.model.sizes[f] ?? 0), 0);
  return sum > 0 ? sum : item.model.bytes + item.model.texBytes;
}

function start(item: ModelItem, background: boolean): Entry {
  const born = generation;
  const files = filesOf(item);
  const total = totalOf(item, files);
  const got = new Map<string, number>();
  const entry: Entry = {
    promise: Promise.resolve({ maps: new Map(), faces: [] }),
    state: { fraction: 0, ready: false },
    bytes: { received: 0, total },
    listeners: new Set(),
  };
  const tell = (force = false) => {
    let received = 0;
    got.forEach((n) => {
      received += n;
    });
    entry.state = { fraction: fractionOf(received, total), ready: entry.state.ready };
    entry.bytes = { received: Math.min(received, total), total };
    entry.listeners.forEach((l) => {
      l(entry.state, entry.bytes);
    });
    bump(force);
  };
  entry.promise = (async (): Promise<ModelBundle> => {
    const urls = await Promise.all(
      files.map((name) =>
        loadMedia(libUrl(keyOf(item, name)), {
          type: typeOf(name),
          ...(item.model.sizes[name] ? { expectedBytes: item.model.sizes[name] } : {}),
          background,
          onFraction: (fraction, bytes) => {
            got.set(name, bytes?.received ?? fraction * (item.model.sizes[name] ?? 0));
            tell();
          },
        }),
      ),
    );
    // The visitor left the room while this came in: nobody wants it, so it is let go at once.
    if (born !== generation) {
      files.forEach((name) => {
        releaseMedia(libUrl(keyOf(item, name)));
      });
      throw new Error("The room was left");
    }
    const byName = new Map(files.map((f, i) => [f, urls[i] ?? ""]));
    const mainUrl = byName.get(item.model.obj) ?? "";
    // A file the server says is gone comes back as its plain address. The model itself must be
    // there; a missing texture only leaves a plain grey on that part.
    if (!mainUrl.startsWith("blob:")) throw new Error(`The model file is missing: ${mainUrl}`);
    const main = await fetch(mainUrl);
    const maps = new Map<string, string>();
    for (const [material, file] of Object.entries(item.model.maps)) {
      const url = byName.get(file);
      if (url?.startsWith("blob:")) maps.set(material, url);
    }
    const faces = item.model.faces.map((f) => byName.get(f) ?? "");
    const bundle: ModelBundle =
      item.model.format === "fbx"
        ? { fbx: await main.arrayBuffer(), maps, faces }
        : { obj: await main.text(), maps, faces };
    entry.state = { fraction: 1, ready: true };
    entry.bytes = { received: total, total };
    entry.listeners.forEach((l) => {
      l(entry.state, entry.bytes);
    });
    bump(true);
    return bundle;
  })();
  entry.promise.catch(() => {
    // A try that failed is forgotten, so the next ask starts again.
    if (entries.get(item.id) === entry) entries.delete(item.id);
    bump(true);
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
 * Fetch (once) the files of a model. A second ask shares the download; an ask that is not
 * `background` makes a download that was waiting in the background urgent.
 */
export function loadBundle(item: ModelItem, options: LoadOptions = {}): Promise<ModelBundle> {
  let entry = entries.get(item.id);
  if (!entry) {
    entry = start(item, options.background === true);
    entries.set(item.id, entry);
    bump(true);
  } else if (!options.background && !entry.state.ready) {
    filesOf(item).forEach((name) => {
      promoteMedia(libUrl(keyOf(item, name)));
    });
  }
  const { onProgress } = options;
  if (onProgress) {
    const listener = (state: BundleState, bytes: ByteCount) => {
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

/** Free every model's files from memory (the visitor left the room). A saved copy stays in the browser. */
export function releaseModels(): void {
  generation += 1;
  entries.clear();
  releaseMedia(libUrl(FILES_PREFIX));
  bump(true);
}
