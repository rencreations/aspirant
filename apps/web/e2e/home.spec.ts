import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { skipGate, url, watchErrors } from "./helpers";

/*
 * Home page: the portal hero (pointer, touch, keyboard, reduced motion), the versus stage,
 * before and after, the rail of ten, the hall of fame lightbox and accessibility.
 * Chromium runs with SwiftShader so the WebGL portal renders headless.
 */
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
test.use({
  launchOptions: {
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
    ...(executablePath ? { executablePath } : {}),
  },
});

const hero = (page: Page) => page.locator("section[data-portal-radius]");

async function radius(page: Page): Promise<number> {
  return Number(await hero(page).getAttribute("data-portal-radius"));
}

async function open(page: Page) {
  await skipGate(page);
  const errors = watchErrors(page);
  await page.goto(url("/"));
  await page.waitForLoadState("networkidle");
  await expect(hero(page)).toHaveAttribute("data-intro", "play", { timeout: 15_000 });
  return errors;
}

test("home loads with one h1, the hero and every section, without errors or overflow", async ({
  page,
}) => {
  const errors = await open(page);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1, name: "The Aspirants" })).toBeVisible();
  for (const name of [
    "What is Aspirant",
    "Off track, on track",
    "04 / Before and after",
    "The ten",
    "Hall of fame",
  ]) {
    await expect(page.getByRole("heading", { level: 2, name })).toHaveCount(1);
  }
  await expect(page.getByRole("link", { name: /Begin the story/ })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});

test.describe("portal hero", () => {
  // Software WebGL (SwiftShader) is slow on busy CI machines: give the hero room.
  test.slow();

  test("moving the pointer opens the portal, and it relaxes when idle", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "mouse only");
    await open(page);
    await expect(hero(page)).toHaveAttribute("data-gl", "on", { timeout: 15_000 });
    const box = await page
      .locator("section[data-portal-radius] [data-view='base'] img")
      .first()
      .boundingBox();
    if (!box) throw new Error("figure not laid out");
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.3);
    let max = 0;
    for (let i = 0; i < 30; i++) {
      await page.mouse.move(box.x + box.width * (0.2 + i * 0.02), box.y + box.height * 0.3);
      await page.waitForTimeout(16);
      max = Math.max(max, await radius(page));
    }
    expect(max).toBeGreaterThan(0);
    await expect.poll(() => radius(page), { timeout: 15_000 }).toBe(0);
  });

  test("tabs switch the pair by click and by arrow keys", async ({ page }) => {
    await open(page);
    const tabs = page.getByRole("tablist", { name: "Portal pairs" }).getByRole("tab");
    await expect(tabs).toHaveCount(3);
    await tabs.nth(1).click();
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(hero(page)).toHaveAttribute("data-pair", "selena-obsidia");
    await expect(page.locator("#portal-panel")).toContainText("Silverbolt Raiko");
    await tabs.nth(1).press("ArrowRight");
    await expect(tabs.nth(2)).toBeFocused();
    await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");
    await expect(hero(page)).toHaveAttribute("data-pair", "guinevere-vexana");
    await expect(page.locator("#portal-panel")).toContainText("Daybreak Halo");
  });

  test("Toggle form and Hold portal open work from the keyboard", async ({ page }) => {
    await open(page);
    const toggle = page.getByRole("button", { name: "Toggle form" });
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(hero(page)).toHaveAttribute("data-form", "alt");
    await expect(page.locator("#portal-panel")).toContainText("Ender form");
    const hold = page.getByRole("button", { name: "Hold portal open" });
    await hold.focus();
    await page.keyboard.press("Space");
    await expect(hold).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => radius(page), { timeout: 5000 }).toBeGreaterThan(60);
  });

  test("touch: a drag opens the portal and a tap toggles the form", async ({ page }, info) => {
    test.skip(info.project.name !== "phone", "touch device");
    await open(page);
    const box = await page
      .locator("section[data-portal-radius] [data-view='base'] img")
      .first()
      .boundingBox();
    if (!box) throw new Error("figure not laid out");
    const cdp = await page.context().newCDPSession(page);
    const y = box.y + box.height * 0.35;
    const point = (x: number) => [{ x, y, id: 1 }];
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: point(box.x + 40),
    });
    let max = 0;
    for (let i = 1; i <= 24; i++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: point(box.x + 40 + i * 9),
      });
      await page.waitForTimeout(16);
      max = Math.max(max, await radius(page));
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    expect(max).toBeGreaterThan(0);

    await page.touchscreen.tap(box.x + box.width * 0.5, box.y + box.height * 0.3);
    await expect(hero(page)).toHaveAttribute("data-form", "alt");
  });

  test("reduced motion: static art, the form toggle crossfades", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page);
    await expect(hero(page)).toHaveAttribute("data-gl", "off");
    await expect(page.locator("section[data-portal-radius] canvas")).toHaveCount(0);
    await page.getByRole("button", { name: "Toggle form" }).click();
    await expect(hero(page)).toHaveAttribute("data-form", "alt");
    const altView = page.locator("section[data-portal-radius] [data-view='alt']");
    await expect.poll(() => altView.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  });
});

test("versus: choosing a side widens it", async ({ page }) => {
  await open(page);
  const stage = page.locator("#versus-panel");
  await stage.scrollIntoViewIfNeeded();
  const side = stage.getByRole("button", { name: /Obsidia/ });
  await side.click();
  await expect(side).toHaveAttribute("aria-pressed", "true");
  await expect(stage).toHaveAttribute("data-active", "storm");
  await page.getByRole("tab", { name: /Layla \/ Fanny/ }).click();
  await expect(stage.getByRole("button", { name: /Layla/ })).toBeVisible();
});

test("before and after: the line is struck on scroll and flips on press", async ({ page }) => {
  await open(page);
  const strip = page.locator("section[aria-labelledby='before-after-title']");
  await strip.scrollIntoViewIfNeeded();
  await expect(strip).toHaveAttribute("data-state", "after");
  const lines = strip.getByRole("button", { name: /A peaceful world/ });
  await lines.focus();
  await page.keyboard.press("Enter");
  await expect(strip).toHaveAttribute("data-state", "before");
  await expect(strip.getByRole("link", { name: /See the world/ })).toHaveAttribute(
    "href",
    /story\/$/,
  );
});

test("the ten: ten cards, rail buttons and arrow keys", async ({ page }) => {
  await open(page);
  const rail = page.locator("#ten-rail");
  await rail.scrollIntoViewIfNeeded();
  const links = rail.getByRole("link");
  await expect(links).toHaveCount(10);
  await expect(links.first()).toHaveAttribute("href", /character\/fanny\/$/);
  await expect(links.last()).toHaveAttribute("href", /character\/selena\/$/);
  await page.getByRole("button", { name: "Scroll the roster on" }).click();
  await expect.poll(() => rail.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  await links.nth(2).focus();
  await page.keyboard.press("ArrowRight");
  await expect(links.nth(3)).toBeFocused();
});

test("hall of fame: credits are shown and the lightbox opens and closes", async ({ page }) => {
  await open(page);
  const hall = page.locator("section[aria-labelledby='hall-title']");
  await hall.scrollIntoViewIfNeeded();
  await expect(hall.getByText("bukkavyi on DeviantArt")).toBeVisible();
  const first = hall.getByRole("button").first();
  await first.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("bukkavyi on DeviantArt");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(first).toBeFocused();
});

test("no serious accessibility violations after interacting with the hero", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Toggle form" }).click();
  await page
    .getByRole("tab", { name: /Selena \/ Obsidia/ })
    .first()
    .click();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  const serious = results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target.join(" ")) }));
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
});
