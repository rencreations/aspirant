import { isRevealed, loadReaderPrefs, useReaderPrefs, writePrefs } from "./prefs";

const KEY = "aspirants:reader";

describe("reader preferences", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useReaderPrefs.setState({
      textScale: 1,
      theme: "daybreak",
      resume: null,
      furthest: -1,
      loaded: false,
    });
  });

  it("starts light, with no saved place, for a fresh visitor", () => {
    loadReaderPrefs();
    const state = useReaderPrefs.getState();
    expect(state.loaded).toBe(true);
    expect(state.theme).toBe("daybreak");
    expect(state.resume).toBeNull();
    expect(state.furthest).toBe(-1);
  });

  it("keeps the theme, the text size and the place", () => {
    writePrefs({ chapterId: "c12", paragraphId: "c12-p004", textScale: 1.25, theme: "storm" });
    loadReaderPrefs();
    const state = useReaderPrefs.getState();
    expect(state.theme).toBe("storm");
    expect(state.textScale).toBe(1.25);
    expect(state.resume).toEqual({ chapterId: "c12", paragraphId: "c12-p004" });
  });

  it("remembers the furthest chapter reached, and never goes back", () => {
    writePrefs({ chapterId: "c20", paragraphId: "c20-p002" });
    writePrefs({ chapterId: "c07", paragraphId: "c07-p001" });
    loadReaderPrefs();
    expect(useReaderPrefs.getState().furthest).toBe(20);
    expect(isRevealed(20, 20)).toBe(true);
    expect(isRevealed(21, 20)).toBe(false);
    expect(isRevealed(0, -1)).toBe(false);
  });

  it("does not count the very first paragraph as a place to continue from", () => {
    writePrefs({ chapterId: "c00", paragraphId: "c00-p000" });
    loadReaderPrefs();
    expect(useReaderPrefs.getState().resume).toBeNull();
  });

  it("ignores a place saved in the older story, but keeps the theme and size", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        chapterId: "c30",
        paragraphId: "c30-p010",
        textScale: 1.125,
        theme: "storm",
        furthest: 55,
      }),
    );
    loadReaderPrefs();
    const state = useReaderPrefs.getState();
    expect(state.resume).toBeNull();
    expect(state.furthest).toBe(-1);
    expect(state.theme).toBe("storm");
    expect(state.textScale).toBe(1.125);
  });

  it("ignores a place saved in the first edition of the book (version 2)", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        v: 2,
        chapterId: "c30",
        paragraphId: "c30-p010",
        textScale: 1.25,
        theme: "storm",
        furthest: 40,
      }),
    );
    loadReaderPrefs();
    const state = useReaderPrefs.getState();
    expect(state.resume).toBeNull();
    expect(state.furthest).toBe(-1);
    expect(state.theme).toBe("storm");
    expect(state.textScale).toBe(1.25);
  });

  it("falls back to the defaults for a damaged value", () => {
    window.localStorage.setItem(KEY, "{not json");
    loadReaderPrefs();
    expect(useReaderPrefs.getState().resume).toBeNull();
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ v: 3, chapterId: "nonsense", textScale: 9, theme: "neon" }),
    );
    loadReaderPrefs();
    const state = useReaderPrefs.getState();
    expect(state.resume).toBeNull();
    expect(state.textScale).toBe(1);
    expect(state.theme).toBe("daybreak");
  });
});
