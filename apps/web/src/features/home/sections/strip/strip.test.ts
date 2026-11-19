import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, prefetch: () => undefined }),
  usePathname: () => "/",
}));

import filmsFile from "../../../../../public/data/library/video-films.json";
import { clock } from "@/features/library/video/films/film-math";

import { STRIP } from "../../content";
import { PREVIEWS, TRAILER_FILM } from "../../fx/video-plane/data";

import { view } from "./view";

const markup = view();
const text = renderToStaticMarkup(createElement("div", null, markup.text));
const below = renderToStaticMarkup(createElement("div", null, markup.below));
const escape = (s: string): string => s.replace(/&/g, "&amp;").replace(/'/g, "&#x27;");

describe("the strip's words", () => {
  it("are the owner's, in the reference's reading order (the button follows the tag it sits under), in the page's HTML", () => {
    const words = [
      STRIP.topLeft,
      STRIP.topRight,
      STRIP.topRightTag,
      STRIP.button.label,
      STRIP.middleLeft,
      STRIP.middleRight,
      STRIP.bottomLeft.rest[0],
      STRIP.bottomLeft.rest[1],
      STRIP.play.left,
      STRIP.play.right,
      STRIP.play.duration,
      STRIP.expand.lead,
      STRIP.expand.title,
      STRIP.expand.body,
      STRIP.expand.button.label,
    ].map(escape);
    let at = -1;
    for (const w of words) {
      const next = text.indexOf(w, at + 1);
      expect(next, w).toBeGreaterThan(at);
      at = next;
    }
  });

  it("have a real link for the two buttons and for each of the ten films", () => {
    expect(text).toContain(`href="${STRIP.button.href}"`);
    expect(text).toContain(`href="${STRIP.expand.button.href}"`);
    expect(PREVIEWS).toHaveLength(10);
    for (const film of PREVIEWS) expect(text, film.title).toContain(`href="${film.href}"`);
    expect(text.match(/data-strip-film/g)).toHaveLength(10);
  });

  it("have a letter for every letter of the words that come in one by one", () => {
    const letters = text.match(/data-ch=""/g) ?? [];
    const spans = [
      STRIP.topLeft,
      STRIP.topRight,
      STRIP.topRightTag,
      STRIP.middleLeft,
      STRIP.middleRight,
      STRIP.expand.lead,
      STRIP.expand.title,
      STRIP.expand.body,
    ].reduce((n, w) => n + w.replace(/ /g, "").length, 0);
    expect(letters).toHaveLength(spans);
  });

  it("have no dash of the banned kind", () => {
    const banned = new RegExp(
      `[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`,
      "u",
    );
    expect(banned.test(text)).toBe(false);
    expect(banned.test(below)).toBe(false);
  });
});

describe("the play button", () => {
  it("shows the trailer's real duration, written as the Films room writes it", () => {
    const film = filmsFile.items.find((f) => f.id === TRAILER_FILM.id)!;
    expect(STRIP.play.duration).toBe(clock(film.video.dur));
  });

  it("is a real button with a name", () => {
    expect(text).toMatch(
      /<button[^>]*data-strip-play=""[^>]*aria-label="Play the trailer with sound"/,
    );
  });
});

describe("the scene's chrome", () => {
  it("has the line, its two end dots and four corner dots, all decorative", () => {
    expect(below).toContain('data-strip-line=""');
    expect(below.match(/data-strip-end=/g)).toHaveLength(2);
    expect(below.match(/data-strip-corner=/g)).toHaveLength(4);
  });

  it("has no scroll button (the three dots that led to the window were removed)", () => {
    expect(text).not.toContain("data-strip-scroll");
  });
});

describe("the window's deck (after Vexana's film section)", () => {
  it("has PLAY on the left and FILMS on the right of the button, a letter at a time", () => {
    const words = text.match(/data-deck="word"/g) ?? [];
    expect(words).toHaveLength(2);
    const chars = text.match(/data-deck="char"/g) ?? [];
    expect(chars).toHaveLength(STRIP.play.left.length + STRIP.play.right.length);
    // The words stand in a grid on either side of the centred button, which sits over their inner ends.
    expect(text.indexOf(">Play<")).toBeGreaterThan(-1);
    expect(text.indexOf(">Play<")).toBeLessThan(text.indexOf(">Films<"));
  });

  it("has two bands of five marks and eight running strips each, and the readout pill", () => {
    expect(text.match(/data-deck="mark-slot"/g)).toHaveLength(10);
    expect(text.match(/data-deck="strip-item"/g)).toHaveLength(16);
    expect(text).toContain('data-deck="readout"');
    expect(text).toContain(escape(STRIP.deck.readout[0]));
    expect(text).toContain(STRIP.play.duration);
  });
});
