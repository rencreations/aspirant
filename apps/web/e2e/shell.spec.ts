import { expect, test } from "@playwright/test";

import { settled, sitePath, skipGate, url } from "./helpers";

test.beforeEach(async ({ page }) => {
  await skipGate(page);
});

test("skip link moves focus to main", async ({ page }) => {
  await page.goto(url("/"));
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main#main")).toBeFocused();
});

test("the menu links navigate and mark the current page", async ({ page, baseURL }) => {
  await page.goto(url("/"));
  await page.getByRole("button", { name: "Open menu" }).click();
  const menu = page.getByRole("dialog");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("link", { name: /Home/ })).toHaveAttribute("aria-current", "page");
  await menu.getByRole("link", { name: /Story/ }).click();
  await settled(page);
  await expect.poll(() => sitePath(page, baseURL)).toBe("/story/");
  await expect(page.getByRole("heading", { level: 1, name: "Story" })).toBeVisible();
});

test("the bar stays put while scrolling", async ({ page }) => {
  await page.goto(url("/collection/"));
  await page.waitForLoadState("networkidle");
  const bar = page.getByRole("banner");
  await page.evaluate(() => window.scrollTo(0, 1800));
  await page.waitForTimeout(500);
  await page.evaluate(() => window.scrollBy(0, 600));
  await page.waitForTimeout(500);
  const box = await bar.boundingBox();
  expect(box?.y).toBe(0);
  await expect(bar.getByRole("button", { name: "Open menu" })).toBeInViewport();
});

test("hovering a menu page shows its two aspirants and the pair sits on one eye line", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "Hover needs a pointer");
  await page.goto(url("/"));
  await page.getByRole("button", { name: "Open menu" }).click();
  const menu = page.getByRole("dialog");
  await expect(menu).toBeVisible();
  const link = menu.getByRole("link", { name: /Characters/ });
  await link.hover();
  const pair = link.locator("img");
  await expect(pair).toHaveCount(2);
  await expect(pair.first()).toHaveCSS("opacity", "1");
  const [a, b] = await Promise.all([pair.first().boundingBox(), pair.last().boundingBox()]);
  // Same size, same top: the eyes sit on one line.
  expect(Math.abs((a?.height ?? 0) - (b?.height ?? 1))).toBeLessThan(2);
  expect(Math.abs((a?.y ?? 0) - (b?.y ?? 1))).toBeLessThan(2);
  // The left figure is left of the title and the right figure is right of it.
  const title = await link.boundingBox();
  expect((a?.x ?? 0) + (a?.width ?? 0)).toBeLessThanOrEqual((title?.x ?? 0) + 80);
  expect(b?.x ?? 0).toBeGreaterThanOrEqual((title?.x ?? 0) + (title?.width ?? 0) - 80);
});

test("menu keeps focus inside, closes on Escape, restores focus", async ({ page }) => {
  await page.goto(url("/experience/"));
  const button = page.getByRole("button", { name: "Open menu" });
  await button.click();
  const menu = page.getByRole("dialog");
  await expect(menu).toBeVisible();
  for (let i = 0; i < 12; i++) await page.keyboard.press("Tab");
  expect(await menu.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(button).toBeFocused();
});

test("the next-destination chain goes all the way round", async ({ page, baseURL }) => {
  const chain = ["/", "/experience/", "/story/", "/character/", "/collection/", "/"];
  await page.goto(url("/"));
  for (const next of chain.slice(1)) {
    await page.getByRole("button", { name: /^Continue to/ }).click();
    await settled(page);
    await expect.poll(() => sitePath(page, baseURL)).toBe(next);
  }
});

test("character pages loop to the next in queue, and N goes next", async ({ page, baseURL }) => {
  await page.goto(url("/character/selena/"));
  await expect(page.getByRole("heading", { level: 1, name: "Selena" })).toBeVisible();
  await page.locator("body").press("n");
  await settled(page);
  await expect.poll(() => sitePath(page, baseURL)).toBe("/character/fanny/");
  await expect(page.getByRole("heading", { level: 1, name: "Fanny" })).toBeVisible();
});

test("M toggles sound and the toggle reflects it", async ({ page }) => {
  await page.goto(url("/"));
  const toggle = page.getByRole("banner").getByRole("button", { name: "Sound" });
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await page.locator("body").press("m");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
});

test("reduced motion is honoured and nothing auto-advances", async ({ page, baseURL }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(url("/"));
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(1200);
  expect(sitePath(page, baseURL)).toBe("/");
});

test("scrolling through the footer opens the next page", async ({ page, baseURL }) => {
  await page.goto(url("/collection/"));
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => sitePath(page, baseURL), { timeout: 8000 }).toBe("/");
});

test("the Reduce motion toggle applies at once and persists across reloads", async ({ page }) => {
  await page.goto(url("/experience/"));
  await expect(page.locator("html")).toHaveAttribute("data-motion", "auto");
  // It lives in the menu, with no control left in the bottom right corner of the page.
  await expect(page.getByRole("button", { name: "Reduce motion" })).toHaveCount(0);
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Reduce motion" }).click();
  await page.keyboard.press("Escape");
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
});
