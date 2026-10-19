import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

/** A Cache Storage that keeps its answers in a map, like the browser's. */
function fakeCaches(old: string[] = []) {
  const store = new Map<string, Response>();
  const names = new Set(old);
  const cache = {
    match: (url: string) => Promise.resolve(store.get(url)?.clone()),
    put: (url: string, res: Response) => {
      store.set(url, res);
      return Promise.resolve();
    },
    delete: (url: string) => Promise.resolve(store.delete(url)),
  };
  const api = {
    keys: () => Promise.resolve([...names]),
    delete: (name: string) => Promise.resolve(names.delete(name)),
    open: () => Promise.resolve(cache as unknown as Cache),
  };
  return { store, names, api };
}

const bytes = (n: number) => new Uint8Array(n).fill(7);

function respond(n: number) {
  return new Response(bytes(n), {
    headers: { "content-type": "video/mp4", "content-length": String(n) },
  });
}

let fetchMock: Mock<() => Promise<Response>>;

beforeEach(() => {
  vi.resetModules();
  fetchMock = vi.fn(() => Promise.resolve(respond(100)));
  vi.stubGlobal("fetch", fetchMock);
  URL.createObjectURL = vi.fn(() => "blob:test");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("saved copies", () => {
  it("fetches a file once, saves it, and reads the saved copy the next time", async () => {
    const fake = fakeCaches();
    vi.stubGlobal("caches", fake.api);
    const { loadMedia, releaseMedia } = await import("./media-store");
    const url = await loadMedia("/video/a.mp4", { type: "video/mp4", expectedBytes: 100 });
    expect(url).toBe("blob:test");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fake.store.has("/video/a.mp4")).toBe(true);

    // The page is left and memory is freed. Coming back reads what was saved.
    releaseMedia("/video/");
    await loadMedia("/video/a.mp4", { type: "video/mp4", expectedBytes: 100 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports the bytes while it downloads and full at once for a saved copy", async () => {
    const fake = fakeCaches();
    vi.stubGlobal("caches", fake.api);
    const { loadMedia, releaseMedia } = await import("./media-store");
    const first: number[] = [];
    await loadMedia("/video/b.mp4", { expectedBytes: 100, onFraction: (f) => first.push(f) });
    expect(first.length).toBeGreaterThan(0);
    expect(Math.max(...first)).toBeLessThan(1);
    releaseMedia("/video/");
    const second: number[] = [];
    await loadMedia("/video/b.mp4", { expectedBytes: 100, onFraction: (f) => second.push(f) });
    expect(second).toEqual([1]);
  });

  it("throws away a saved copy of the wrong size and fetches the file again", async () => {
    const fake = fakeCaches();
    vi.stubGlobal("caches", fake.api);
    fake.store.set("/video/c.mp4", respond(40));
    const { loadMedia } = await import("./media-store");
    await loadMedia("/video/c.mp4", { type: "video/mp4", expectedBytes: 100 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fake.store.get("/video/c.mp4")?.headers.get("content-length")).toBe("100");
  });

  it("does not save a download whose size is not the expected one", async () => {
    const fake = fakeCaches();
    vi.stubGlobal("caches", fake.api);
    fetchMock.mockImplementation(() => Promise.resolve(respond(60)));
    const { loadMedia } = await import("./media-store");
    await loadMedia("/video/d.mp4", { type: "video/mp4", expectedBytes: 100 });
    expect(fake.store.has("/video/d.mp4")).toBe(false);
  });

  it("removes the saved copies of older versions", async () => {
    const fake = fakeCaches(["aspirants-media-v0", "other-site-cache"]);
    vi.stubGlobal("caches", fake.api);
    const { loadMedia } = await import("./media-store");
    await loadMedia("/video/e.mp4", { type: "video/mp4" });
    expect(fake.names.has("aspirants-media-v0")).toBe(false);
    expect(fake.names.has("other-site-cache")).toBe(true);
  });

  it("still works from memory when the browser has no Cache Storage", async () => {
    vi.stubGlobal("caches", undefined);
    const { loadMedia, mediaUrl } = await import("./media-store");
    const url = await loadMedia("/video/f.mp4", { type: "video/mp4" });
    expect(url).toBe("blob:test");
    expect(mediaUrl("/video/f.mp4")).toBe("blob:test");
    expect(mediaUrl("/video/never-loaded.mp4")).toBe("/video/never-loaded.mp4");
  });

  it("gives the plain address when the download fails", async () => {
    vi.stubGlobal("caches", undefined);
    fetchMock.mockRejectedValue(new Error("offline"));
    const { loadMedia } = await import("./media-store");
    expect(await loadMedia("/video/g.mp4")).toBe("/video/g.mp4");
  });
});

describe("cachedFetch", () => {
  it("saves what it fetches and answers from the saved copy", async () => {
    const fake = fakeCaches();
    vi.stubGlobal("caches", fake.api);
    const { cachedFetch } = await import("./media-store");
    const a = await cachedFetch("/data/x.json");
    expect((await a.arrayBuffer()).byteLength).toBe(100);
    expect(fake.store.has("/data/x.json")).toBe(true);
    const b = await cachedFetch("/data/x.json");
    expect((await b.arrayBuffer()).byteLength).toBe(100);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not save a failed answer", async () => {
    const fake = fakeCaches();
    vi.stubGlobal("caches", fake.api);
    fetchMock.mockImplementation(() => Promise.resolve(new Response("no", { status: 404 })));
    const { cachedFetch } = await import("./media-store");
    const res = await cachedFetch("/data/missing.json");
    expect(res.status).toBe(404);
    expect(fake.store.has("/data/missing.json")).toBe(false);
  });
});
