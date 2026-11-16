import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { skipGate, url, watchErrors } from "./helpers";

/**
 * /about: the page of the series, with the drone that flies through it. `skipGate` also turns the
 * opening off (`aspirants:intro`), so the page stands at rest for these tests. One test lets the
 * opening play on purpose. The drone is a WebGL layer: where the browser of the test cannot draw
 * it, the page must stand all the same, so the tests of the drone itself ask first whether it is
 * there (`window.__aboutDrone.state().engine`).
 */

interface DroneState {
  phase: string;
  engine: "pending" | "ready" | "none";
  pose: { x: number; y: number; size: number };
  target: { station: string };
  trick: string | null;
}

async function open(page: Page, options: { intro?: boolean } = {}) {
  await skipGate(page, options);
  const errors = watchErrors(page);
  const response = await page.goto(url("/about/"));
  expect(response?.status()).toBe(200);
  await page.waitForLoadState("load");
  return errors;
}

async function drone(page: Page): Promise<DroneState | null> {
  return page.evaluate(() => {
    const probe = (window as unknown as { __aboutDrone?: { state: () => unknown } }).__aboutDrone;
    return probe ? (probe.state() as DroneState) : null;
  });
}

/** Wait until the scene has drawn the drone, or has said that it never will. */
async function settledDrone(page: Page): Promise<DroneState> {
  await expect
    .poll(async () => (await drone(page))?.engine ?? "pending", { timeout: 30_000 })
    .not.toBe("pending");
  const state = await drone(page);
  if (!state) throw new Error("the drone's probe is missing");
  return state;
}

async function overflow(page: Page) {
  return page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return el.scrollWidth - window.innerWidth;
  });
}

const root = (page: Page) => page.locator("[data-about]");

test("loads with one h1, every section, no console errors and no horizontal overflow", async ({
  page,
}) => {
  const errors = await open(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1, name: "About Aspirant" })).toBeVisible();
  for (const id of ["statement", "phases", "ledger", "label", "outro"]) {
    await expect(page.locator(`[data-about-section="${id}"]`)).toHaveCount(1);
  }
  await expect(root(page)).toHaveAttribute("data-about-intro", "done");
  await settledDrone(page);
  expect(await overflow(page)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test("the first screen says what the series is and holds the reel", async ({ page }) => {
  await open(page);
  const opening = page.locator("[data-about-track]");
  await expect(opening.getByText(/anime skin series of Mobile Legends: Bang Bang/)).toBeVisible();
  await expect(page.locator("[data-about-film] video")).toHaveCount(1);
  await expect(page.locator('[data-drone-anchor="hero"]')).toHaveCount(1);
});

test("the opening plays once and ends with everything shown", async ({ page }) => {
  await open(page, { intro: true });
  await expect(root(page)).toHaveAttribute("data-about-intro", "done", { timeout: 20_000 });
  await expect(page.getByRole("heading", { level: 1, name: "About Aspirant" })).toBeVisible();
  await expect(page.locator("#about-title")).toHaveAttribute("data-finished", "");
  await expect(
    page.locator("[data-about-track]").getByText(/anime skin series of Mobile Legends/),
  ).toBeVisible();
});

test("a scroll during the opening ends it at once, with the title whole", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "The wheel is a desktop input");
  await open(page, { intro: true });
  await expect(root(page)).not.toHaveAttribute("data-about-intro", "wait", { timeout: 20_000 });
  await page.mouse.move(700, 400);
  await page.mouse.wheel(0, 120);
  await expect(root(page)).toHaveAttribute("data-about-intro", "done", { timeout: 3000 });
  await expect(page.locator("#about-title")).toHaveAttribute("data-finished", "");
});

test("the reel grows into its window, and a trailer opens in the player", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "The wheel is a desktop input");
  await open(page);
  const film = page.locator("[data-about-film]");
  await expect(film).not.toHaveAttribute("data-complete", "");
  await page.mouse.move(700, 400);
  // To the end of the morph and a little into the hold, by the wheel, as a visitor would.
  for (let i = 0; i < 14; i += 1) {
    await page.mouse.wheel(0, 80);
    await page.waitForTimeout(40);
  }
  await expect(film).toHaveAttribute("data-complete", "", { timeout: 5000 });

  const pills = page.getByRole("list", { name: "The trailer of each phase" }).getByRole("button");
  await expect(pills).toHaveCount(5);
  await pills.nth(1).click();
  const player = page.getByRole("dialog");
  await expect(player).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(player).toBeHidden();
});

test("a stop inside the morph settles to one end after a second", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "The wheel is a desktop input");
  await open(page);
  await page.mouse.move(700, 400);
  for (let i = 0; i < 3; i += 1) {
    await page.mouse.wheel(0, 80);
    await page.waitForTimeout(40);
  }
  const end = await page.evaluate(() => Math.round(window.innerHeight * 0.9));
  await expect
    .poll(() => page.evaluate(() => Math.round(window.scrollY)), { timeout: 6000 })
    .toBe(0);
  for (let i = 0; i < 8; i += 1) {
    await page.mouse.wheel(0, 80);
    await page.waitForTimeout(40);
  }
  await expect
    .poll(() => page.evaluate(() => Math.round(window.scrollY)), { timeout: 6000 })
    .toBeGreaterThanOrEqual(end - 2);
});

test("the drone keeps to the screen all the way down the first act", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "Measured at the desktop size");
  await open(page);
  const first = await settledDrone(page);
  test.skip(first.engine !== "ready", "This browser cannot draw the scene");
  expect(first.target.station).toBe("hero");

  const { height, width } = page.viewportSize() ?? { width: 1440, height: 900 };
  await page.mouse.move(width / 2, height / 2);
  const seen = new Set<string>();
  // Past the film and into the statement. A slow machine draws fewer frames, so it is the
  // stations that end the walk, not a count of steps.
  for (let i = 0; i < 90 && !seen.has("center"); i += 1) {
    await page.mouse.wheel(0, 90);
    await page.waitForTimeout(140);
    const state = await drone(page);
    if (!state) continue;
    seen.add(state.target.station);
    if (state.target.station === "hero") continue;
    // Its middle never leaves the screen and never goes under the top bar.
    expect(state.pose.x).toBeGreaterThan(0);
    expect(state.pose.x).toBeLessThan(width);
    expect(state.pose.y).toBeGreaterThan(60);
    expect(state.pose.y).toBeLessThan(height);
  }
  expect(seen.has("perch")).toBe(true);
  expect(seen.has("center")).toBe(true);
});

test("a press on the drone gets an answer", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "Measured at the desktop size");
  await open(page);
  const state = await settledDrone(page);
  test.skip(state.engine !== "ready", "This browser cannot draw the scene");
  const button = page.getByRole("button", { name: /^The drone/ });
  await expect(button).toBeVisible();
  // Nothing takes the focus when the page opens.
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe("BODY");
  // It floats, so it never holds still for the click: press where it is.
  await button.click({ force: true });
  await expect.poll(async () => (await drone(page))?.trick ?? null).not.toBeNull();
});

test("the five phases name the ten skins and lead to their pages", async ({ page }) => {
  await open(page);
  const phases = page.locator('[data-about-section="phases"]');
  await phases.scrollIntoViewIfNeeded();
  for (const numeral of ["1.0", "2.0", "3.0", "4.0", "5.0"]) {
    await expect(phases.getByText(numeral, { exact: true }).first()).toBeAttached();
  }
  const slugs = [
    "layla",
    "fanny",
    "ruby",
    "angela",
    "lesley",
    "change",
    "guinevere",
    "vexana",
    "selena",
    "obsidia",
  ];
  for (const slug of slugs) {
    await expect(phases.locator(`a[href$="/character/${slug}/"]`)).toHaveCount(1);
  }
});

test("the ledger leads to the rooms and the outro carries the notice and the takedown link", async ({
  page,
}) => {
  await open(page);
  const ledger = page.locator('[data-about-section="ledger"]');
  for (const end of [
    "/collection/video/films/",
    "/collection/music/",
    "/collection/voicelines/",
    "/collection/comic/",
    "/story/interactive-drama/",
    "/collection/lore/",
  ]) {
    await expect(ledger.locator(`a[href$="${end}"]`)).toHaveCount(1);
  }
  const outro = page.locator('[data-about-section="outro"]');
  await expect(outro.getByText(/Not affiliated with/i)).toBeAttached();
  await expect(outro.getByRole("link", { name: /Copyright or takedown/i })).toHaveAttribute(
    "href",
    /\/takedown\/\?/,
  );
});

test("the page ends with the way to the story", async ({ page }) => {
  await open(page);
  await expect(page.getByRole("heading", { level: 2, name: "Next: Story" })).toBeAttached();
  await expect(page.getByRole("heading", { level: 2, name: /^Next:/ })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Continue to Story" })).toBeAttached();
});

test("axe finds no serious or critical violation", async ({ page }) => {
  await open(page);
  await settledDrone(page);
  const results = await new AxeBuilder({ page }).analyze();
  const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
});
