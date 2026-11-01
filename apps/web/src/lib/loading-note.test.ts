import { describe, expect, it } from "vitest";

import { loadingNote } from "./loading-note";

const progress = (p: number, bytes?: { received: number; total: number; partial: boolean }) => ({
  progress: p,
  label: "Loading",
  pending: [],
  ...(bytes ? { bytes } : {}),
});

describe("loading note", () => {
  it("shows the real percentage, and the bytes in plain words where the sizes are known", () => {
    const off = { offline: false, retrying: false };
    expect(loadingNote(null, off)).toContain("Still loading.");
    expect(loadingNote(progress(0.426), off)).toContain("Still loading, 43%.");
    const sized = (received: number, total: number, partial = false) =>
      loadingNote(progress(0.5, { received, total, partial }), off);
    expect(sized(120_000_000, 290_000_000)).toContain("50%, 120 MB of 290 MB");
    expect(sized(812_000, 1_340_000_000)).toContain("812 KB of 1.3 GB");
    // Some downloads have not said their size yet: no total that is not final.
    expect(sized(120_000_000, 290_000_000, true)).toContain("50%, 120 MB received");
  });

  it("promises that the page opens when everything is loaded, and never offers a way in early", () => {
    const text = loadingNote(progress(0.2), { offline: false, retrying: false });
    expect(text).toContain("Still loading, 20%");
    expect(text).toContain("opens when everything is loaded");
    expect(text).not.toMatch(/enter now|skip/i);
  });

  it("says that it waits for the connection when offline, and when a download tries again", () => {
    expect(loadingNote(progress(0.2), { offline: true, retrying: false })).toContain(
      "Waiting for the connection",
    );
    expect(loadingNote(progress(0.2), { offline: false, retrying: true })).toContain(
      "trying again",
    );
  });
});
