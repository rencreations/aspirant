import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { QUIET_MAX_MS, QUIET_MS, gpuDrained, isQuiet, whenQuiet } from "./quiet";

describe("isQuiet", () => {
  it("is quiet once the last input is old enough", () => {
    expect(isQuiet(1000, 1000 - QUIET_MS)).toBe(true);
    expect(isQuiet(1000, 1000 - QUIET_MS + 1)).toBe(false);
    expect(isQuiet(5, -1e9)).toBe(true);
  });
});

describe("whenQuiet", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(performance.now());
      return 1;
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("resolves at once when nothing has moved", async () => {
    const done = vi.fn();
    void whenQuiet().then(done);
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toHaveBeenCalled();
  });

  it("waits while the visitor keeps scrolling and gives up after the longest wait", async () => {
    const done = vi.fn();
    window.dispatchEvent(new Event("wheel"));
    void whenQuiet(500).then(done);
    await vi.advanceTimersByTimeAsync(200);
    expect(done).not.toHaveBeenCalled();
    window.dispatchEvent(new Event("wheel"));
    await vi.advanceTimersByTimeAsync(400);
    expect(done).toHaveBeenCalled();
  });

  it("keeps its longest wait below a few seconds", () => {
    expect(QUIET_MAX_MS).toBeLessThan(3000);
  });
});

describe("gpuDrained", () => {
  it("resolves at once with no fence to wait for", async () => {
    const gl = {
      SYNC_GPU_COMMANDS_COMPLETE: 1,
      fenceSync: () => null,
      flush: () => undefined,
    } as unknown as WebGL2RenderingContext;
    await expect(gpuDrained(gl)).resolves.toBeUndefined();
  });

  it("resolves when the fence is signalled", async () => {
    let polls = 0;
    const sync = {} as WebGLSync;
    const gl = {
      SYNC_GPU_COMMANDS_COMPLETE: 1,
      SYNC_STATUS: 2,
      SIGNALED: 3,
      UNSIGNALED: 4,
      fenceSync: () => sync,
      flush: () => undefined,
      isContextLost: () => false,
      getSyncParameter: () => (++polls >= 3 ? 3 : 4),
      deleteSync: () => undefined,
    } as unknown as WebGL2RenderingContext;
    await gpuDrained(gl);
    expect(polls).toBe(3);
  });

  it("gives up when the context is lost", async () => {
    const gl = {
      SYNC_GPU_COMMANDS_COMPLETE: 1,
      fenceSync: () => ({}),
      flush: () => undefined,
      isContextLost: () => true,
    } as unknown as WebGL2RenderingContext;
    await expect(gpuDrained(gl)).resolves.toBeUndefined();
  });
});
