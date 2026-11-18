import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined }) }));

import { NAVIGATED_EVENT } from "@/lib/hooks";

import { bindHold, holdScroll } from "./hold";
import { pathReached, setExitHook } from "./handoff";

describe("pathReached", () => {
  afterEach(() => {
    window.history.pushState({}, "", "/");
  });

  it("resolves at once when the address is already the target (slashes do not matter)", async () => {
    window.history.pushState({}, "", "/about/");
    await expect(pathReached("/about")).resolves.toBeUndefined();
  });

  it("waits for the address to change, with no timer on the files", async () => {
    let done = false;
    const waiting = pathReached("/about").then(() => {
      done = true;
    });
    await new Promise((r) => setTimeout(r, 40));
    expect(done).toBe(false);
    window.history.pushState({}, "", "/about/");
    window.dispatchEvent(new Event(NAVIGATED_EVENT));
    await waiting;
    expect(done).toBe(true);
  });
});

describe("setExitHook", () => {
  it("returns the way to take the hook out", () => {
    const hook = vi.fn();
    const remove = setExitHook(hook);
    remove();
    remove();
    expect(hook).not.toHaveBeenCalled();
  });
});

describe("holdScroll", () => {
  it("does nothing, and releases nothing, before the shell has bound the lock", () => {
    const release = holdScroll();
    expect(() => release()).not.toThrow();
  });

  it("asks the bound lock for a long hold and gives back its release", () => {
    const release = vi.fn();
    const lock = vi.fn((_limitMs?: number) => release);
    const unbind = bindHold(lock);
    const got = holdScroll();
    expect(lock).toHaveBeenCalledTimes(1);
    expect(lock.mock.calls[0]?.[0]).toBeGreaterThan(10_000);
    got();
    expect(release).toHaveBeenCalledTimes(1);
    unbind();
    expect(holdScroll()).not.toBe(release);
  });

  it("takes a limit from the caller", () => {
    const lock = vi.fn((_limitMs?: number) => () => undefined);
    const unbind = bindHold(lock);
    holdScroll(5000);
    expect(lock).toHaveBeenCalledWith(5000);
    unbind();
  });
});
