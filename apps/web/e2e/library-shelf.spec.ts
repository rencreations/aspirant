import { expect, test, type Page } from "@playwright/test";

import { restPose, shelfGeometry } from "../src/features/library/shelf/layout";
import { sitePath, skipGate, url, watchErrors } from "./helpers";

/** The scene needs a moment after the load: fonts, ten covers, the first frame, the drop. */
async function openShelf(page: Page) {
  await skipGate(page);
  await page.goto(url("/collection/"));
  await page.waitForSelector("canvas[style*='touch-action']", { timeout: 20_000 });
  // The covers have landed when the index row has faded in.
  await page.waitForFunction(
    () => {
      const stage = document.querySelector<HTMLElement>("[data-entered='true']");
      return stage !== null;
    },
    undefined,
    { timeout: 20_000 },
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
      .poll(() => sitePath(page, baseURL), { timeout: 20_000 })
      .toMatch(/^\/collection\/design\/?$/);
  });

  test("the index row is the keyboard path", async ({ page, baseURL }, info) => {
    test.skip(info.project.name === "phone", "desktop shelf");
    await openShelf(page);
    const first = page.locator("[data-shelf-entry='arts']");
    await first.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("[data-shelf-entry='films']")).toBeFocused();
    await expect(page.locator("[data-shelf-entry='films'][data-active='true']")).toHaveCount(1);
    await page.keyboard.press("ArrowDown");
    await expect(page.locator("[data-shelf-entry='lore']")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-focus='true']")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-focus='true']")).toHaveCount(0);
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await expect
      .poll(() => sitePath(page, baseURL), { timeout: 20_000 })
      .toMatch(/^\/collection\/[a-z]+\/?$/);
  });

  test("the search button opens the library search", async ({ page }) => {
    await openShelf(page);
    await page.getByRole("button", { name: /Search the collection/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
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
      .poll(() => sitePath(page, baseURL), { timeout: 20_000 })
      .toMatch(/^\/collection\/arts\/?$/);
    expect(errors.filter((e) => !/404|Failed to load resource/.test(e))).toEqual([]);
  });
});
