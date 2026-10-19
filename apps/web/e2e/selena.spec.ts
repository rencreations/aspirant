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
  return errors;
}

test("shows the four buttons and the trailer, with one h1", async ({ page }) => {
  const errors = await open(page);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1, name: "Selena" })).toBeAttached();
  for (const name of ["About", "Skills", "Gallery", "Others"])
    await expect(page.getByRole("button", { name })).toBeVisible();
  await expect(page.getByRole("button", { name: /Play video: Selena, trailer/ })).toBeVisible();
  // Only the picture and the footer: nothing left of the old page.
  await expect(page.locator("#voice-title, #profile-title, #media-title")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Continue to/ })).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("the buttons sit in the right half and the trailer in the left", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "The corner layout is the desktop one");
  await open(page);
  const vw = page.viewportSize()?.width ?? 0;
  const about = await page.getByRole("button", { name: "About" }).boundingBox();
  const card = await page.getByRole("button", { name: /Play video/ }).boundingBox();
  expect(about!.x).toBeGreaterThan(vw * 0.6);
  expect(card!.x + card!.width).toBeLessThan(vw * 0.4);
  // Small: the trailer card never takes much of the picture.
  expect(card!.width).toBeLessThan(vw * 0.25);
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
  await expect(player.getByRole("button", { name: "Close video" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(player).toHaveCount(0);
  await expect(card).toBeFocused();
});

test("the custom player's close button works", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: /Play video/ }).click();
  const player = page.getByRole("dialog");
  await expect(player).toBeVisible();
  await player.getByRole("button", { name: "Close video" }).click();
  await expect(player).toHaveCount(0);
});

test("a button can be pressed without errors and Escape returns", async ({ page }) => {
  const errors = await open(page);
  await page.getByRole("button", { name: "Skills" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Skills" })).toBeVisible({ timeout: 20_000 });
  expect(errors).toEqual([]);
});

test("fits the screen without sideways scrolling", async ({ page }) => {
  await open(page);
  // The buttons slide in; measure them once they have settled.
  await page.waitForTimeout(1500);
  const overflow = await page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return el.scrollWidth - window.innerWidth;
  });
  expect(overflow).toBeLessThanOrEqual(0);
  for (const name of ["About", "Skills", "Gallery", "Others"]) {
    const box = await page.getByRole("button", { name }).boundingBox();
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
