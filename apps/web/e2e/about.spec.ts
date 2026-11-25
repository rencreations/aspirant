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
  for (const id of ["statement", "phases", "ledger", "stop", "label"]) {
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

test("a scroll during the opening does not move the page, and the opening plays to its end", async ({
  page,
}, info) => {
  // The owner, 25 Nov 2026: the scroll is held until the first animation has finished.
  test.skip(info.project.name !== "desktop", "The wheel is a desktop input");
  await open(page, { intro: true });
  await expect(root(page)).not.toHaveAttribute("data-about-intro", "wait", { timeout: 20_000 });
  await page.mouse.move(700, 400);
  for (let i = 0; i < 6; i += 1) {
    await page.mouse.wheel(0, 240);
    await page.waitForTimeout(80);
  }
  await expect(root(page)).not.toHaveAttribute("data-about-intro", "done");
  expect(await page.evaluate(() => window.scrollY)).toBeLessThan(2);
  await expect(root(page)).toHaveAttribute("data-about-intro", "done", { timeout: 8000 });
  await expect(page.locator("#about-title")).toHaveAttribute("data-finished", "");
  // Then the page is the visitor's again.
  await page.mouse.wheel(0, 400);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(50);
});

test("the film grows into its window, and the play control opens it in the player", async ({
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
  await expect(film.getByText("From concept and design to production").first()).toBeAttached();

  // One film now: how the series started. Its play control opens the site's player.
  await film.getByRole("button", { name: /^Play .+, with sound$/ }).click();
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

/** One of the parts a phase adds under its two skins. */
const part = (page: Page, phase: number, name: string) =>
  page.locator(`li[data-phase="${phase}"] [data-phase-part="${name}"]`);

test("each phase lists its official videos, in the owner's order, the pinned ones first", async ({
  page,
}) => {
  await open(page);
  // The fourth phase shows its three films first: its six tall videos are behind a switch.
  const counts = [8, 6, 4, 3, 4];
  const first = [
    "Go For It! Aspirants!",
    "Awakening",
    "Rekindled Light",
    "Connection Lost",
    "Day of Enders",
  ];
  for (const [i, count] of counts.entries()) {
    const deck = part(page, i + 1, "videos");
    const rows = deck.getByRole("tab");
    await expect(rows).toHaveCount(count);
    await expect(rows.first()).toHaveAttribute("aria-selected", "true");
    await expect(rows.first()).toContainText(first[i] ?? "");
  }

  const deck = part(page, 4, "videos");
  const kinds = deck.getByRole("radio");
  await expect(kinds).toHaveCount(2);
  await expect(kinds.first()).toHaveAttribute("aria-checked", "true");
  await kinds.nth(1).scrollIntoViewIfNeeded();
  await kinds.nth(1).click();
  await expect(kinds.nth(1)).toHaveAttribute("aria-checked", "true");
  await expect(deck.getByRole("tab")).toHaveCount(6);
});

test("a press on a row changes the window, and play opens the site's player", async ({ page }) => {
  await open(page);
  const deck = part(page, 2, "videos");
  await deck.scrollIntoViewIfNeeded();
  const rows = deck.getByRole("tab");
  await rows.nth(1).click();
  await expect(rows.nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(rows.first()).toHaveAttribute("aria-selected", "false");
  const play = deck.getByRole("button", { name: "Play A Way Out" });
  await expect(play).toBeVisible();
  await play.click();
  const player = page.getByRole("dialog");
  await expect(player).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(player).toBeHidden();
});

test("the parody in the first phase is marked as not canon", async ({ page }) => {
  await open(page);
  const deck = part(page, 1, "videos");
  await deck.scrollIntoViewIfNeeded();
  const row = deck.getByRole("tab").filter({ hasText: "Live-action parody" });
  await expect(row).toContainText(/not canon/i);
});

test("every phase has its music, and nothing plays by itself", async ({ page }) => {
  await open(page);
  const tracks = [1, 1, 1, 2, 2];
  for (const [i, count] of tracks.entries()) {
    const deck = part(page, i + 1, "music");
    // The play control of each track is a pill that says Play.
    await expect(deck.locator("button[data-primary]")).toHaveCount(count);
    await expect(deck.locator("button[data-primary]").first()).toHaveAttribute(
      "aria-label",
      /^Play /,
    );
  }
  // The first phase's song has a music video, with its own way in.
  await expect(
    part(page, 1, "music").getByRole("button", { name: "Watch the music video" }),
  ).toHaveCount(1);
  // No audio or video of the page plays with sound without a press.
  const loud = await page.evaluate(
    () =>
      [...document.querySelectorAll<HTMLMediaElement>("audio, video")].filter(
        (m) => !m.paused && !m.muted,
      ).length,
  );
  expect(loud).toBe(0);
});

test("the comics, the drama and the art of the phases lead where they say", async ({ page }) => {
  await open(page);
  await expect(
    part(page, 1, "comic").locator('a[href*="/collection/comic/the-aspirant"]'),
  ).not.toHaveCount(0);
  await expect(
    part(page, 4, "comic").locator('a[href*="/collection/comic/guinevere-and-vexana"]'),
  ).not.toHaveCount(0);
  await expect(
    part(page, 4, "comic").getByRole("button", { name: /^Watch it voiced/ }),
  ).toHaveCount(1);
  await expect(
    part(page, 4, "drama").locator('a[href*="/story/interactive-drama"]'),
  ).not.toHaveCount(0);
  for (const [i, count] of [4, 2, 2, 5, 2].entries()) {
    await expect(
      part(page, i + 1, "art").getByRole("button", { name: /^View larger/ }),
    ).toHaveCount(count);
  }
  // Every link that leaves the page for the collection says where it came from.
  const stray = await page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLAnchorElement>(
        '[data-about-section="phases"] a[href*="/collection/"]',
      ),
    ]
      .map((a) => a.getAttribute("href") ?? "")
      .filter((href) => !href.includes("from=about")),
  );
  expect(stray).toEqual([]);
});

test("Tetra's scene is in the second phase, and the drones' meeting places are in the page", async ({
  page,
}) => {
  await open(page);
  await expect(part(page, 2, "tetra")).toHaveCount(1);
  await expect(part(page, 2, "tetra").getByText(/little companion/)).toBeAttached();
  await expect(
    part(page, 2, "tetra").getByText("Tetra is a gift from Ruby to Angela."),
  ).toBeAttached();
  // Guinevere's two drones have no corner of their own any more (25 Nov 2026): they fly with the drone,
  // from the meeting place above the fourth phase. The doll is picked up and dropped behind two pictures.
  await expect(page.locator('[data-drone-anchor="meet-4"]')).toHaveCount(1);
  await expect(page.locator('[data-drone-hide="pickup"]')).toHaveCount(1);
  await expect(page.locator('[data-drone-hide="drop"]')).toHaveCount(1);
});

test("the resources lead to their three rooms, with the collection's own count of voice lines", async ({
  page,
}) => {
  await open(page);
  const ledger = page.locator('[data-about-section="ledger"]');
  await expect(ledger.getByRole("heading", { level: 2 })).toHaveText(/Aspirant\s*resources/i);
  for (const end of ["/collection/video/films/", "/collection/music/", "/collection/voicelines/"]) {
    // The address also says where the visitor came from, so the path is looked for inside it.
    await expect(ledger.locator(`a[href*="${end}"]`)).toHaveCount(1);
  }
  await expect(ledger.locator("a")).toHaveCount(3);
});

test("the drone has a place to stop, and the page ends in TheMLabel with no way to a next page", async ({
  page,
}) => {
  await open(page);
  await expect(page.locator('[data-about-section="stop"] [data-drone-anchor="stop"]')).toHaveCount(
    1,
  );
  await expect(page.locator('[data-about-section="label"]')).toHaveCount(1);
  // No footer to a next page, and no shortcut to the takedown page anywhere on this page.
  await expect(page.getByRole("button", { name: /^Continue to/ })).toHaveCount(0);
  await expect(page.locator('[data-about] a[href*="/takedown"]')).toHaveCount(0);
  // The fan notice was taken off the foot of TheMLabel by the owner (25 Nov 2026).
  await expect(page.locator("[data-about]").getByText(/Not affiliated with/i)).toHaveCount(0);
});

test("TheMLabel tells what it is in type, drawn by the scroll, with the cursor's light out", async ({
  page,
}) => {
  await open(page);
  const label = page.locator('[data-about-section="label"]');
  const parts = ["what", "system", "collect", "rewards", "hall", "story", "end"];
  for (const id of parts) await expect(label.locator(`[data-label-part="${id}"]`)).toHaveCount(1);
  // Between the definition and the end there are no pictures: no splash art, no drawn perks.
  for (const id of parts.slice(1, -1)) {
    await expect(label.locator(`[data-label-part="${id}"]`).locator("img, video")).toHaveCount(0);
  }
  // The logo's scene has no wave and no light passing over it any more.
  await expect(label.locator('[data-part="wave"], [data-part="beam"]')).toHaveCount(0);
  await expect(label).toHaveAttribute("data-cursor-glow", "off");

  // Scrolled to, a row of the rewards stands whole; scrolled past and back, it stands whole again.
  const row = label.locator('[data-scene="reward"]').nth(1);
  const name = row.locator('[data-k="name"]');
  const whole = () =>
    name.evaluate((el) => {
      const box = el.getBoundingClientRect();
      const mask = el.parentElement?.getBoundingClientRect();
      if (!mask) return false;
      return Math.abs(box.left - mask.left) < 2 && Number(getComputedStyle(el).opacity) > 0.99;
    });
  const centre = async () => {
    await row.evaluate((el) => {
      const box = el.getBoundingClientRect();
      window.scrollTo(0, window.scrollY + box.top + box.height / 2 - window.innerHeight / 2);
    });
  };
  await centre();
  await expect.poll(whole, { timeout: 5_000 }).toBe(true);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(whole, { timeout: 5_000 }).toBe(false);
  await centre();
  await expect.poll(whole, { timeout: 5_000 }).toBe(true);
  await expect(label.getByText("These rewards include")).toBeVisible();
});

test("axe finds no serious or critical violation", async ({ page }) => {
  await open(page);
  await settledDrone(page);
  const results = await new AxeBuilder({ page }).analyze();
  const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
});
