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
