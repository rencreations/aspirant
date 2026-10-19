import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { skipGate, url, watchErrors } from "./helpers";

/**
 * Selena's page is one picture. The test browser may not decode H.264, so these specs check what
 * does not depend on playback: the interface, the custom player and the layout. The frame
 * maths and the director's state machine have unit tests next to the code.
 */

test.describe.configure({ timeout: 90_000 });

async function open(page: Page) {
  await skipGate(page);
  const errors = watchErrors(page);
  await page.goto(url("/character/selena/"));
  // The welcome animation can be skipped; without a decodable video the page goes straight on.
  const skip = page.getByRole("button", { name: "Skip" });
  await skip.click({ timeout: 4000 }).catch(() => undefined);
  await expect(page.getByRole("button", { name: "About" })).toBeVisible({ timeout: 45_000 });
  // The buttons slide in; let them settle.
  await page.waitForTimeout(1300);
  return errors;
}

test("shows the four buttons, Random Animation and the trailer, with one h1", async ({ page }) => {
  const errors = await open(page);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1, name: "Selena" })).toBeAttached();
  for (const name of ["About", "Skills", "Gallery", "Others", "Random Animation"])
    await expect(page.getByRole("button", { name })).toBeVisible();
  await expect(page.getByRole("button", { name: /Play video: Selena, trailer/ })).toBeVisible();
  // Only the picture: nothing left of the old page.
  await expect(page.locator("#voice-title, #profile-title, #media-title")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Continue to/ })).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("does not scroll", async ({ page }) => {
  await open(page);
  const extra = await page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return el.scrollHeight - window.innerHeight;
  });
  expect(extra).toBeLessThanOrEqual(0);
  await page.mouse.wheel(0, 900);
  await page.keyboard.press("End");
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test("the sound and the music are in the nav, nothing is left in the bottom right corner", async ({
  page,
}) => {
  await open(page);
  const nav = page.getByRole("banner");
  await expect(nav.getByRole("button", { name: "Sound" })).toBeVisible();
  // The record: song and artist, a button that pauses and resumes the music.
  const record = nav.getByRole("button", { name: /Silverbolt Raiko, Mobile Legends: Bang Bang/ });
  await expect(record).toBeVisible();
  await expect(record).toHaveAttribute("aria-pressed", /true|false/);
  await expect(page.getByRole("button", { name: "Reduce motion" })).toHaveCount(0);
});

test("the buttons sit in the right half, the trailer and Random Animation in the left", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "The corner layout is the desktop one");
  await open(page);
  const vw = page.viewportSize()?.width ?? 0;
  const about = await page.getByRole("button", { name: "About" }).boundingBox();
  const card = await page.getByRole("button", { name: /Play video/ }).boundingBox();
  const random = await page.getByRole("button", { name: "Random Animation" }).boundingBox();
  expect(about!.x).toBeGreaterThan(vw * 0.6);
  expect(card!.x + card!.width).toBeLessThan(vw * 0.4);
  // Small: the trailer card never takes much of the picture.
  expect(card!.width).toBeLessThan(vw * 0.25);
  // The Random Animation button is below the trailer, in the same column.
  expect(random!.y).toBeGreaterThan(card!.y + card!.height - 1);
  expect(Math.abs(random!.x - card!.x)).toBeLessThan(2);
});

test("the trailer opens the custom player, which closes on Escape and gives focus back", async ({
  page,
}) => {
  await open(page);
  const card = page.getByRole("button", { name: /Play video: Selena, trailer/ });
  await card.click();
  const player = page.getByRole("dialog", { name: "Selena, trailer" });
  await expect(player).toBeVisible();
  await expect(player.getByRole("slider", { name: "Seek" })).toBeVisible();
  await expect(player.getByRole("button", { name: /^(Play|Pause)$/ })).toBeVisible();
  // A quality menu with Auto, no speed control, no close button.
  await expect(player.getByRole("button", { name: /^Quality/ })).toBeVisible();
  await expect(player.getByRole("button", { name: /speed|1x/i })).toHaveCount(0);
  await expect(player.getByRole("button", { name: "Close video" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(player).toHaveCount(0);
  await expect(card).toBeFocused();
});

test("the player's quality menu lists Auto and the sizes", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: /Play video/ }).click();
  const player = page.getByRole("dialog");
  await player.getByRole("button", { name: /^Quality/ }).click();
  const menu = player.getByRole("list", { name: "Quality" });
  await expect(menu.getByRole("button", { name: /^Auto/ })).toBeVisible();
  for (const size of ["1080p", "720p", "480p"])
    await expect(menu.getByRole("button", { name: size, exact: true })).toBeVisible();
  await menu.getByRole("button", { name: "480p", exact: true }).click();
  await expect(player.getByRole("button", { name: /^Quality, 480p/ })).toBeVisible();
});

test("a click in the outer quarters of the player leaves", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "Needs a pointer");
  await open(page);
  await page.getByRole("button", { name: /Play video/ }).click();
  const player = page.getByRole("dialog");
  await expect(player).toBeVisible();
  await page.waitForTimeout(1200);
  const vw = page.viewportSize()?.width ?? 0;
  await page.mouse.move(vw * 0.12, 300);
  await page.mouse.click(vw * 0.12, 300);
  await expect(player).toHaveCount(0, { timeout: 8000 });
});

test("the buttons can be pressed without errors", async ({ page }) => {
  const errors = await open(page);
  await page.getByRole("button", { name: "Skills" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Skills" })).toBeVisible({ timeout: 20_000 });
  expect(errors).toEqual([]);
});

test("Random Animation plays at once and the main panel comes back, with no extra page", async ({
  page,
}) => {
  await open(page);
  const random = page.getByRole("button", { name: "Random Animation" });
  await random.click();
  // There is no second view: no Back button, and the panel is back when the short is over.
  await expect(page.getByRole("button", { name: "Back" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "About" })).toBeVisible({ timeout: 20_000 });
  await expect(random).toBeVisible();
  await expect(random).toBeEnabled();
});

test("fits the screen without sideways scrolling", async ({ page }) => {
  await open(page);
  const overflow = await page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return el.scrollWidth - window.innerWidth;
  });
  expect(overflow).toBeLessThanOrEqual(0);
  for (const name of ["About", "Skills", "Gallery", "Others", "Random Animation"]) {
    const box = await page.getByRole("button", { name }).first().boundingBox();
    const vw = page.viewportSize()?.width ?? 0;
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(vw + 1);
  }
});

test("has no serious accessibility violations", async ({ page }) => {
  await open(page);
  await page.waitForTimeout(900);
  const results = await new AxeBuilder({ page })
    .exclude("[data-overlay='hud']")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  const serious = results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target.join(" ")) }));
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
});
