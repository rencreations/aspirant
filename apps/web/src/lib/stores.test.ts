import { ENTERED_KEY, hydrateSiteStore, PREFS_KEY, readEntered, useSiteStore } from "./stores";

describe("site store", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    useSiteStore.setState({ entered: false, muted: false, motion: "auto", lastChapter: null });
  });

  it("toggles mute and sets motion", () => {
    useSiteStore.getState().toggleMute();
    expect(useSiteStore.getState().muted).toBe(true);
    useSiteStore.getState().setMotion("reduced");
    expect(useSiteStore.getState().motion).toBe("reduced");
  });

  it("persists only the preference keys", () => {
    useSiteStore.getState().setMuted(true);
    useSiteStore.getState().setLastChapter("c12");
    useSiteStore.getState().setTheme("daybreak");
    const saved = JSON.parse(window.localStorage.getItem(PREFS_KEY) ?? "{}") as {
      state: Record<string, unknown>;
    };
    expect(saved.state).toEqual({ muted: true, motion: "auto", lastChapter: "c12" });
  });

  it("writes the session flag when entering", () => {
    expect(readEntered()).toBe(false);
    useSiteStore.getState().setEntered(true);
    expect(window.sessionStorage.getItem(ENTERED_KEY)).toBe("1");
    expect(readEntered()).toBe(true);
  });

  it("ignores corrupt or invalid saved data", async () => {
    window.localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({ state: { muted: "yes", motion: "fast" }, version: 1 }),
    );
    await hydrateSiteStore();
    expect(useSiteStore.getState().muted).toBe(false);
    expect(useSiteStore.getState().motion).toBe("auto");
  });

  it("restores valid saved preferences", async () => {
    window.localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({ state: { muted: true, motion: "reduced", lastChapter: "c03" }, version: 1 }),
    );
    window.sessionStorage.setItem(ENTERED_KEY, "1");
    await hydrateSiteStore();
    const s = useSiteStore.getState();
    expect([s.muted, s.motion, s.lastChapter, s.entered]).toEqual([true, "reduced", "c03", true]);
  });
});
