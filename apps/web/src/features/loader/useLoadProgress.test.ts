import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useLoadProgress } from "./useLoadProgress";

const original = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "decode");

afterEach(() => {
  if (original) Object.defineProperty(HTMLImageElement.prototype, "decode", original);
  else Reflect.deleteProperty(HTMLImageElement.prototype, "decode");
});

describe("useLoadProgress", () => {
  it("completes at the hard timeout when an image never decodes", async () => {
    Object.defineProperty(HTMLImageElement.prototype, "decode", {
      configurable: true,
      value: () => new Promise<void>(() => undefined),
    });
    const seen: number[] = [];
    const started = performance.now();
    const { result } = renderHook(() =>
      useLoadProgress({
        preload: ["/img/stalled.webp"],
        onProgress: (p) => seen.push(p),
        minDurationMs: 50,
        hardTimeoutMs: 400,
      }),
    );
    await waitFor(() => expect(result.current.complete).toBe(true), { timeout: 3000 });
    expect(performance.now() - started).toBeGreaterThanOrEqual(400);
    expect(seen.at(-1)).toBe(1);
    expect(seen.every((p, i) => i === 0 || p >= (seen[i - 1] ?? 0))).toBe(true);
  });

  it("completes after the minimum duration when everything loads", async () => {
    Object.defineProperty(HTMLImageElement.prototype, "decode", {
      configurable: true,
      value: () => Promise.resolve(),
    });
    const { result } = renderHook(() =>
      useLoadProgress({
        preload: ["/img/a.webp", "/img/b.webp"],
        onProgress: () => undefined,
        minDurationMs: 120,
        hardTimeoutMs: 5000,
      }),
    );
    expect(result.current.complete).toBe(false);
    await waitFor(() => expect(result.current.complete).toBe(true), { timeout: 3000 });
    expect(result.current.fontsReady).toBe(true);
  });
});
