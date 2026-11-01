import { Blob as NodeBlob } from "node:buffer";

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
  // jsdom's Blob is not one Node 22's Response accepts as a body (a browser's is), so the saved
  // copy would silently fail to be written. Use Node's own.
  vi.stubGlobal("Blob", NodeBlob);
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

  it("gives the plain address only when the file is gone, and asks again next time", async () => {
    vi.stubGlobal("caches", undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    fetchMock.mockImplementationOnce(() => Promise.resolve(new Response("no", { status: 404 })));
    const { loadMedia, mediaUrl } = await import("./media-store");
    expect(await loadMedia("/video/g.mp4")).toBe("/video/g.mp4");
    expect(warn).toHaveBeenCalled();
    expect(mediaUrl("/video/g.mp4")).toBe("/video/g.mp4");
    // It may have come back: the second ask downloads it.
    expect(await loadMedia("/video/g.mp4")).toBe("blob:test");
    warn.mockRestore();
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

describe("downloads for later", () => {
  /** A fetch that stays open until it is let go, one for each file. */
  function slowFetch() {
    const open = new Map<string, () => void>();
    fetchMock.mockImplementation((url?: unknown) => {
      return new Promise<Response>((resolve) => {
        open.set(String(url), () => resolve(respond(100)));
      });
    });
    return open;
  }
  const tick = () => new Promise((r) => setTimeout(r, 0));

  it("take at most two of the four slots, and an urgent one is never stuck behind them", async () => {
    vi.stubGlobal("caches", undefined);
    const open = slowFetch();
    const { loadMedia } = await import("./media-store");
    for (const n of [1, 2, 3, 4]) void loadMedia(`/video/bg${n}.mp4`, { background: true });
    await tick();
    expect(open.size).toBe(2);
    // An urgent download starts at once, although background ones are waiting.
    void loadMedia("/video/now.mp4");
    await tick();
    expect(open.has("/video/now.mp4")).toBe(true);
    expect(open.size).toBe(3);
  });

  it("go first when something asks for them", async () => {
    vi.stubGlobal("caches", undefined);
    const open = slowFetch();
    const { loadMedia, promoteMedia } = await import("./media-store");
    for (const n of [1, 2, 3, 4, 5]) void loadMedia(`/video/p${n}.mp4`, { background: true });
    // Two urgent ones fill the other two slots.
    void loadMedia("/video/u1.mp4");
    void loadMedia("/video/u2.mp4");
    await tick();
    expect(open.size).toBe(4);
    expect(open.has("/video/p5.mp4")).toBe(false);
    // The visitor needs the last one: when a slot frees up it goes before the others.
    promoteMedia("/video/p5.mp4");
    open.get("/video/u1.mp4")?.();
    await tick();
    expect(open.has("/video/p5.mp4")).toBe(true);
    expect(open.has("/video/p3.mp4")).toBe(false);
  });
});

describe("a bad connection", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("tries again when the body is shorter than the server said, and saves only the whole file", async () => {
    const fake = fakeCaches();
    vi.stubGlobal("caches", fake.api);
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(
        new Response(bytes(60), {
          headers: { "content-type": "video/mp4", "content-length": "100" },
        }),
      ),
    );
    const { loadMedia } = await import("./media-store");
    const pending = loadMedia("/video/short.mp4", { type: "video/mp4", expectedBytes: 100 });
    await vi.advanceTimersByTimeAsync(1500);
    expect(await pending).toBe("blob:test");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fake.store.get("/video/short.mp4")?.headers.get("content-length")).toBe("100");
  });

  it("tries again after a dropped connection instead of falling back to the plain address", async () => {
    vi.stubGlobal("caches", fakeCaches().api);
    fetchMock
      .mockImplementationOnce(() => Promise.reject(new TypeError("network error")))
      .mockImplementationOnce(() => Promise.resolve(new Response("busy", { status: 503 })));
    const { loadMedia, mediaUrl } = await import("./media-store");
    const pending = loadMedia("/video/flaky.mp4", { type: "video/mp4", expectedBytes: 100 });
    // Until it arrives, the page that wants it gets the plain address (the browser streams it).
    expect(mediaUrl("/video/flaky.mp4")).toBe("/video/flaky.mp4");
    await vi.advanceTimersByTimeAsync(1000 + 2000 + 50);
    expect(await pending).toBe("blob:test");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(mediaUrl("/video/flaky.mp4")).toBe("blob:test");
  });

  it("carries on from the bytes it has after a drop (a range request), and joins them whole", async () => {
    vi.stubGlobal("caches", fakeCaches().api);
    const calls: Array<Record<string, string> | undefined> = [];
    fetchMock.mockImplementation(((_url: string, init?: { headers?: Record<string, string> }) => {
      calls.push(init?.headers);
      if (calls.length === 1) {
        // Forty bytes arrive, then the connection drops.
        let pulled = 0;
        const body = new ReadableStream<Uint8Array>({
          pull(controller) {
            pulled += 1;
            if (pulled === 1) controller.enqueue(bytes(40));
            else controller.error(new TypeError("network error"));
          },
        });
        return Promise.resolve(
          new Response(body, {
            headers: { "content-length": "100", etag: '"v1"', "content-type": "video/mp4" },
          }),
        );
      }
      return Promise.resolve(
        new Response(bytes(60), {
          status: 206,
          headers: {
            "content-length": "60",
            "content-range": "bytes 40-99/100",
            "content-type": "video/mp4",
          },
        }),
      );
    }) as unknown as () => Promise<Response>);
    const { loadMedia } = await import("./media-store");
    const pending = loadMedia("/video/resume.mp4", { type: "video/mp4", expectedBytes: 100 });
    await vi.advanceTimersByTimeAsync(1500);
    expect(await pending).toBe("blob:test");
    expect(calls).toHaveLength(2);
    expect(calls[1]).toMatchObject({ Range: "bytes=40-", "If-Range": '"v1"' });
    // The blob given to the page is the whole 100 bytes.
    const made = (URL.createObjectURL as unknown as Mock).mock.calls[0]?.[0] as Blob;
    expect(made.size).toBe(100);
  });

  it("starts over when the server answers a range with the whole file", async () => {
    vi.stubGlobal("caches", fakeCaches().api);
    let n = 0;
    fetchMock.mockImplementation(() => {
      n += 1;
      if (n === 1) {
        let pulled = 0;
        const body = new ReadableStream<Uint8Array>({
          pull(controller) {
            pulled += 1;
            if (pulled === 1) controller.enqueue(bytes(40));
            else controller.error(new TypeError("network error"));
          },
        });
        return Promise.resolve(new Response(body, { headers: { "content-length": "100" } }));
      }
      return Promise.resolve(respond(100));
    });
    const { loadMedia } = await import("./media-store");
    const pending = loadMedia("/video/whole.mp4", { type: "video/mp4", expectedBytes: 100 });
    await vi.advanceTimersByTimeAsync(1500);
    expect(await pending).toBe("blob:test");
    const made = (URL.createObjectURL as unknown as Mock).mock.calls[0]?.[0] as Blob;
    expect(made.size).toBe(100);
  });

  it("drops a download that gets no byte for too long, frees its slot and starts it again", async () => {
    vi.stubGlobal("caches", fakeCaches().api);
    // The first answer never produces a byte and obeys the abort signal; the second is fine.
    let calls = 0;
    fetchMock.mockImplementation(((_url: string, init?: { signal?: AbortSignal }) => {
      calls += 1;
      if (calls > 1) return Promise.resolve(respond(100));
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    }) as unknown as () => Promise<Response>);
    const { loadMedia, STALL_MS } = await import("./media-store");
    const pending = loadMedia("/video/stuck.mp4", { type: "video/mp4" });
    await vi.advanceTimersByTimeAsync(STALL_MS + 1500);
    expect(await pending).toBe("blob:test");
    expect(calls).toBe(2);
  });

  it("keeps trying for as long as it takes (there is no give-up)", async () => {
    vi.stubGlobal("caches", fakeCaches().api);
    fetchMock.mockImplementation(() => Promise.reject(new TypeError("network error")));
    const { loadMedia } = await import("./media-store");
    let settled = false;
    void loadMedia("/video/dead.mp4").then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(settled).toBe(false);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(100);
    fetchMock.mockImplementation(() => Promise.resolve(respond(100)));
    await vi.advanceTimersByTimeAsync(11_000);
    expect(settled).toBe(true);
  });

  it("waits for the connection while the device is offline, and goes on when it is back", async () => {
    vi.stubGlobal("caches", fakeCaches().api);
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    fetchMock.mockImplementationOnce(() => Promise.reject(new TypeError("offline")));
    const { loadMedia } = await import("./media-store");
    const pending = loadMedia("/video/off.mp4", { type: "video/mp4" });
    await vi.advanceTimersByTimeAsync(1100);
    // The first try failed; the next waits for the connection and does not hammer the network.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    online.mockReturnValue(true);
    window.dispatchEvent(new Event("online"));
    expect(await pending).toBe("blob:test");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    online.mockRestore();
  });

  it("does not hold a download slot while it waits to try again", async () => {
    vi.stubGlobal("caches", undefined);
    fetchMock.mockImplementationOnce(() => Promise.reject(new TypeError("network error")));
    const { loadMedia } = await import("./media-store");
    const first = loadMedia("/video/waits.mp4");
    // Four more fill the four slots, a fifth is queued behind them: the failed one is not among them.
    await vi.advanceTimersByTimeAsync(10);
    const open = new Map<string, () => void>();
    fetchMock.mockImplementation((url?: unknown) => {
      return new Promise<Response>((resolve) => {
        open.set(String(url), () => resolve(respond(100)));
      });
    });
    for (const n of [1, 2, 3, 4]) void loadMedia(`/video/other${n}.mp4`);
    await vi.advanceTimersByTimeAsync(10);
    expect(open.size).toBe(4);
    for (const release of open.values()) release();
    await vi.advanceTimersByTimeAsync(1500);
    open.get("/video/waits.mp4")?.();
    expect(await first).toBe("blob:test");
  });
});
