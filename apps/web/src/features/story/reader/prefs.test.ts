import { loadReaderPrefs, useReaderPrefs, writePrefs } from "./prefs";

const KEY = "aspirants:reader";

describe("reader preferences", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useReaderPrefs.setState({ textScale: 1, theme: "daybreak", resume: null, loaded: false });
  });

  it("starts light, with no saved place, for a fresh visitor", () => {
    loadReaderPrefs();
    const state = useReaderPrefs.getState();
    expect(state.loaded).toBe(true);
    expect(state.theme).toBe("daybreak");
    expect(state.resume).toBeNull();
  });

  it("keeps the theme, the text size and the place", () => {
    writePrefs({ chapterId: "c12", paragraphId: "c12-p004", textScale: 1.25, theme: "storm" });
    loadReaderPrefs();
    const state = useReaderPrefs.getState();
    expect(state.theme).toBe("storm");
    expect(state.textScale).toBe(1.25);
    expect(state.resume).toEqual({ chapterId: "c12", paragraphId: "c12-p004" });
  });

  it("does not count the very first paragraph as a place to continue from", () => {
    writePrefs({ chapterId: "c01", paragraphId: "c01-p000" });
    loadReaderPrefs();
    expect(useReaderPrefs.getState().resume).toBeNull();
  });

  it("reads what the old reader saved, and ignores what it no longer has", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ chapterId: "c30", paragraphId: "c30-p010", textScale: 1, calm: true }),
    );
    loadReaderPrefs();
    const state = useReaderPrefs.getState();
    expect(state.resume).toEqual({ chapterId: "c30", paragraphId: "c30-p010" });
    expect(state.theme).toBe("daybreak");
  });

  it("falls back to the defaults for a damaged value", () => {
    window.localStorage.setItem(KEY, "{not json");
    loadReaderPrefs();
    expect(useReaderPrefs.getState().resume).toBeNull();
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ chapterId: "nonsense", textScale: 9, theme: "neon" }),
    );
    loadReaderPrefs();
    const state = useReaderPrefs.getState();
    expect(state.resume).toBeNull();
    expect(state.textScale).toBe(1);
    expect(state.theme).toBe("daybreak");
  });
});
