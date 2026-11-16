import { describe, expect, it } from "vitest";

import { aboutPlaceOf, keepReturn, returnOf, returnQuery, withReturn } from "./return-to";

describe("returnOf", () => {
  it("reads the page the visitor came from", () => {
    expect(returnOf("?i=music-we-believe&from=about")).toEqual({
      key: "about",
      href: "/about",
      label: "About",
      query: "from=about",
    });
  });

  it("sends the visitor back to the place they left", () => {
    expect(returnOf("?from=about&at=phase-4")).toEqual({
      key: "about",
      href: "/about?at=phase-4",
      label: "About",
      at: "phase-4",
      query: "from=about&at=phase-4",
    });
    expect(returnOf("?at=ledger&from=about&i=x")?.href).toBe("/about?at=ledger");
  });

  it("keeps the rooms of the collection that were named before", () => {
    expect(returnOf("?from=music")).toMatchObject({ href: "/collection/music", label: "Music" });
    expect(returnOf("?from=voicelines")).toMatchObject({
      href: "/collection/voicelines",
      label: "Voicelines",
    });
    expect(returnOf("?from=arts")).toMatchObject({ href: "/collection/arts", label: "Arts" });
  });

  it("is null without a page it knows", () => {
    expect(returnOf("")).toBeNull();
    expect(returnOf("?i=film-1")).toBeNull();
    expect(returnOf("?from=")).toBeNull();
    expect(returnOf("?from=elsewhere")).toBeNull();
    expect(returnOf("?from=toString")).toBeNull();
    expect(returnOf("?from=https://example.com")).toBeNull();
  });

  it("drops a place the page does not have, and never passes it on", () => {
    expect(returnOf("?from=about&at=phase-9")?.href).toBe("/about");
    expect(returnOf("?from=about&at=%22%5D%2C%20body")?.query).toBe("from=about");
    expect(returnOf("?from=about&at=x%26from%3Dmusic")?.href).toBe("/about");
    // Only the About page has places.
    expect(returnOf("?from=music&at=phase-1")).toMatchObject({
      href: "/collection/music",
      query: "from=music",
    });
  });
});

describe("returnQuery", () => {
  it("is the way back alone, in one order", () => {
    expect(returnQuery("?at=phase-2&q=layla&from=about")).toBe("from=about&at=phase-2");
    expect(returnQuery("?from=music&t=12")).toBe("from=music");
    expect(returnQuery("?q=layla")).toBe("");
  });

  it("reads back to the same target", () => {
    const first = returnOf("?i=a&from=about&at=ledger");
    expect(returnOf(`?${returnQuery("?i=a&from=about&at=ledger")}`)).toEqual(first);
  });
});

describe("withReturn", () => {
  it("adds the way back to a link", () => {
    expect(withReturn("/collection/music", "about")).toBe("/collection/music?from=about");
    expect(withReturn("/collection/music?i=music-we-believe", "about", "phase-1")).toBe(
      "/collection/music?i=music-we-believe&from=about&at=phase-1",
    );
    expect(withReturn("/collection/lore#texts", "about", "ledger")).toBe(
      "/collection/lore?from=about&at=ledger#texts",
    );
  });

  it("leaves out a place the page does not have", () => {
    expect(withReturn("/collection/comic", "about", "nowhere")).toBe(
      "/collection/comic?from=about",
    );
    expect(withReturn("/collection/video/films?i=f", "music", "phase-1")).toBe(
      "/collection/video/films?i=f&from=music",
    );
  });

  it("makes a link the page it opens can read", () => {
    const href = withReturn("/collection/comic/the-aspirant", "about", "phase-1");
    expect(returnOf(href.slice(href.indexOf("?")))?.href).toBe("/about?at=phase-1");
  });
});

describe("keepReturn", () => {
  it("carries the way back to another address of the same room", () => {
    expect(keepReturn("/collection/lore/fanny/", "?from=about&at=ledger")).toBe(
      "/collection/lore/fanny/?from=about&at=ledger",
    );
    expect(keepReturn("/collection/music/?i=b", "?i=a&from=about&at=phase-5")).toBe(
      "/collection/music/?i=b&from=about&at=phase-5",
    );
  });

  it("changes nothing when there is no way back", () => {
    expect(keepReturn("/collection/lore/fanny/", "")).toBe("/collection/lore/fanny/");
    expect(keepReturn("/collection/lore/", "?q=moon&from=nowhere")).toBe("/collection/lore/");
  });
});

describe("aboutPlaceOf", () => {
  it("reads a place of the About page", () => {
    expect(aboutPlaceOf("?at=phase-4")).toBe("phase-4");
    expect(aboutPlaceOf("?at=ledger")).toBe("ledger");
    expect(aboutPlaceOf("?from=about&at=label")).toBe("label");
  });

  it("is null for anything else", () => {
    expect(aboutPlaceOf("")).toBeNull();
    expect(aboutPlaceOf("?at=")).toBeNull();
    expect(aboutPlaceOf("?at=phase-0")).toBeNull();
    expect(aboutPlaceOf("?at=phase-6")).toBeNull();
    expect(aboutPlaceOf('?at="], body')).toBeNull();
  });
});
