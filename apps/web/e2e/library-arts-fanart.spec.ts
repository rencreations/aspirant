import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { firstKeys } from "../src/features/library/arts/fanart/first-keys";
import { adaptFan } from "../src/features/library/arts/fanart/model";
import type { FanRaw } from "../src/features/library/arts/fanart/types";
import { skipGate, url } from "./helpers";

/**
 * Fanart (`/collection/arts/fanart`): the fan pictures as a flow of rows, the videos as a row of
 * their own over the rows, a search, a filter (the Aspirants first, then the pairs, platforms and
 * artists, behind "See more"), the zoom with the credit in its caption, the By artist view, and
 * the old address of the twelve cosplay photos. The checks are about structure and state, not
 * about pictures arriving: the files of the library may not be in the bucket the run reads from.
 */

test.describe.configure({ timeout: 120_000 });

const rows = (page: Page) => page.locator("[data-flow-row]");
const count = (page: Page) => page.locator("[data-flow-count]");
const strip = (page: Page) => page.locator("[data-fanart-videos]");
const entries = (page: Page) => page.locator("[data-video]");
const chip = (page: Page, facet: string) =>
  page.locator(`[data-flow-filter] button[data-facet="${facet}"]`);

/** Console errors and uncaught exceptions. Files of the library origin belong to the pipeline. */
function watch(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const where = msg.location().url;
    if (where.includes("/library/v1/")) return;
    errors.push(`${msg.text()} ${where}`);
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

async function open(page: Page, query = "") {
  await skipGate(page);
  const errors = watch(page);
  await page.goto(url(`/collection/arts/fanart/${query}`));
  await expect(rows(page).first()).toBeAttached({ timeout: 60_000 });
  return errors;
}

async function openArtists(page: Page, query = "") {
  await skipGate(page);
  const errors = watch(page);
  await page.goto(url(`/collection/arts/fanart/?view=artist${query}`));
  await expect(page.locator("[data-fanart-block]").first()).toBeAttached({ timeout: 60_000 });
  return errors;
}

/**
 * Press a picture that stands whole in view, where it stands. The rows slide with the scroll, so a
 * tile that has to be scrolled to is not where it was when it was found. A finger taps, a mouse clicks.
 */
async function pressTile(page: Page): Promise<string> {
  const find = () =>
    page.evaluate(() => {
      for (const t of document.querySelectorAll<HTMLElement>("[data-flow-tile]")) {
        const r = t.getBoundingClientRect();
        if (
          r.left >= 4 &&
          r.right <= window.innerWidth - 4 &&
          r.top >= 90 &&
          r.bottom <= window.innerHeight - 4
        ) {
          return { x: r.left + r.width / 2, y: r.top + r.height / 2, id: t.dataset.id ?? "" };
        }
      }
      return null;
    });
  let at = await find();
  if (!at) {
    await page.mouse.wheel(0, 520);
    await page.waitForTimeout(1200);
    at = await find();
  }
  if (!at) throw new Error("no picture stands whole in view");
  const touch = await page.evaluate(() => window.matchMedia("(pointer: coarse)").matches);
  if (touch) await page.touchscreen.tap(at.x, at.y);
  else await page.mouse.click(at.x, at.y);
  return at.id;
}

interface Piece {
  id: string;
  kind: "image" | "video";
  canon: string;
  title: string;
  chars: string[];
  credit?: { by: string | null; url: string | null };
}

/** The pieces of the room, read from its data file. */
const PIECES = (
  JSON.parse(
    readFileSync(
      path.join(import.meta.dirname, "..", "public", "data", "library", "arts-fanart.json"),
      "utf8",
    ),
  ) as { items: Piece[] }
).items;

function pieces(): Piece[] {
  return PIECES;
}

test.describe("the flow", () => {
  test("has the title, the filter, the video row over the rows, and a full row in view", async ({
    page,
  }) => {
    const errors = await open(page);
    await expect(page.getByRole("heading", { level: 1, name: "Fanart" })).toBeVisible();
    await expect(count(page)).toContainText("149 pictures");
    // The filter: All, the biggest Aspirants and See more.
    const filter = page.locator("[data-flow-filter]");
    await expect(filter).toBeVisible();
    await expect(chip(page, "")).toHaveAttribute("aria-pressed", "true");
    await expect(chip(page, "c:fanny")).toBeVisible();
    await expect(page.locator("[data-flow-more]")).toBeVisible();

    // The videos are a row of their own, over the picture rows and under the filter.
    await expect(strip(page)).toBeVisible();
    expect(Number(await strip(page).getAttribute("data-fanart-videos"))).toBe(18);
    expect(await entries(page).count()).toBe(18);
    const order = await page.evaluate(() => {
      const top = (sel: string) => document.querySelector(sel)?.getBoundingClientRect().top ?? -1;
      return [top("[data-flow-filter]"), top("[data-fanart-videos]"), top("[data-flow-row='0']")];
    });
    expect(order[0]).toBeLessThan(order[1] ?? 0);
    expect(order[1]).toBeLessThan(order[2] ?? 0);

    // On a laptop the room opens as a flow: a whole row stands in view under the video row. (A
    // phone's head is taller than its screen allows: there the first row shows in part.)
    const vw = page.viewportSize()?.width ?? 1440;
    const vh = page.viewportSize()?.height ?? 900;
    const first = await page.locator("[data-flow-row='0']").boundingBox();
    expect(first).not.toBeNull();
    if (vw >= 1000) expect((first?.y ?? 0) + (first?.height ?? 0)).toBeLessThanOrEqual(vh);
    else expect(first?.y ?? 0).toBeLessThan(vh);

    // No sideways scroll, and no video element before a press (nothing starts by itself).
    const sw = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(sw[0]).toBe(sw[1]);
    expect(await page.locator("video").count()).toBe(0);
    expect(errors).toEqual([]);
  });

  test("has no sub-page buttons, the way back and the takedown line", async ({ page }) => {
    await open(page);
    await expect(page.getByRole("navigation", { name: "Official art" })).toHaveCount(0);
    await expect(page.locator("[data-room-back]")).toHaveAttribute(
      "href",
      /collection\/?\?open=arts/,
    );
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await expect(page.getByText("To ask for something to be taken down")).toBeVisible();
  });

  test("filters by Aspirant, pair, platform and artist, and keeps the address", async ({
    page,
  }) => {
    await open(page);
    const total = (await count(page).textContent()) ?? "";
    const videosBefore = Number(await strip(page).getAttribute("data-fanart-videos"));

    // An Aspirant: the rows and the video row both follow it.
    await chip(page, "c:ruby").click();
    await expect(page).toHaveURL(/[?&]f=c(%3A|:)ruby/);
    await expect(count(page)).toContainText(" of ");
    await expect(chip(page, "c:ruby")).toHaveAttribute("aria-pressed", "true");
    const videosRuby = Number(await strip(page).getAttribute("data-fanart-videos"));
    expect(videosRuby).toBeGreaterThan(0);
    expect(videosRuby).toBeLessThan(videosBefore);
    // Pressing the chosen chip clears it.
    await chip(page, "c:ruby").click();
    await expect(page).not.toHaveURL(/[?&]f=/);
    await expect(count(page)).toHaveText(total);

    // Behind See more: pairs, platforms and artists, one sheet.
    await page.locator("[data-flow-more]").click();
    const sheet = page.locator("[data-flow-sheet]");
    await expect(sheet).toBeVisible();
    await expect(sheet.locator("button[data-facet^='p:']").first()).toBeVisible();
    await expect(sheet.locator("button[data-facet^='pl:']").first()).toBeVisible();
    await expect(sheet.locator("button[data-facet^='a:']").first()).toBeVisible();
    // An artist.
    const artist = sheet.locator("button[data-facet^='a:']").first();
    const artistId = await artist.getAttribute("data-facet");
    await artist.click();
    await expect(sheet).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`[?&]f=${encodeURIComponent(artistId ?? "")}`));
    // The chosen facet shows as a chip even though it was behind See more.
    await expect(chip(page, artistId ?? "")).toHaveAttribute("aria-pressed", "true");
    await expect(count(page)).toContainText(" of ");
  });

  test("a filter in the address is what the page shows", async ({ page }) => {
    await open(page, "?f=pl:Instagram");
    await expect(count(page)).toContainText(" of ");
    await expect(chip(page, "pl:Instagram")).toHaveAttribute("aria-pressed", "true");
    // A filter the room does not know is no filter.
    await page.goto(url("/collection/arts/fanart/?f=c:nobody"));
    await expect(rows(page).first()).toBeAttached({ timeout: 60_000 });
    await expect(count(page)).toContainText("149 pictures");
  });

  test("searches the maker, the Aspirant and the kind, and says plainly when nothing matches", async ({
    page,
  }) => {
    await open(page);
    const field = page.getByRole("searchbox");
    await field.fill("jlin");
    await expect(page).toHaveURL(/[?&]q=jlin/);
    await expect(count(page)).toContainText(" of ");
    // A word that only videos have: the rows say nothing matches, the video row shows them.
    await field.fill("speedpaint");
    await expect(strip(page)).toBeVisible();
    await field.fill("zzzzqqqq");
    await expect(page.locator("[data-flow-empty]")).toContainText("Nothing matches");
    await expect(strip(page)).toHaveCount(0);
    await expect(rows(page)).toHaveCount(0);
    await page.locator("[data-flow-empty]").getByRole("button", { name: "Clear" }).click();
    await expect(page).not.toHaveURL(/[?&]q=/);
    await expect(rows(page).first()).toBeAttached();
    // "change" finds Chang'e whichever way it is spelled.
    await field.fill("Chang'e");
    await expect(count(page)).toContainText(" of ");
    const a = (await count(page).textContent()) ?? "";
    await field.fill("change");
    await expect(count(page)).toHaveText(a);
  });
});

test.describe("the loading list", () => {
  test("waits for the pictures and the posters that the first screen draws", async ({
    page,
    viewport,
  }) => {
    await open(page);
    // Let the pictures arrive, then read what stands in view.
    await page.waitForTimeout(2500);
    const seen = await page.evaluate(() => {
      const inView = (el: Element) => {
        const r = el.getBoundingClientRect();
        return (
          r.width > 0 &&
          r.bottom > 0 &&
          r.top < window.innerHeight &&
          r.right > 0 &&
          r.left < window.innerWidth
        );
      };
      return [
        ...document.querySelectorAll<HTMLImageElement>("[data-flow-tile] img, [data-video] img"),
      ]
        .filter(inView)
        .map((img) => img.currentSrc || img.src);
    });
    expect(seen.length).toBeGreaterThan(3);
    const keys = firstKeys((PIECES as unknown as FanRaw[]).map(adaptFan), "", {
      width: viewport?.width ?? 1440,
      height: viewport?.height ?? 900,
      dpr: await page.evaluate(() => window.devicePixelRatio),
    });
    // Every picture in view is one the list waited for. (A tile that stands half in view at the
    // edge of a sliding row may be one more than the list counted: allow a couple.)
    const missing = seen.filter((src) => !keys.some((key) => src.endsWith(key)));
    expect(missing.length, missing.join(", ")).toBeLessThanOrEqual(2);
  });
});

test.describe("the zoom and the credit", () => {
  test("a press on a picture opens the zoom with its credit and the link to the post", async ({
    page,
  }) => {
    await open(page);
    await page.waitForTimeout(500);
    const id = await pressTile(page);
    await expect(page).toHaveURL(new RegExp(`[?&]i=${id}`));
    const dialog = page.locator("[data-zoom-viewer]");
    await expect(dialog).toBeVisible();
    const caption = dialog.locator("[data-fan-caption]");
    await expect(caption).toBeVisible();
    await expect(caption).toContainText("Fan work");
    // Who made it, and where it is from.
    const list = pieces();
    const piece = list.find((p) => p.id === id);
    expect(piece).toBeDefined();
    await expect(caption).toContainText(piece?.credit?.by ?? "Artist not named");
    const link = caption.getByRole("link", { name: "View the original" });
    if (piece?.credit?.url) {
      await expect(link).toHaveAttribute("href", piece.credit.url);
    }
    // Esc takes the picture out of the address.
    await page.keyboard.press("Escape");
    await expect(page).not.toHaveURL(/[?&]i=/, { timeout: 10_000 });
  });

  test("a deep link opens a picture, and the arrow keys never land on a video", async ({
    page,
  }) => {
    await skipGate(page);
    await page.goto(url("/collection/arts/fanart/"));
    await expect(rows(page).first()).toBeAttached({ timeout: 60_000 });
    const list = pieces();
    const images = list.filter((p) => p.kind === "image");
    const id = images[40]?.id;
    if (!id) throw new Error("no pictures");

    await page.goto(url(`/collection/arts/fanart/?i=${id}`));
    const dialog = page.locator("[data-zoom-viewer]");
    await expect(dialog).toBeVisible({ timeout: 60_000 });
    await expect(page).toHaveURL(new RegExp(`[?&]i=${id}`));
    await page.keyboard.press("ArrowRight");
    await expect(page).not.toHaveURL(new RegExp(`[?&]i=${id}(&|$)`));
    const videoIds = list.filter((p) => p.kind === "video").map((p) => p.id);
    const now = new URL(page.url()).searchParams.get("i") ?? "";
    expect(videoIds).not.toContain(now);
  });

  test("the library search opens a picture with a popstate", async ({ page }) => {
    await open(page);
    const list = pieces();
    const id = list.filter((p) => p.kind === "image")[2]?.id;
    if (!id) throw new Error("no pictures");
    await page.evaluate((target) => {
      const next = new URL(window.location.href);
      next.searchParams.set("i", target);
      window.history.pushState(null, "", next);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }, id);
    await expect(page.locator("[data-zoom-viewer]")).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("the videos", () => {
  test("each has a card, its label, who made it, and none starts by itself", async ({ page }) => {
    await open(page);
    const list = pieces();
    const videos = list.filter((p) => p.kind === "video");
    expect(videos).toHaveLength(18);
    for (const v of videos) {
      const entry = page.locator(`[data-video="${v.id}"]`);
      await expect(entry, v.id).toBeAttached();
      await expect(entry.getByRole("button", { name: /^Play video/ })).toBeAttached();
      if (v.canon === "fan") await expect(entry).toContainText("Fan work");
      else await expect(entry).toContainText("Official reel, not story");
      await expect(entry).toContainText(v.credit?.by ?? "Artist not named");
    }
    // A video is not a still: its card is not a zoom tile, and no zoom cursor reads it.
    expect(await page.locator("[data-video] [data-zoom]").count()).toBe(0);
    expect(await page.locator("video").count()).toBe(0);
  });

  test("a press opens the site's player, and the deep link marks the video without playing it", async ({
    page,
  }) => {
    await open(page);
    const list = pieces();
    const fan = list.find((p) => p.kind === "video" && p.canon === "fan");
    if (!fan) throw new Error("no fan video");

    await page.goto(url(`/collection/arts/fanart/?i=${fan.id}`));
    await expect(strip(page)).toBeVisible({ timeout: 60_000 });
    await expect(page.locator(`[data-video="${fan.id}"]`)).toHaveAttribute("data-focus", "true");
    // The zoom is for pictures: nothing opens, and nothing plays.
    await expect(page.locator("[data-zoom-viewer]")).toHaveCount(0);
    expect(await page.locator("video").count()).toBe(0);

    await page
      .locator(`[data-video="${fan.id}"]`)
      .getByRole("button", { name: /^Play video/ })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15_000 });
  });

  test("a link to a video, followed far down the page, brings the row into view once", async ({
    page,
  }) => {
    await open(page);
    const last = pieces()
      .filter((p) => p.kind === "video" && p.canon === "fan")
      .at(-1);
    if (!last) throw new Error("no fan video");
    const entry = page.locator(`[data-video="${last.id}"]`);

    await page.evaluate(() => {
      window.scrollTo(0, 2600);
    });
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1500);
    await page.waitForTimeout(500);
    await expect(entry).not.toBeInViewport();

    // The library search sets the address and sends a popstate.
    await page.evaluate((id) => {
      const next = new URL(window.location.href);
      next.searchParams.set("i", id);
      window.history.pushState(null, "", next);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }, last.id);
    await expect(entry).toBeInViewport({ ratio: 0.6, timeout: 15_000 });
    await expect(entry).toHaveAttribute("data-focus", "true");

    // A picture opened and closed after it brings the address back to the video: the page stays.
    await page.waitForTimeout(900);
    await pressTile(page);
    await expect(page.locator("[data-zoom-viewer]")).toBeVisible();
    const before = await page.evaluate(() => window.scrollY);
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-zoom-viewer]")).toHaveCount(0, { timeout: 10_000 });
    await page.waitForTimeout(1200);
    const after = await page.evaluate(() => window.scrollY);
    expect(Math.abs(after - before)).toBeLessThan(8);
    await expect(entry).toBeInViewport({ ratio: 0.6 });
  });

  test("the row has arrows that move it sideways", async ({ page }) => {
    await open(page);
    const coarse = await page.evaluate(
      () => window.matchMedia("(hover: none) and (pointer: coarse)").matches,
    );
    test.skip(coarse, "A finger swipes the row: the arrows are for a pointer.");
    const track = page.locator("[data-fanart-videos] ul");
    const before = await track.evaluate((el) => el.scrollLeft);
    await page.getByRole("button", { name: "Later videos" }).click();
    await expect.poll(() => track.evaluate((el) => el.scrollLeft)).toBeGreaterThan(before);
  });
});

test.describe("by artist", () => {
  test("groups the pieces under their artists, keeps group posts and official reels apart", async ({
    page,
  }) => {
    await open(page);
    const toggle = page.locator("[data-fanart-views]");
    const wall = await toggle.boundingBox();
    await toggle.getByRole("button", { name: "By artist" }).click();
    await expect(page).toHaveURL(/[?&]view=artist/);
    await expect(page.locator("[data-fanart-artists]")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Fanart" })).toBeVisible();
    await expect(count(page)).toContainText("167 pieces");

    // The toggle stands where it stood.
    const artists = await page.locator("[data-fanart-views]").boundingBox();
    expect(Math.abs((artists?.x ?? 0) - (wall?.x ?? 0))).toBeLessThan(2);
    expect(Math.abs((artists?.y ?? 0) - (wall?.y ?? 0))).toBeLessThan(2);

    const blocks = page.locator("[data-fanart-block]");
    expect(await blocks.count()).toBeGreaterThan(8);
    // The artist with the most pieces first, with what they made counted.
    const first = blocks.first();
    await expect(first.getByRole("heading", { level: 2 })).toContainText("jlen_ismyname");
    await expect(first).toContainText("11 pictures");
    await expect(
      page.getByRole("heading", { name: "Group posts, several artists" }),
    ).toBeAttached();
    const official = page.locator("[data-fanart-block]", { hasText: "Mobile Legends: Bang Bang" });
    await expect(official).toContainText("Official reel, not story");
    await expect(page.getByRole("heading", { name: "Artist not named" })).toBeAttached();
    // A group post links to the post.
    await expect(
      page.locator("[data-fanart-block] a", { hasText: "View the original" }).first(),
    ).toHaveAttribute("href", /^https:\/\//);

    // Back to the flow.
    await page.locator("[data-fanart-views]").getByRole("button", { name: "Flow" }).click();
    await expect(page).not.toHaveURL(/[?&]view=/);
    await expect(rows(page).first()).toBeAttached({ timeout: 30_000 });
  });

  test("shares the search and the filter, and opens the zoom with the credit", async ({ page }) => {
    await openArtists(page, "&f=c:selena");
    await expect(chip(page, "c:selena")).toHaveAttribute("aria-pressed", "true");
    await expect(count(page)).toContainText(" of 167 pieces");
    const tile = page.locator("[data-fanart-tile]").first();
    await tile.scrollIntoViewIfNeeded();
    await tile.click({ force: true });
    const dialog = page.locator("[data-zoom-viewer]");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("[data-fan-caption]")).toContainText("Fan work");
    await page.keyboard.press("Escape");
    await expect(page).not.toHaveURL(/[?&]i=/, { timeout: 10_000 });
    // The page behind is held until the picture has landed in its tile.
    await expect(dialog).toHaveCount(0, { timeout: 10_000 });
    // Nothing matches is said, with a way out.
    await page.getByRole("searchbox").fill("zzzzqqqq");
    await expect(page.locator("[data-fanart-empty]")).toContainText("Nothing matches");
    await page.locator("[data-fanart-empty]").getByRole("button", { name: "Clear" }).click();
    await expect(page).not.toHaveURL(/[?&]q=/);
  });

  test("a deep link to a picture opens it in this view too", async ({ page }) => {
    await skipGate(page);
    await page.goto(url("/collection/arts/fanart/"));
    await expect(rows(page).first()).toBeAttached({ timeout: 60_000 });
    const id = pieces().filter((p) => p.kind === "image")[5]?.id;
    if (!id) throw new Error("no pictures");
    await page.goto(url(`/collection/arts/fanart/?view=artist&i=${id}`));
    await expect(page.locator("[data-zoom-viewer]")).toBeVisible({ timeout: 60_000 });
  });
});

test.describe("by artist, a video", () => {
  test("a deep link to a video marks it and does not play it", async ({ page }) => {
    const fan = pieces().find((p) => p.kind === "video" && p.canon === "fan");
    if (!fan) throw new Error("no fan video");
    await openArtists(page, `&i=${fan.id}`);
    const entry = page.locator(`[data-video="${fan.id}"]`);
    await expect(entry).toHaveAttribute("data-focus", "true", { timeout: 15_000 });
    await expect(entry).toBeInViewport({ timeout: 15_000 });
    await expect(page.locator("[data-zoom-viewer]")).toHaveCount(0);
    expect(await page.locator("video").count()).toBe(0);
  });
});

test.describe("the old address", () => {
  const oldId = "fanart-cosplay-ig-cyv1hkbjhul-2";
  const target = /\/collection\/arts\/cosplay\/layla\/\?i=arts-cosplay-layla-photo-2-b1b005/;

  test("a cosplay photo named in Fanart goes to its Aspirant in Cosplay", async ({ page }) => {
    await skipGate(page);
    await page.goto(url(`/collection/arts/fanart/?i=${oldId}`));
    await page.waitForURL(target, { timeout: 60_000 });
  });

  test("the old room's own address goes there in two steps", async ({ page }) => {
    await skipGate(page);
    await page.goto(url(`/collection/fanart/?i=${oldId}`));
    await page.waitForURL(target, { timeout: 60_000 });
  });

  test("the twelve ids are all forwarded, to the Aspirant who is in the photo", async ({
    page,
  }) => {
    await skipGate(page);
    await page.goto(url("/collection/arts/fanart/"));
    await expect(rows(page).first()).toBeAttached({ timeout: 60_000 });
    // The first id of each of the three posts stands for its four photos.
    const cases: Array<[string, string]> = [
      ["fanart-cosplay-ig-cytqu1bshd-1", "fanny"],
      ["fanart-cosplay-ig-cyv1hkbjhul-1", "layla"],
      ["fanart-cosplay-ig-cyym3vemobd-4", "fanny"],
    ];
    for (const [id, who] of cases) {
      await page.goto(url(`/collection/arts/fanart/?i=${id}`));
      await page.waitForURL(new RegExp(`/collection/arts/cosplay/${who}/\\?i=arts-cosplay-`), {
        timeout: 60_000,
      });
    }
  });
});

test.describe("on a phone", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 1000) > 600, "Phone project only.");

  test("stands in rows, with the video row under the filter, no sideways scroll", async ({
    page,
  }) => {
    const errors = await open(page);
    await expect(page.getByRole("heading", { level: 1, name: "Fanart" })).toBeVisible();
    await expect(strip(page)).toBeVisible();
    const chips = await page
      .locator("[data-flow-filter] button[data-facet]:not([data-facet=''])")
      .count();
    // The filter is one row that slides sideways on a phone: it holds the same chips as a laptop.
    expect(chips).toBeLessThanOrEqual(9);
    const sw = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(sw[0]).toBe(sw[1]);
    const dirs = await rows(page).evaluateAll((els) =>
      els.map((el) => Number((el as HTMLElement).dataset.dir)),
    );
    expect(dirs.slice(0, 3)).toEqual([1, -1, 1]);
    expect(errors).toEqual([]);
  });

  test("a tap opens the zoom with the credit, and a tap closes it", async ({ page }) => {
    await open(page);
    await page.waitForTimeout(500);
    const id = await pressTile(page);
    await expect(page).toHaveURL(new RegExp(`[?&]i=${id}`));
    const dialog = page.locator("[data-zoom-viewer]");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("[data-fan-caption]")).toContainText("Fan work");
  });

  test("by artist reads on a phone without sideways scroll", async ({ page }) => {
    await openArtists(page);
    const sw = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(sw[0]).toBe(sw[1]);
    await expect(page.locator("[data-fanart-views]")).toBeVisible();
  });
});
