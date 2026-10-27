import { describe, expect, it, vi } from "vitest";

import {
  RELOAD_KEY,
  RELOAD_WINDOW_MS,
  createRejectionLogger,
  isChunkError,
  mayReload,
} from "./chunk-guard";

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
}

describe("isChunkError", () => {
  it("knows the ways a missing file is reported", () => {
    expect(isChunkError(new Error("Loading chunk 123 failed."))).toBe(true);
    expect(isChunkError("ChunkLoadError: Loading chunk app/page failed")).toBe(true);
    expect(
      isChunkError(new TypeError("Failed to fetch dynamically imported module: /_next/x.js")),
    ).toBe(true);
    expect(isChunkError({ name: "ChunkLoadError", message: "x" })).toBe(true);
    expect(isChunkError("Importing a module script failed.")).toBe(true);
  });

  it("leaves other errors alone", () => {
    expect(isChunkError(new Error("Cannot read properties of undefined"))).toBe(false);
    expect(isChunkError(undefined)).toBe(false);
    expect(isChunkError(42)).toBe(false);
  });
});

describe("mayReload", () => {
  it("allows one reload, writes the time, and refuses another within a minute", () => {
    const store = memory();
    expect(mayReload(store, 1_000_000)).toBe(true);
    expect(store.data.get(RELOAD_KEY)).toBe("1000000");
    expect(mayReload(store, 1_000_000 + RELOAD_WINDOW_MS - 1)).toBe(false);
    expect(mayReload(store, 1_000_000 + RELOAD_WINDOW_MS)).toBe(true);
  });

  it("never reloads without storage, so it cannot loop", () => {
    expect(mayReload(null, 5)).toBe(false);
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => undefined,
    };
    expect(mayReload(broken, 5)).toBe(false);
  });
});

describe("createRejectionLogger", () => {
  it("logs a message once and stops after the limit", () => {
    const log = vi.fn();
    const report = createRejectionLogger(log, 2);
    expect(report(new Error("a"))).toBe(true);
    expect(report(new Error("a"))).toBe(false);
    expect(report(new Error("b"))).toBe(true);
    expect(report(new Error("c"))).toBe(false);
    expect(log).toHaveBeenCalledTimes(2);
  });

  it("ignores cancelled requests and empty reasons", () => {
    const report = createRejectionLogger(vi.fn());
    expect(report(new DOMException("aborted", "AbortError"))).toBe(false);
    expect(report(undefined)).toBe(false);
  });
});
