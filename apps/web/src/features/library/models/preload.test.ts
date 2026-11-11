import { beforeEach, describe, expect, it, vi } from "vitest";

const loadBundle = vi.fn((_item: unknown, _options?: unknown) => Promise.resolve({}));

vi.mock("./model-bundle", () => ({
  MODELS_GROUP: "library-models",
  loadBundle: (item: unknown, options?: unknown) => loadBundle(item, options),
}));

const file = {
  v: 1,
  slug: "models",
  items: ["a", "b", "c", "d"].map((id) => ({ id: `models-${id}`, img: { t: `${id}.webp` } })),
};

vi.mock("../data", () => ({
  fetchLibraryJson: () => Promise.resolve(file),
  libraryDataPath: (name: string) => `/data/library/${name}.json`,
  libraryDataItem: (name: string) => ({
    id: `data:${name}`,
    label: name,
    run: () => Promise.resolve(),
  }),
}));

import { items } from "./preload";

beforeEach(() => {
  loadBundle.mockClear();
  window.history.replaceState(null, "", "/collection/models/?i=models-c");
});

describe("the loading list of the 3D Models room", () => {
  it("waits for the data, the code, the previews and the first model, and nothing else", () => {
    const waited = items().filter((i) => !i.deferred);
    expect(waited.map((i) => i.id)).toEqual([
      "data:models",
      "chunk:library-models",
      "chunk:library-models-engine",
      "models:plates",
      "models:first",
    ]);
  });

  it("gives each other model an item of its own, in a group the room can drop, nearest first", () => {
    const later = items().filter((i) => i.deferred);
    expect(later.length).toBeGreaterThanOrEqual(8);
    expect(new Set(later.map((i) => i.id)).size).toBe(later.length);
    expect(later.every((i) => i.group === "library-models" && i.memo === false)).toBe(true);
    const priorities = later.map((i) => i.priority ?? 0);
    expect([...priorities].sort((a, b) => a - b)).toEqual(priorities);
    expect(new Set(priorities).size).toBe(priorities.length);
  });

  it("item k loads the k-th nearest model to the one the address names, and slots past the last do nothing", async () => {
    const later = items().filter((i) => i.deferred);
    const noop = () => undefined;
    // The address names c (index 2). Nearest first: c, then d and b, then a.
    for (const item of later) await item.run(noop, { background: true });
    const asked = loadBundle.mock.calls.map(([model]) => (model as { id: string }).id);
    expect(asked).toEqual(["models-d", "models-b", "models-a"]);
    for (const [, options] of loadBundle.mock.calls) {
      expect((options as { background: boolean }).background).toBe(true);
    }
  });
});
