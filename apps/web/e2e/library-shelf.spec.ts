import { expect, test, type Page } from "@playwright/test";

import { restPose, shelfGeometry } from "../src/features/library/shelf/layout";
import { sitePath, skipGate, url, watchErrors } from "./helpers";

/** The scene needs a moment after the load: fonts, ten covers, the first frame, the drop. */
async function openShelf(page: Page, query = "") {
  await skipGate(page);
  await page.goto(url(`/collection/${query}`));
  await page.waitForSelector("canvas[style*='touch-action']", { timeout: 60_000 });
  // The covers have landed when the index row has faded in.
  await page.waitForFunction(
    () => {
      const stage = document.querySelector<HTMLElement>("[data-entered='true']");
      return stage !== null;
    },
    undefined,
    { timeout: 60_000 },
  );
}

test.describe("the shelf", () => {
  test("is one screen with ten links in the page and one scene", async ({ page }) => {
    const errors = watchErrors(page);
    await openShelf(page);
    const overflow = await page.evaluate(() => {
      const el = document.scrollingElement ?? document.documentElement;
      return { y: el.scrollHeight - window.innerHeight, x: el.scrollWidth - window.innerWidth };
    });
    expect(overflow.y).toBeLessThanOrEqual(1);
    expect(overflow.x).toBeLessThanOrEqual(1);
    // The index row: ten entries, in shelf order, each a real link.
    const entries = page.locator("[data-shelf-entry]");
    await expect(entries).toHaveCount(10);
    await expect(entries.first()).toHaveAttribute("href", /\/collection\/arts\/?$/);
    await expect(entries.last()).toHaveAttribute("href", /\/collection\/others\/?$/);
    // The tagline and the search button are on the page.
    await expect(page.getByText("Everything made for Aspirant.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Search the collection/ })).toBeVisible();
    // One scene canvas; the plain list is out of reach while it runs.
    await expect(page.locator("canvas[style*='touch-action']")).toHaveCount(1);
    expect(await page.locator("[inert] a[href*='/collection/']").count()).toBe(10);
    // The only failure allowed is the optional library index (built later).
    expect(errors.filter((e) => !/404|Failed to load resource/.test(e))).toEqual([]);
  });

  test("hover shows the two pills, Details focuses, Esc goes back, Open leaves", async ({
    page,
    baseURL,
  }, info) => {
    test.skip(info.project.name === "phone", "desktop shelf");
    await openShelf(page);
    const size = page.viewportSize() ?? { width: 1440, height: 900 };
    // The middle of the Design cover (the eighth, second row), from the same maths the scene uses.
    const g = shelfGeometry(size.width, size.height);
    const pose = restPose(7, g);
    const x = size.width / 2 + pose.x;
    const y = size.height / 2 - (pose.y + g.size * 0.45);
    await page.mouse.move(x - 20, y - 20);
    await page.mouse.move(x, y, { steps: 6 });
    const pills = page.locator("[data-show='true'] >> button:text-is('Details')");
    await expect(pills).toBeVisible();
    await pills.click();
    const stage = page.locator("[data-focus='true']");
    await expect(stage).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 2, name: "Design" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-focus='true']")).toHaveCount(0);
    // Click the cover, then Open under it.
    await page.mouse.move(x - 30, y - 10, { steps: 4 });
    await page.mouse.click(x - 30, y - 10);
    await expect(page.locator("[data-focus='true']")).toHaveCount(1);
    await page.locator("[data-show='true'] >> button:text-is('Open')").first().click();
    await expect
      .poll(() => sitePath(page, baseURL), { timeout: 60_000 })
      .toMatch(/^\/collection\/design\/?$/);
  });

  test("the index row is the keyboard path", async ({ page, baseURL }, info) => {
    test.skip(info.project.name === "phone", "desktop shelf");
    await openShelf(page);
    const first = page.locator("[data-shelf-entry='arts']");
    await first.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("[data-shelf-entry='video']")).toBeFocused();
    await expect(page.locator("[data-shelf-entry='video'][data-active='true']")).toHaveCount(1);
    await page.keyboard.press("ArrowDown");
    await expect(page.locator("[data-shelf-entry='lore']")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-focus='true']")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-focus='true']")).toHaveCount(0);
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await expect
      .poll(() => sitePath(page, baseURL), { timeout: 60_000 })
      .toMatch(/^\/collection\/[a-z]+\/?$/);
  });

  test("the search button opens the library search", async ({ page }) => {
    await openShelf(page);
    await page.getByRole("button", { name: /Search the collection/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});

/** The open Video cover: the stage says so and both halves show their Open button. */
async function expectSplitOpen(page: Page) {
  await expect(page.locator("[data-split='open']")).toHaveCount(1, { timeout: 15_000 });
  await expect(page.locator("[data-video-open='films']")).toBeVisible();
  await expect(page.locator("[data-video-open='others']")).toBeVisible();
  expect(new URL(page.url()).searchParams.get("open")).toBe("video");
}

async function expectSplitShut(page: Page) {
  await expect(page.locator("[data-split]")).toHaveCount(0, { timeout: 15_000 });
  expect(new URL(page.url()).searchParams.get("open")).toBeNull();
}

test.describe("the Video cover", () => {
  test("splits in two on a press, stays on the shelf, and shuts with Esc", async ({
    page,
    baseURL,
  }, info) => {
    test.skip(info.project.name === "phone", "desktop shelf");
    const errors = watchErrors(page);
    await openShelf(page);
    await expect(page.locator("[data-shelf-entry='video']")).toHaveAttribute(
      "href",
      /\/collection\/video\/?$/,
    );
    // Press the cover itself (the second of row one), from the same maths the scene uses.
    const size = page.viewportSize() ?? { width: 1440, height: 900 };
    const g = shelfGeometry(size.width, size.height);
    const pose = restPose(1, g);
    const x = size.width / 2 + pose.x;
    const y = size.height / 2 - (pose.y + g.size * 0.45);
    await page.mouse.move(x - 20, y - 20);
    await page.mouse.click(x, y);
    await expectSplitOpen(page);
    expect(sitePath(page, baseURL)).toMatch(/^\/collection\/?$/);
    // The halves say what they are; the focus view's single Open is gone.
    await expect(page.locator("[data-video-half='films']")).toContainText("one by one");
    await expect(page.locator("[data-video-half='others']")).toContainText("easy to browse");
    await expect(page.locator("[data-video-back]:visible")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expectSplitShut(page);
    await expect(page.locator("[data-focus='true']")).toHaveCount(0);
    expect(errors.filter((e) => !/404|Failed to load resource/.test(e))).toEqual([]);
  });

  test("shuts on a click outside and on Back", async ({ page }, info) => {
    test.skip(info.project.name === "phone", "desktop shelf");
    await openShelf(page);
    await page.locator("[data-shelf-entry='video']").click();
    await expectSplitOpen(page);
    // A click on the words under a half is not a click outside.
    await page.locator("[data-video-half='films'] p").click();
    await page.waitForTimeout(400);
    await expect(page.locator("[data-split='open']")).toHaveCount(1);
    const size = page.viewportSize() ?? { width: 1440, height: 900 };
    await page.mouse.click(Math.round(size.width * 0.04), Math.round(size.height * 0.55));
    await expectSplitShut(page);
    await page.locator("[data-shelf-entry='video']").click();
    await expectSplitOpen(page);
    await page.locator("[data-video-back]:visible").click();
    await expectSplitShut(page);
  });

  test("the keyboard opens it, moves between the halves and opens Others", async ({
    page,
    baseURL,
  }, info) => {
    test.skip(info.project.name === "phone", "desktop shelf");
    await openShelf(page);
    await page.locator("[data-shelf-entry='arts']").focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("[data-shelf-entry='video']")).toBeFocused();
    await page.keyboard.press("Enter");
    await expectSplitOpen(page);
    // Once it has opened, the focus is on the first half's Open.
    await expect(page.locator("[data-video-open='films']")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("[data-video-open='others']")).toBeFocused();
    await expect(page.locator("[data-video-half='others'][data-active='true']")).toHaveCount(1);
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator("[data-video-open='films']")).toBeFocused();
    await page.keyboard.press("Escape");
    await expectSplitShut(page);
    await expect(page.locator("[data-shelf-entry='video']")).toBeFocused();
    await page.keyboard.press("Enter");
    await expectSplitOpen(page);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    await expect
      .poll(() => sitePath(page, baseURL), { timeout: 60_000 })
      .toMatch(/^\/collection\/video\/others\/?$/);
  });

  test("opens from the address, and Open on Films leads to the Films room", async ({
    page,
    baseURL,
  }, info) => {
    test.skip(info.project.name === "phone", "desktop shelf");
    await openShelf(page, "?open=video");
    await expectSplitOpen(page);
    await page.locator("[data-video-open='films']").click();
    await expect
      .poll(() => sitePath(page, baseURL), { timeout: 60_000 })
      .toMatch(/^\/collection\/video\/films\/?$/);
  });

  test("the browser's Back from a Video room comes back to the open cover", async ({
    page,
    baseURL,
  }, info) => {
    test.skip(info.project.name !== "desktop", "one run is enough");
    await openShelf(page);
    await page.locator("[data-shelf-entry='video']").click();
    await expectSplitOpen(page);
    await page.locator("[data-video-open='others']").click();
    await expect
      .poll(() => sitePath(page, baseURL), { timeout: 60_000 })
      .toMatch(/^\/collection\/video\/others\/?$/);
    await page.goBack();
    await page.waitForSelector("[data-entered='true']", { timeout: 60_000 });
    await expectSplitOpen(page);
  });
});

test.describe("the plain Video page", () => {
  test("has one heading, two rooms as links and the way back", async ({ page }) => {
    await skipGate(page);
    await page.goto(url("/collection/video/"));
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveText("Video");
    await expect(page.locator("[data-video-tile='films']")).toHaveAttribute(
      "href",
      /\/collection\/video\/films\/?$/,
    );
    await expect(page.locator("[data-video-tile='others']")).toHaveAttribute(
      "href",
      /\/collection\/video\/others\/?$/,
    );
    await expect(page.locator("[data-room-back]")).toHaveAttribute("href", /\/collection\/?$/);
    await expect(page.getByText("To ask for something to be taken down")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

test.describe("the shelf on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("is a stack with the name and two buttons", async ({ page, baseURL }, info) => {
    test.skip(info.project.name !== "phone", "one run is enough");
    const errors = watchErrors(page);
    await openShelf(page);
    await expect(page.getByRole("button", { name: "Details" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Open" }).first()).toBeVisible();
    await expect(page.getByText("Arts", { exact: true }).first()).toBeVisible();
    const overflow = await page.evaluate(() => {
      const el = document.scrollingElement ?? document.documentElement;
      return el.scrollHeight - window.innerHeight;
    });
    expect(overflow).toBeLessThanOrEqual(1);
    await page.getByRole("button", { name: "Details" }).first().click();
    await expect(page.locator("[data-focus='true']")).toHaveCount(1);
    await page.locator("[data-show='true'] >> button:text-is('Open')").first().click();
    await expect
      .poll(() => sitePath(page, baseURL), { timeout: 60_000 })
      .toMatch(/^\/collection\/arts\/?$/);
    expect(errors.filter((e) => !/404|Failed to load resource/.test(e))).toEqual([]);
  });

  test("opens the Video cover into two stacked halves, with Back in the bar", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "phone", "one run is enough");
    await openShelf(page, "?open=video");
    await expectSplitOpen(page);
    const films = await page.locator("[data-video-half='films']").boundingBox();
    const others = await page.locator("[data-video-half='others']").boundingBox();
    // One above the other, and both inside the screen.
    expect(films && others && films.y < others.y).toBe(true);
    expect(others ? others.y + others.height : 0).toBeLessThanOrEqual(844);
    const overflow = await page.evaluate(() => {
      const el = document.scrollingElement ?? document.documentElement;
      return el.scrollHeight - window.innerHeight;
    });
    expect(overflow).toBeLessThanOrEqual(1);
    await page.locator("[data-video-back]:visible").click();
    await expectSplitShut(page);
  });
});

// Small screens: nothing overlaps -------------------------------------------------------------------
//
// On a phone the Search and Continue buttons stand in a row under the tagline, and the phone has its
// name bar at the foot. The focused cover and the open Video cover keep clear of them, on every phone
// size and on a phone on its side (a short screen: the index row steps aside, the halves lose their
// line). The cover and the halves are drawn in WebGL, so their boxes are read from `window.__shelf`.

interface Edge {
  l: number;
  t: number;
  r: number;
  b: number;
}

const apart = (a: Edge | null, b: Edge | null): boolean =>
  a === null ||
  b === null ||
  a.r <= b.l + 0.5 ||
  a.l >= b.r - 0.5 ||
  a.b <= b.t + 0.5 ||
  a.t >= b.b - 0.5;

/** The box of an element as drawn, or null when it is hidden, transparent or not laid out. */
async function drawnBox(page: Page, selector: string): Promise<Edge | null> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    for (let n: Element | null = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) < 0.05) {
        return null;
      }
    }
    const r = el.getBoundingClientRect();
    return r.width === 0 ? null : { l: r.left, t: r.top, r: r.right, b: r.bottom };
  }, selector);
}

/** A box the scene reports (`focus`, `films`, `others`) once it has stopped moving. */
async function sceneBox(page: Page, key: "focus" | "films" | "others"): Promise<Edge> {
  let prev = "";
  let still = 0;
  for (let i = 0; i < 80 && still < 5; i += 1) {
    const cur = JSON.stringify(
      await page.evaluate((k) => {
        const scene = (
          window as unknown as {
            __shelf?: Record<
              string,
              { left: number; top: number; right: number; bottom: number } | null
            >;
          }
        ).__shelf;
        const r = scene?.[k];
        return r ? { l: r.left, t: r.top, r: r.right, b: r.bottom } : null;
      }, key),
    );
    still = cur === prev && cur !== "null" ? still + 1 : 0;
    prev = cur;
    await page.waitForTimeout(100);
  }
  expect(prev, `the scene reports a box for ${key}`).not.toBe("null");
  return JSON.parse(prev) as Edge;
}

/** Everything of the HTML over the scene that a cover must not cover. */
async function controlsOf(page: Page) {
  return {
    search: await drawnBox(page, "[data-shelf-top] button"),
    tagline: await drawnBox(page, "[data-shelf-top] p"),
    next: await drawnBox(page, "[data-shelf-continue]"),
    index: await drawnBox(page, "[data-shelf-index]"),
    bar: [
      await drawnBox(page, "[data-shelf-bartext] > *:nth-child(1)"),
      await drawnBox(page, "[data-shelf-bartext] > *:nth-child(2)"),
      await drawnBox(page, "[data-shelf-bartext] > *:nth-child(3)"),
    ],
  };
}

/** True when the point in the middle of the element is the element's own (nothing is drawn over it). */
async function reachable(page: Page, selector: string): Promise<boolean> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return hit !== null && el.contains(hit);
  }, selector);
}

const SMALL_SCREENS: Array<[number, number]> = [
  [390, 844],
  [360, 640],
  [375, 667],
  [844, 390],
];

for (const [w, h] of SMALL_SCREENS) {
  test.describe(`the shelf on a ${w}x${h} screen`, () => {
    test.use({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });

    test("the focused cover keeps clear of Search, Continue and the foot", async ({
      page,
    }, info) => {
      test.skip(info.project.name !== "phone", "one run is enough");
      await openShelf(page);
      if (w < 700) await page.getByRole("button", { name: "Details" }).first().tap();
      // On a wider screen a touch has no hover to show Details: the index row focuses the cover.
      else
        await page.evaluate(() =>
          document.querySelector<HTMLElement>("[data-shelf-entry='design']")?.click(),
        );
      await expect(page.locator("[data-focus='true']")).toHaveCount(1);
      const cover = await sceneBox(page, "focus");
      const c = await controlsOf(page);
      const pill = await drawnBox(page, "[data-show='true'] button");
      expect(pill, "the Open button is under the cover").not.toBeNull();

      expect(c.search, "Search stays on the screen").not.toBeNull();
      expect(c.next, "Continue stays on the screen").not.toBeNull();
      expect(apart(cover, c.search), "the cover is clear of Search").toBe(true);
      expect(apart(cover, c.next), "the cover is clear of Continue").toBe(true);
      expect(apart(cover, c.tagline), "the cover is clear of the tagline").toBe(true);
      // The Open button under it keeps off the name bar (a phone) and the index row (wider).
      for (const b of [...c.bar, c.index])
        expect(apart(pill, b), "Open is clear of the foot").toBe(true);
      expect(pill?.b ?? 0).toBeLessThanOrEqual(h);
      // The cover is whole on the screen and still large.
      expect(cover.l).toBeGreaterThanOrEqual(0);
      expect(cover.r).toBeLessThanOrEqual(w);
      expect(cover.t).toBeGreaterThanOrEqual(0);
      expect(cover.r - cover.l).toBeGreaterThanOrEqual(Math.min(w, h) * 0.33);
      // A short screen has no room for the index row under a focused cover: it steps aside.
      if (h < 540 && w >= 700) expect(c.index, "the index row steps aside").toBeNull();
      // Every control is still there to press.
      expect(await reachable(page, "[data-shelf-continue]")).toBe(true);
      expect(await reachable(page, "[data-shelf-top] button")).toBe(true);
      // Esc puts the shelf back, with the index row (or the phone's bar) as before.
      await page.keyboard.press("Escape");
      await expect(page.locator("[data-focus='true']")).toHaveCount(0);
    });

    test("the open Video cover keeps clear of Continue and fits its captions and Back", async ({
      page,
    }, info) => {
      test.skip(info.project.name !== "phone", "one run is enough");
      await openShelf(page);
      await page.evaluate(() =>
        document.querySelector<HTMLElement>("[data-shelf-entry='video']")?.click(),
      );
      await expectSplitOpen(page);
      const films = await sceneBox(page, "films");
      const others = await sceneBox(page, "others");
      const c = await controlsOf(page);
      const films$ = await drawnBox(page, "[data-video-half='films']");
      const others$ = await drawnBox(page, "[data-video-half='others']");
      const openF = await drawnBox(page, "[data-video-open='films']");
      const openO = await drawnBox(page, "[data-video-open='others']");
      // A phone has Back in its bar; a wider screen has it under the pair.
      const back = await drawnBox(
        page,
        w < 700
          ? "button[data-video-back][data-split-ui]"
          : "[data-split-ui] > button[data-video-back]",
      );
      expect(back, "Back is on the screen").not.toBeNull();

      // The two pictures keep clear of every control that is shown (a phone hides Search and the tagline).
      for (const pic of [films, others]) {
        expect(apart(pic, c.next), "a half is clear of Continue").toBe(true);
        expect(apart(pic, c.search), "a half is clear of Search").toBe(true);
        expect(apart(pic, c.tagline), "a half is clear of the tagline").toBe(true);
        for (const b of [...c.bar, c.index])
          expect(apart(pic, b), "a half is clear of the foot").toBe(true);
      }
      // Each caption sits under its own picture and the two never touch.
      expect(apart(films, films$)).toBe(true);
      expect(apart(others, others$)).toBe(true);
      expect(apart(films$, others$), "the captions do not overlap").toBe(true);
      expect(apart(films$, others)).toBe(true);
      expect(apart(others$, films)).toBe(true);
      // Back is clear of both Open buttons, both captions and the two pictures.
      for (const b of [openF, openO, films$, others$, films, others]) {
        expect(apart(back, b), "Back is clear of the halves").toBe(true);
      }
      for (const b of [...c.bar, c.index]) expect(apart(openF, b) && apart(openO, b)).toBe(true);
      // Everything is on the screen.
      for (const b of [films, others, films$, others$, back, openF, openO]) {
        expect(b?.l ?? 0).toBeGreaterThanOrEqual(0);
        expect(b?.t ?? 0).toBeGreaterThanOrEqual(0);
        expect(b?.r ?? 0).toBeLessThanOrEqual(w + 0.5);
        expect(b?.b ?? 0).toBeLessThanOrEqual(h + 0.5);
      }
      expect(await reachable(page, "[data-video-open='films']")).toBe(true);
      expect(await reachable(page, "[data-video-open='others']")).toBe(true);
      expect(await reachable(page, "[data-shelf-continue]")).toBe(true);
      const overflow = await page.evaluate(() => {
        const el = document.scrollingElement ?? document.documentElement;
        return { x: el.scrollWidth - window.innerWidth, y: el.scrollHeight - window.innerHeight };
      });
      expect(overflow.x).toBeLessThanOrEqual(1);
      expect(overflow.y).toBeLessThanOrEqual(1);
      // Back shuts it.
      await page.locator("[data-video-back]:visible").first().tap();
      await expectSplitShut(page);
    });
  });
}
