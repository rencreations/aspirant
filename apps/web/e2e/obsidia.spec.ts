import { expect, test, type Page } from "@playwright/test";

import { skipGate, url, watchErrors } from "./helpers";

/**
 * Obsidia's page is one picture. The test browser may not decode H.264, so these specs check what
 * does not depend on playback: the interface, the drawers and the layout. The frame maths and the
 * director's state machine have unit tests next to the code.
 */

test.describe.configure({ timeout: 120_000 });

async function open(page: Page, path = "/character/obsidia/") {
  await skipGate(page);
  const errors = watchErrors(page);
  await page.goto(url(path));
  // The welcome animation can be skipped; without a decodable video the page goes straight on.
  const skip = page.getByRole("button", { name: "Skip" });
  await skip.click({ timeout: 4000 }).catch(() => undefined);
  await expect(page.getByRole("button", { name: "About", exact: true })).toBeVisible({
    timeout: 45_000,
  });
  // The buttons slide in; let them settle.
  await page.waitForTimeout(1300);
  return errors;
}

const SPOT_NAMES = [
  "Play the weapon animation",
  "Play the animation of her face",
  "Play the animation of her feet",
];

test("shows the three buttons and the three touch points, with one h1", async ({ page }) => {
  const errors = await open(page);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1, name: "Obsidia" })).toBeAttached();
  for (const name of ["About", "Skills", "Gallery"])
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  for (const name of SPOT_NAMES) await expect(page.getByRole("button", { name })).toBeVisible();
  // The trailer is on her About page, not on the main panel.
  await expect(page.getByRole("button", { name: /Play video: Obsidia, trailer/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Continue to Selena/ })).toHaveCount(1);
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

test("her music is in the nav", async ({ page }) => {
  await open(page);
  const nav = page.getByRole("banner");
  await expect(nav.getByRole("button", { name: "Sound" })).toBeVisible();
  const record = nav.getByRole("button", { name: /Obsidia theme, The Aspirants/ });
  await expect(record).toBeVisible();
  await expect(record).toHaveAttribute("aria-pressed", /true|false/);
});

test("the three buttons sit side by side in the top left", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "The corner layout is the desktop one");
  await open(page);
  const vw = page.viewportSize()?.width ?? 0;
  const vh = page.viewportSize()?.height ?? 0;
  const boxes = [];
  for (const name of ["About", "Skills", "Gallery"]) {
    boxes.push((await page.getByRole("button", { name, exact: true }).boundingBox())!);
  }
  for (const b of boxes) {
    expect(b.y).toBeLessThan(vh * 0.3);
    expect(b.x + b.width).toBeLessThan(vw * 0.5);
  }
  // In one row, in order.
  expect(Math.abs(boxes[0]!.y - boxes[2]!.y)).toBeLessThan(4);
  expect(boxes[0]!.x).toBeLessThan(boxes[1]!.x);
  expect(boxes[1]!.x).toBeLessThan(boxes[2]!.x);
});

test("the buttons can be pressed without errors", async ({ page }) => {
  const errors = await open(page);
  await page.getByRole("button", { name: "Skills", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Skills", exact: true })).toBeVisible({
    timeout: 45_000,
  });
  expect(errors).toEqual([]);
});

test("a touch point plays its short at once and the main panel comes back, with no extra page", async ({
  page,
}) => {
  await open(page);
  const spot = page.getByRole("button", { name: SPOT_NAMES[0]! });
  // The circle follows the picture, so it is never still.
  await spot.click({ force: true });
  await expect(page.getByRole("button", { name: "Back", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "About", exact: true })).toBeVisible({
    timeout: 60_000,
  });
  await expect(spot).toBeVisible();
  await expect(spot).toBeEnabled();
});

test("every touch point stays on screen, on a phone too", async ({ page }) => {
  await open(page);
  const vw = page.viewportSize()?.width ?? 0;
  const vh = page.viewportSize()?.height ?? 0;
  for (const name of SPOT_NAMES) {
    const box = await page.getByRole("button", { name }).boundingBox();
    expect(box).not.toBeNull();
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;
    expect(cx).toBeGreaterThan(0);
    expect(cx).toBeLessThan(vw);
    expect(cy).toBeGreaterThan(0);
    expect(cy).toBeLessThan(vh);
  }
});

test("the cursor snaps to a touch point and shows what it is doing", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "Phones and tablets have no pointer to snap");
  await open(page);
  const cursor = page.locator("[data-overlay='cursor']");
  const spot = page.getByRole("button", { name: SPOT_NAMES[1]! });
  const box = (await spot.boundingBox())!;
  // Close, but not on the centre: the ring still locks on.
  await page.mouse.move(box.x + box.width / 2 + 24, box.y + box.height / 2 + 20, { steps: 6 });
  await expect(cursor).toHaveAttribute("data-state", "snap");
  await page.mouse.down();
  await expect(cursor).toHaveAttribute("data-state", "pressed");
  await page.mouse.up();
  await page.mouse.move(8, box.y + box.height / 2, { steps: 6 });
  await expect(cursor).toHaveAttribute("data-state", /idle|hover/);
});

test("each page has its own address, and the address opens the page", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Skills", exact: true }).click();
  await expect(page).toHaveURL(/\/character\/obsidia\/skills\/$/, { timeout: 45_000 });
  await expect(page.getByRole("button", { name: "Back", exact: true })).toBeVisible({
    timeout: 45_000,
  });
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page).toHaveURL(/\/character\/obsidia\/$/, { timeout: 45_000 });
  // Arriving at a page's address plays that page and skips the welcome.
  await page.goto(url("/character/obsidia/gallery/"));
  await expect(page.getByRole("button", { name: "Back", exact: true })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page).toHaveTitle(/Obsidia, Gallery/);
});

test("Esc leaves the page it opened", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "About", exact: true }).click();
  await expect(page.getByRole("button", { name: "Back", exact: true })).toBeVisible({
    timeout: 45_000,
  });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "About", exact: true })).toBeVisible({
    timeout: 45_000,
  });
});
