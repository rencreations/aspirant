import { expect, test, type Page } from "@playwright/test";

import { skipGate, url, watchErrors } from "./helpers";

/**
 * The fanart room: a wall of fan art and cosplay, a row of fan videos, a By artist view, filters
 * kept in the address, and the viewer with the credit of every piece. It does not play a video:
 * the test browser may lack H.264 and AAC.
 */

test.describe.configure({ timeout: 120_000 });

async function open(page: Page, query = "") {
  await skipGate(page);
  const errors = watchErrors(page);
  await page.goto(url(`/collection/fanart/${query}`));
  await page.waitForLoadState("networkidle");
  await expect(page.locator("h1")).toHaveText("Fanart");
  return errors;
}

const overflow = (page: Page) =>
  page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return el.scrollWidth - window.innerWidth;
  });

const summary = (page: Page) =>
  page
    .getByRole("status")
    .filter({ hasText: /pictures?/ })
    .first();

const tiles = (page: Page) => page.locator("li[data-visible='true'] button[data-tile]");

test("draws the wall and the video row with one h1 and no errors", async ({ page }) => {
  const errors = await open(page);
  await expect(page.getByRole("heading", { level: 2, name: "Fan videos" })).toBeVisible();
  await expect(tiles(page).first()).toBeVisible();
  await expect(summary(page)).toContainText("161 pictures and 18 videos");
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});

test("every tile and video names its maker, with the fan badge", async ({ page }) => {
  await open(page);
  const first = tiles(page).first();
  await first.hover();
  await expect(first.getByText("Fan work")).toBeVisible();
  const label = await first.getAttribute("aria-label");
  expect(label).toMatch(/ on (Instagram|DeviantArt|TikTok|Reddit|Facebook|X|Pixiv)/);
  await expect(
    page
      .locator("article[data-video]")
      .first()
      .getByText(/Fan work|Official reel/),
  ).toBeVisible();
});

test("filters narrow the wall, keep the address and clear", async ({ page }) => {
  await open(page);
  await page
    .getByRole("group", { name: "Character" })
    .getByRole("button", { name: /^Selena/ })
    .click();
  expect(new URL(page.url()).searchParams.get("who")).toBe("selena");
  await expect(summary(page)).toContainText("match");
  const count = await tiles(page).count();
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThan(100);

  // A chip with no matches is disabled (Selena has no cosplay), so narrow it with a search instead.
  await page.getByRole("searchbox").fill("zzzzqq");
  await expect(page.getByText("Nothing matches.")).toBeVisible();
  await page.getByRole("button", { name: "Clear the filters" }).first().click();
  await expect(summary(page)).toContainText("161 pictures and 18 videos");
  expect(new URL(page.url()).search).toBe("");
});

test("search finds a piece by its artist", async ({ page }) => {
  await open(page);
  await page.getByRole("searchbox").fill("rakuryuchi");
  await expect(summary(page)).toContainText("5 pictures and 0 videos match");
  expect(new URL(page.url()).searchParams.get("q")).toBe("rakuryuchi");
});

test("a tile opens the viewer with credit and a link to the original", async ({ page }) => {
  const errors = await open(page, "?who=selena");
  await tiles(page).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Fan work")).toBeVisible();
  await expect(dialog.getByRole("link", { name: /original/i }).first()).toBeVisible();
  expect(new URL(page.url()).searchParams.get("i")).toMatch(/^fanart-/);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  expect(errors).toEqual([]);
});

test("a shared link opens the piece", async ({ page }) => {
  await open(page, "?i=fanart-ig-deyt9pycc-y-2");
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("the By artist view groups work under each artist with counts", async ({ page }) => {
  await open(page, "?view=artist");
  await expect(page.getByRole("heading", { level: 3, name: /jlen_ismyname/ })).toBeVisible();
  await expect(page.getByText("creative").first()).toBeVisible();
  await expect(page.getByText("animated").first()).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: /Group posts/ })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "Artist not named" })).toBeVisible();
});

test("the videos filter shows every fan video in a grid with its player", async ({ page }) => {
  await open(page, "?kind=video");
  await expect(page.locator("article[data-video]")).toHaveCount(18);
  await expect(page.getByRole("button", { name: /^Play video: / }).first()).toBeVisible();
});

test("the phone layout has no sideways scroll", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await open(page);
  await expect(tiles(page).first()).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});
