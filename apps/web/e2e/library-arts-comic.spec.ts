import { expect, test, type Page } from "@playwright/test";

import { skipGate, url } from "./helpers";

/**
 * The Comic room of Arts (`/collection/arts/comic/`): the panels of the two webtoons, without their
 * words, in lanes of one fixed width (two on a wide screen, one on a phone), with a search, a
 * filter by comic and by Aspirant, and the zoom. The checks are about structure and state (the lanes,
 * the sizes, what loads near, the address), not about pictures arriving: the files of the library
 * may not be in the bucket the run reads from.
 */

test.describe.configure({ timeout: 120_000 });

const tiles = (page: Page) => page.locator("[data-comic-tile]");
const count = (page: Page) => page.locator("[data-comic-count]");
const viewer = (page: Page) => page.locator("[data-zoom-viewer]");

const TALL = "arts-comic-layla-fires-while-flying-068327";
const NARROW = "arts-comic-fanny-after-the-fight-1abfa2";
const RIBBON = "arts-comic-a-star-and-an-angry-eye-b64777";
const FIRST = "arts-comic-giant-ender-over-a-burning-ruin-c7fc6c";

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
  await page.goto(url(`/collection/arts/comic/${query}`));
  await expect(tiles(page).first()).toBeAttached({ timeout: 60_000 });
  return errors;
}

interface Row {
  id: string;
  img: { w: number; h: number };
}

/** The panels of the room, in order, read from its data file. */
async function panels(page: Page): Promise<Row[]> {
  const res = await page.request.get(url("data/library/arts-comic.json"));
  return ((await res.json()) as { items: Row[] }).items;
}

interface Box {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** A strip that slides sideways (a phone): its tile is not the shape of its file. */
  pan: boolean;
}

/** Every tile's box on the page (CSS pixels from the top left of the page). */
async function boxes(page: Page): Promise<Box[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("[data-comic-tile]")].map((el) => {
      const r = el.getBoundingClientRect();
      return {
        id: el.dataset.id ?? "",
        x: r.left + window.scrollX,
        y: r.top + window.scrollY,
        w: r.width,
        h: r.height,
        pan: el.dataset.pan === "true",
      };
    }),
  );
}

const lanesOf = (page: Page) =>
  page.locator("[data-comic-field]").evaluate((el) => Number((el as HTMLElement).dataset.lanes));

async function scrollTo(page: Page, y: number) {
  await page.evaluate((to) => {
    window.scrollTo(0, to);
  }, y);
  await page.waitForTimeout(500);
}

const phone = () => test.info().project.name === "phone";

test.describe("comic: the page", () => {
  test("has the title, the count, the chips, the sub-page buttons, the way back and the takedown line", async ({
    page,
  }) => {
    const errors = await open(page);
    await expect(page.getByRole("heading", { level: 1, name: "Comic" })).toBeVisible();
    await expect(count(page)).toHaveText("114 panels");
    const chips = page.locator("[data-flow-filter] button");
    // All, the two comics and the four Aspirants.
    await expect(chips).toHaveCount(7);
    await expect(chips.first()).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("searchbox", { name: "Search panels" })).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Official art" });
    await expect(nav.getByRole("link", { name: "Comic" })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link")).toHaveCount(6);
    const back = page.locator("[data-room-back]");
    await expect(back).toHaveAttribute("href", /\/collection\/\?open=arts/);
    expect(errors).toEqual([]);
  });

  test("ends with the takedown line", async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
    });
    await expect(page.getByText("To ask for something to be taken down")).toBeVisible();
  });

  test("lists the 114 panels in the order of the file, as a list", async ({ page }) => {
    await open(page);
    const rows = await panels(page);
    expect(rows).toHaveLength(114);
    await expect(page.getByRole("list", { name: "Panels in reading order" })).toBeAttached();
    await expect(tiles(page)).toHaveCount(114);
    const ids = await tiles(page).evaluateAll((els) => els.map((el) => el.getAttribute("data-id")));
    expect(ids).toEqual(rows.map((r) => r.id));
  });
});

test.describe("comic: the lanes", () => {
  test("stand the panels in two lanes on a wide screen and one on a phone", async ({ page }) => {
    await open(page);
    expect(await lanesOf(page)).toBe(phone() ? 1 : 2);
  });

  test("have no sideways scroll", async ({ page }) => {
    await open(page);
    await scrollTo(page, 3000);
    const wide = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(wide).toBeLessThanOrEqual(0);
  });

  test("never overlap, never leave the box, and never draw a panel wider than its own pixels", async ({
    page,
  }) => {
    await open(page);
    const rows = await panels(page);
    const all = await boxes(page);
    expect(all).toHaveLength(rows.length);
    const field = await page.locator("[data-comic-field]").boundingBox();
    expect(field).not.toBeNull();
    for (const [i, b] of all.entries()) {
      expect(b.w, `panel ${String(i)} is wider than its file`).toBeLessThanOrEqual(
        rows[i]!.img.w + 1,
      );
      expect(b.x).toBeGreaterThanOrEqual(field!.x - 1);
      expect(b.x + b.w).toBeLessThanOrEqual(field!.x + field!.width + 1);
      // The shape of the file is the shape of the tile.
      if (!b.pan) expect(b.w / b.h).toBeCloseTo(rows[i]!.img.w / rows[i]!.img.h, 1);
    }
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i]!;
        const b = all[j]!;
        const apart =
          a.x + a.w <= b.x + 0.5 ||
          b.x + b.w <= a.x + 0.5 ||
          a.y + a.h <= b.y + 0.5 ||
          b.y + b.h <= a.y + 0.5;
        expect(apart, `panels ${String(i)} and ${String(j)} overlap`).toBe(true);
      }
    }
  });

  test("read down the page in the order of the file", async ({ page }) => {
    await open(page);
    const all = await boxes(page);
    for (let i = 1; i < all.length; i++) {
      expect(all[i]!.y).toBeGreaterThanOrEqual(all[i - 1]!.y - 1);
    }
  });

  test("show the tallest strip at the width of its lane, as tall as it is", async ({ page }) => {
    await open(page);
    const strip = (await boxes(page)).find((b) => b.id === TALL);
    expect(strip).toBeDefined();
    // 1000 by 4163 pixels.
    expect(strip!.h / strip!.w).toBeCloseTo(4.163, 1);
    expect(strip!.w).toBeGreaterThanOrEqual(phone() ? 300 : 340);
    expect(strip!.h).toBeGreaterThan(1400);
  });

  test("keep a narrow source at its own size, in the middle of its lane", async ({ page }) => {
    await open(page);
    const narrow = (await boxes(page)).find((b) => b.id === NARROW);
    expect(narrow).toBeDefined();
    expect(narrow!.w).toBeLessThanOrEqual(342.5);
    const field = (await page.locator("[data-comic-field]").boundingBox())!;
    const centre = narrow!.x + narrow!.w / 2 - field.x;
    if (phone()) {
      expect(centre).toBeCloseTo(field.width / 2, 0);
    } else {
      // The middle of the left lane or of the right one (a lane is a little under a quarter and a half wide).
      const fromLeft = Math.abs(centre - field.width / 4);
      const fromRight = Math.abs(centre - (3 * field.width) / 4);
      expect(Math.min(fromLeft, fromRight)).toBeLessThan(10);
    }
  });

  test("let a very wide strip take both lanes on a wide screen and slide on a phone", async ({
    page,
  }) => {
    await open(page);
    const tile = page.locator(`[data-id="${RIBBON}"]`);
    if (phone()) {
      await expect(tile).toHaveAttribute("data-pan", "true");
      const slides = await tile
        .locator("span")
        .first()
        .evaluate((el) => ({
          scroll: el.scrollWidth,
          client: el.clientWidth,
        }));
      expect(slides.scroll).toBeGreaterThan(slides.client + 50);
      const box = (await boxes(page)).find((b) => b.id === RIBBON)!;
      // Taller than the screen's width would make it.
      expect(box.h).toBeGreaterThan(box.w / 3.2 + 40);
    } else {
      await expect(tile).toHaveAttribute("data-span", "true");
      const lane = (await boxes(page)).find((b) => b.id === TALL)!;
      const box = (await boxes(page)).find((b) => b.id === RIBBON)!;
      expect(box.w).toBeGreaterThan(lane.w * 1.2);
    }
  });

  test("keep the height of the page when it is scrolled to the end", async ({ page }) => {
    await open(page);
    const before = await page.evaluate(() => document.documentElement.scrollHeight);
    await scrollTo(page, before);
    await scrollTo(page, before / 2);
    const after = await page.evaluate(() => document.documentElement.scrollHeight);
    expect(Math.abs(after - before)).toBeLessThanOrEqual(1);
  });

  test("load pictures only near the screen", async ({ page }) => {
    await open(page);
    await page.waitForTimeout(800);
    const near = await page.locator("[data-comic-tile] img").count();
    expect(near).toBeGreaterThan(0);
    expect(near).toBeLessThan(60);
    // The last panel is far from the first screen and has no picture yet.
    await expect(tiles(page).last().locator("img")).toHaveCount(0);
    // Further down, the tiles that were near have let go of their pictures.
    await scrollTo(page, 20000);
    await expect(tiles(page).first().locator("img")).toHaveCount(0);
  });
});

test.describe("comic: the filter and the search", () => {
  test("filter by a comic and by an Aspirant, and the address follows", async ({ page }) => {
    await open(page);
    await page.locator("[data-flow-filter] [data-facet='guinevere-vexana']").click();
    await expect(count(page)).toHaveText("49 of 114 panels");
    await expect(tiles(page)).toHaveCount(49);
    expect(page.url()).toContain("f=guinevere-vexana");
    await page.locator("[data-flow-filter] [data-facet='layla']").click();
    await expect(count(page)).toHaveText("27 of 114 panels");
    await expect(tiles(page)).toHaveCount(27);
    await page.locator("[data-flow-filter] [data-facet='']").click();
    await expect(tiles(page)).toHaveCount(114);
    expect(page.url()).not.toContain("f=");
  });

  test("a filter in the address is read, and an unknown one is left out", async ({ page }) => {
    await open(page, "?f=fanny");
    await expect(tiles(page)).toHaveCount(24);
    await page.goto(url("/collection/arts/comic/?f=nobody"));
    await expect(tiles(page)).toHaveCount(114);
  });

  test("search finds by title, comic and page", async ({ page }) => {
    await open(page);
    const box = page.getByRole("searchbox", { name: "Search panels" });
    await box.fill("droid");
    await expect(count(page)).toContainText("of 114 panels");
    const n = await tiles(page).count();
    expect(n).toBeGreaterThan(2);
    expect(n).toBeLessThan(40);
    expect(page.url()).toContain("q=droid");
    await box.fill("guinevere and vexana page 12");
    const labels = () =>
      tiles(page).evaluateAll((els) => els.map((el) => el.getAttribute("aria-label") ?? ""));
    await expect
      .poll(async () => {
        const rows = await labels();
        return rows.length > 0 && rows.every((l) => /^Guinevere and Vexana, page \d*12/.test(l));
      })
      .toBe(true);
  });

  test("a search with no match says so and can be cleared", async ({ page }) => {
    await open(page);
    await page.getByRole("searchbox", { name: "Search panels" }).fill("zzzzzz");
    await expect(page.locator("[data-comic-empty]")).toBeVisible();
    await expect(tiles(page)).toHaveCount(0);
    await page.locator("[data-comic-empty] button", { hasText: "Clear" }).click();
    await expect(tiles(page)).toHaveCount(114);
    expect(page.url()).not.toContain("q=");
  });

  test("a new result starts at the top", async ({ page }) => {
    await open(page);
    await scrollTo(page, 6000);
    // A press made from the page itself: the chip is far above the screen and must not be scrolled to.
    await page.locator("[data-flow-filter] [data-facet='fanny']").evaluate((el) => {
      (el as HTMLElement).click();
    });
    await expect
      .poll(() => page.evaluate(() => window.scrollY), { timeout: 5_000 })
      .toBeLessThan(10);
  });
});

test.describe("comic: the zoom", () => {
  test("a press opens the panel, the arrows step, Esc closes and the address follows", async ({
    page,
  }) => {
    await open(page);
    await page.locator(`[data-id="${FIRST}"]`).click();
    await expect(viewer(page)).toBeVisible();
    expect(page.url()).toContain(`i=${FIRST}`);
    await expect(viewer(page)).toContainText("The Aspirant, page 1");
    await expect(viewer(page)).toContainText("giant black Ender");
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => page.url()).not.toContain(FIRST);
    await expect(viewer(page)).toContainText("The Aspirant, page 2");
    await page.keyboard.press("Escape");
    await expect(viewer(page)).toHaveCount(0, { timeout: 10_000 });
    expect(page.url()).not.toContain("i=");
  });

  test("a tall strip opens fitted to the width and is read by scrolling", async ({ page }) => {
    await open(page);
    await page.locator(`[data-id="${FIRST}"]`).click();
    await expect(viewer(page)).toBeVisible();
    const scroller = viewer(page).locator("[data-scroll]").first();
    // The strip takes the scroll once it has opened.
    await expect(scroller).toHaveAttribute("data-scroll", "true", { timeout: 10_000 });
    await expect
      .poll(() => scroller.evaluate((el) => el.scrollHeight - el.clientHeight), { timeout: 10_000 })
      .toBeGreaterThan(300);
    // The picture is as wide as the screen.
    const width = await scroller.evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
    expect(width).toBe(true);
    const before = await scroller.evaluate((el) => el.scrollTop);
    await scroller.evaluate((el) => {
      el.scrollTop = 600;
    });
    expect(await scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(before);
  });

  test("a wide panel opens whole, not scrolled", async ({ page }) => {
    await open(page);
    await page.locator(`[data-id="${RIBBON}"]`).scrollIntoViewIfNeeded();
    await page.locator(`[data-id="${RIBBON}"]`).click();
    await expect(viewer(page)).toBeVisible();
    await expect(viewer(page)).toContainText("page 38");
    const scrollable = await viewer(page)
      .locator("[data-scroll]")
      .first()
      .evaluate((el) => el.scrollHeight > el.clientHeight + 2);
    expect(scrollable).toBe(false);
  });

  test("a deep link opens the picture and brings its tile into view for the way back", async ({
    page,
  }) => {
    await open(page, `?i=${RIBBON}`);
    await expect(viewer(page)).toBeVisible({ timeout: 20_000 });
    await expect(viewer(page)).toContainText("page 38");
    await page.keyboard.press("Escape");
    await expect(viewer(page)).toHaveCount(0, { timeout: 10_000 });
    expect(page.url()).not.toContain("i=");
    const inView = await page.locator(`[data-id="${RIBBON}"]`).evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.bottom > 0 && r.top < window.innerHeight;
    });
    expect(inView).toBe(true);
  });

  test("after the arrows have gone far down, closing lands on that panel", async ({ page }) => {
    await open(page);
    await page.locator(`[data-id="${FIRST}"]`).click();
    await expect(viewer(page)).toBeVisible();
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(300);
    }
    const id = new URL(page.url()).searchParams.get("i") ?? "";
    expect(id).not.toBe("");
    expect(id).not.toBe(FIRST);
    // The page behind has followed the arrows.
    const behind = await page.evaluate(() => window.scrollY);
    expect(behind).toBeGreaterThan(1000);
    await page.keyboard.press("Escape");
    await expect(viewer(page)).toHaveCount(0, { timeout: 10_000 });
    // The browser would put the page back where it stood when the viewer opened: it must not.
    expect(Math.abs((await page.evaluate(() => window.scrollY)) - behind)).toBeLessThan(40);
    const inView = await page.locator(`[data-id="${id}"]`).evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.bottom > 0 && r.top < window.innerHeight;
    });
    expect(inView).toBe(true);
  });

  test("Back closes the viewer", async ({ page }) => {
    await open(page);
    await page.locator(`[data-id="${FIRST}"]`).click();
    await expect(viewer(page)).toBeVisible();
    await page.goBack();
    await expect(viewer(page)).toHaveCount(0, { timeout: 10_000 });
  });

  test("the viewer steps through the filtered panels only", async ({ page }) => {
    await open(page, "?f=guinevere-vexana");
    await tiles(page).first().click();
    await expect(viewer(page)).toBeVisible();
    await expect(viewer(page)).toContainText("01 / 49");
  });
});
