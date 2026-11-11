import { beforeEach, describe, expect, it, vi } from "vitest";

const loadMedia = vi.fn();
const promoteMedia = vi.fn();
const releaseMedia = vi.fn();

vi.mock("@/lib/media-store", () => ({
  loadMedia: (url: string, options: unknown) => loadMedia(url, options) as Promise<string>,
  promoteMedia: (url: string) => {
    promoteMedia(url);
  },
  releaseMedia: (prefix: string) => {
    releaseMedia(prefix);
  },
}));

vi.mock("@/lib/library", () => ({ libUrl: (key: string) => `https://lib.test/v1/${key}` }));

import { bundleState, loadBundle, releaseModels } from "./model-bundle";
import type { ModelItem } from "./types";

const item: ModelItem = {
  id: "models-fanny",
  title: "Fanny",
  kind: "model",
  collection: "models",
  chars: ["fanny"],
  pair: "fanny-layla",
  canon: "official",
  tags: [],
  img: { t: "t", p: "p", f: "f", w: 4, h: 3, c: "#000000" },
  model: {
    format: "obj",
    dir: "others/3d/fanny",
    obj: "fanny.obj",
    mtl: "fanny.mtl",
    verts: 1,
    tris: 1,
    bytes: 100,
    texBytes: 50,
    maps: { body: "body.png", face: "body.png", hair: "hair.png" },
    rules: [],
    layers: ["body"],
    faces: ["emote/e1.png"],
    sizes: { "fanny.obj": 100, "body.png": 30, "hair.png": 20, "emote/e1.png": 10 },
    files: 5,
    totalBytes: 160,
  },
};

beforeEach(() => {
  loadMedia.mockReset();
  promoteMedia.mockReset();
  releaseMedia.mockReset();
  releaseModels();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve({ text: () => Promise.resolve("v 0 0 0") })),
  );
});

/** A loadMedia that reports each file's bytes and gives an object address. */
function arrives(sizes: Record<string, number>) {
  loadMedia.mockImplementation(
    (url: string, options: { onFraction?: (f: number, b?: unknown) => void }) => {
      const name = Object.keys(sizes).find((n) => url.endsWith(n)) ?? "";
      const size = sizes[name] ?? 0;
      // The bytes arrive after the ask, as they do for real.
      return Promise.resolve().then(() => {
        options.onFraction?.(0.5, { received: size / 2, total: size });
        options.onFraction?.(1, { received: size, total: size });
        return `blob:${name}`;
      });
    },
  );
}

describe("loadBundle", () => {
  it("fetches each file once, with its exact size, and gives the text and the addresses", async () => {
    arrives(item.model.sizes);
    const bundle = await loadBundle(item);
    expect(loadMedia).toHaveBeenCalledTimes(4);
    const asked = loadMedia.mock.calls.map((call: unknown[]) => [
      call[0],
      (call[1] as { expectedBytes: number }).expectedBytes,
    ]);
    expect(asked).toContainEqual(["https://lib.test/v1/others/3d/fanny/fanny.obj", 100]);
    expect(asked).toContainEqual(["https://lib.test/v1/others/3d/fanny/body.png", 30]);
    expect(bundle.obj).toBe("v 0 0 0");
    expect(bundle.maps.get("face")).toBe("blob:body.png");
    expect(bundle.maps.get("hair")).toBe("blob:hair.png");
    expect(bundle.faces).toEqual(["blob:emote/e1.png"]);
  });

  it("reports the bytes that arrive and is whole only when everything is in", async () => {
    arrives(item.model.sizes);
    const seen: number[] = [];
    const promise = loadBundle(item, { onProgress: (f) => seen.push(f) });
    expect(seen[0]).toBe(0);
    await promise;
    expect(Math.max(...seen.slice(0, -1))).toBeLessThan(1);
    expect(seen.at(-1)).toBe(1);
    expect(bundleState(item.id)).toEqual({ fraction: 1, ready: true });
  });

  it("shares one download, and makes a background one urgent when the stage asks", async () => {
    arrives(item.model.sizes);
    const first = loadBundle(item, { background: true });
    const second = loadBundle(item);
    expect(second).toBe(first);
    expect(loadMedia).toHaveBeenCalledTimes(4);
    expect((loadMedia.mock.calls[0]?.[1] as { background: boolean }).background).toBe(true);
    expect(promoteMedia).toHaveBeenCalledTimes(4);
    await first;
  });

  it("fails when the model file is gone, and a later ask starts again", async () => {
    loadMedia.mockImplementation((url: string) =>
      Promise.resolve(url.endsWith("fanny.obj") ? url : "blob:x"),
    );
    await expect(loadBundle(item)).rejects.toThrow("missing");
    expect(bundleState(item.id).ready).toBe(false);
    arrives(item.model.sizes);
    const again = await loadBundle(item);
    expect(again.obj).toBe("v 0 0 0");
  });

  it("leaves a texture that is gone out, so that part is plain grey", async () => {
    loadMedia.mockImplementation((url: string) =>
      Promise.resolve(url.endsWith("hair.png") ? url : `blob:${url.split("/").pop()}`),
    );
    const bundle = await loadBundle(item);
    expect(bundle.maps.has("hair")).toBe(false);
    expect(bundle.maps.has("body")).toBe(true);
  });
});

describe("releaseModels", () => {
  it("forgets every model and frees what the room kept in memory", async () => {
    arrives(item.model.sizes);
    await loadBundle(item);
    releaseModels();
    expect(bundleState(item.id)).toEqual({ fraction: 0, ready: false });
    expect(releaseMedia).toHaveBeenCalledWith("https://lib.test/v1/others/3d/");
  });

  it("lets go of a download that ends after the room was left", async () => {
    let finish: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    loadMedia.mockImplementation((url: string) => gate.then(() => `blob:${url.split("/").pop()}`));
    const late = loadBundle(item, { background: true });
    const settled = late.then(
      () => "arrived",
      (error: Error) => error.message,
    );
    releaseModels();
    releaseMedia.mockClear();
    finish();
    expect(await settled).toBe("The room was left");
    // Every file it got is freed again, and the model is not kept.
    expect(releaseMedia).toHaveBeenCalledTimes(4);
    expect(releaseMedia).toHaveBeenCalledWith("https://lib.test/v1/others/3d/fanny/fanny.obj");
    expect(bundleState(item.id)).toEqual({ fraction: 0, ready: false });
  });
});
