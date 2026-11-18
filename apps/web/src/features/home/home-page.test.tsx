import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, prefetch: () => undefined }),
  usePathname: () => "/",
}));

import * as content from "./content";
import { HomePage } from "./home-page";
import { SECTIONS } from "./kernel/sections";

const DASHES = new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`, "u");
const html = renderToStaticMarkup(<HomePage />);

describe("the server markup of the home page", () => {
  it("has exactly one h1, named for the logo", () => {
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(/<h1[^>]*>[\s\S]*?aria-label="The Aspirants"[\s\S]*?<\/h1>/.test(html)).toBe(true);
  });

  it("gives every section a slot in the decorative layer and one for its text", () => {
    for (const s of SECTIONS) {
      expect(html.includes(`data-home-below="${s.id}"`), String(s.id)).toBe(true);
      expect(html.includes(`data-home-text="${s.id}"`), String(s.id)).toBe(true);
    }
  });

  it("keeps the last section's text in the flow and the others in the stage", () => {
    expect(html.match(/data-home-section="footer"/g)).toHaveLength(1);
    expect(html.match(/data-home-content/g)).toHaveLength(15);
  });

  it("starts in neither mode: the page is the stage until the client says it is plain", () => {
    expect(html.includes('data-gl="pending"')).toBe(true);
    expect(html.includes('data-open="1"')).toBe(false);
  });

  it("has the owner's words and links in the HTML", () => {
    for (const phrase of [
      content.ASPIRANTS.line,
      content.ASPIRANTS.button.label,
      content.STRIP.topRight,
      content.STRIP.expand.body,
      content.STRIP.expand.button.label,
      content.HAND.title,
      content.HAND.hint,
      content.SELENA.body,
      content.FUNNY.body,
      content.FOOTER.line,
    ]) {
      // Apostrophes and ampersands are escaped by the renderer.
      const escaped = phrase.replace(/&/g, "&amp;").replace(/'/g, "&#x27;");
      expect(html.includes(escaped), String(phrase)).toBe(true);
    }
    for (const href of ["/about", "/story", "/collection/video/films", "/collection/animation"]) {
      expect(html.includes(`href="${href}"`), String(href)).toBe(true);
    }
  });

  it("lists the five pairs and the ten Aspirants as real links", () => {
    for (const pair of content.PAIRS) {
      expect(html.includes(pair.replace(/&/g, "&amp;").replace(/'/g, "&#x27;"))).toBe(true);
    }
    for (const slug of content.LIST_ORDER)
      expect(html.includes(`href="/character/${slug}"`), slug).toBe(true);
  });

  it("names the footer's button for the next page, with a hint of the N key", () => {
    expect(html.includes('aria-label="Continue to About"')).toBe(true);
    expect(html.includes('aria-keyshortcuts="N"')).toBe(true);
  });

  it("carries the takedown shortcut for the fan art it shows", () => {
    expect(html.includes("Copyright or takedown")).toBe(true);
  });

  it("has no em dash and no en dash", () => {
    expect(DASHES.test(html)).toBe(false);
  });
});
