import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ unlock: vi.fn(), setMuted: vi.fn() }));

vi.mock("@/lib/audio", () => ({
  audio: { unlock: mocks.unlock, setMuted: mocks.setMuted, blip: vi.fn() },
}));

import { useSiteStore } from "@/lib/stores";

import { answerSound, ensureSound, useSoundPrompt, withSound } from "./sound-prompt";

beforeEach(() => {
  window.localStorage.clear();
  useSiteStore.setState({ muted: false });
  useSoundPrompt.setState({ open: false, what: "" });
  vi.clearAllMocks();
});

describe("asking about sound", () => {
  it("does not ask when the sound is on, and runs at once", async () => {
    const run = vi.fn();
    withSound("This voice line", run);
    expect(run).toHaveBeenCalledTimes(1);
    expect(useSoundPrompt.getState().open).toBe(false);
    expect(await ensureSound()).toBe(true);
  });

  it("asks when the sound is off, and waits for the answer", () => {
    useSiteStore.setState({ muted: true });
    const run = vi.fn();
    withSound("This voice line", run);
    expect(run).not.toHaveBeenCalled();
    expect(useSoundPrompt.getState()).toMatchObject({ open: true, what: "This voice line" });
  });

  it("turns the sound on and plays when the visitor says yes", () => {
    useSiteStore.setState({ muted: true });
    const run = vi.fn();
    withSound("This voice line", run);
    // Resolved by the click on the button.
    answerSound("on");
    return Promise.resolve().then(() => {
      expect(useSiteStore.getState().muted).toBe(false);
      expect(mocks.unlock).toHaveBeenCalled();
      expect(mocks.setMuted).toHaveBeenCalledWith(false);
      expect(run).toHaveBeenCalledTimes(1);
      expect(useSoundPrompt.getState().open).toBe(false);
    });
  });

  it("plays nothing and keeps the sound off when the visitor says no, and asks again next time", async () => {
    useSiteStore.setState({ muted: true });
    const run = vi.fn();
    withSound("This voice line", run);
    answerSound("off");
    await Promise.resolve();
    expect(run).not.toHaveBeenCalled();
    expect(useSiteStore.getState().muted).toBe(true);
    withSound("This voice line", run);
    expect(useSoundPrompt.getState().open).toBe(true);
  });

  it("stops asking when the visitor says so, and plays in silence as before", async () => {
    useSiteStore.setState({ muted: true });
    const run = vi.fn();
    withSound("This voice line", run);
    answerSound("never");
    await Promise.resolve();
    expect(run).toHaveBeenCalledTimes(1);
    expect(useSiteStore.getState().muted).toBe(true);
    withSound("This voice line", run);
    expect(run).toHaveBeenCalledTimes(2);
    expect(useSoundPrompt.getState().open).toBe(false);
  });

  it("answers an earlier question with no when a second press comes while it is open", async () => {
    useSiteStore.setState({ muted: true });
    const first = vi.fn();
    const second = vi.fn();
    withSound("A", first);
    withSound("B", second);
    answerSound("on");
    await Promise.resolve();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
