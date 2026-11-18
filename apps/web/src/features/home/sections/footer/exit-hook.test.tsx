import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { exitBridge } from "./exit-bridge";

type Hook = () => Promise<void> | void;
const hooks: { current: Hook | null } = { current: null };

vi.mock("../../kernel/handoff", () => ({
  setExitHook: (hook: Hook) => {
    hooks.current = hook;
    return () => {
      if (hooks.current === hook) hooks.current = null;
    };
  },
}));

import { ExitHook } from "./exit-hook";

afterEach(() => {
  exitBridge.run = null;
  hooks.current = null;
});

describe("the footer's exit hook", () => {
  it("is set while the footer is on the page and taken away with it", () => {
    const { unmount } = render(<ExitHook />);
    expect(hooks.current).not.toBeNull();
    unmount();
    expect(hooks.current).toBeNull();
  });

  it("resolves at once when the runtime is not there, so the page always changes", async () => {
    render(<ExitHook />);
    await expect(Promise.resolve(hooks.current?.())).resolves.toBeUndefined();
  });

  it("waits for the runtime's own exit when it is there", async () => {
    let finish: () => void = () => undefined;
    exitBridge.run = () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      });
    render(<ExitHook />);
    let done = false;
    void Promise.resolve(hooks.current?.()).then(() => {
      done = true;
    });
    await Promise.resolve();
    expect(done).toBe(false);
    finish();
    await Promise.resolve();
    await Promise.resolve();
    expect(done).toBe(true);
  });
});
