import fs from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { skipGate, url, watchErrors } from "./helpers";

/**
 * The Animation room: a carousel of the ten on a tilted ring, and a full screen view of each one
 * at `/collection/animation/<slug>`. These specs check structure and state, not playback: the
 * order, the moves, the address, the launch and the way back, a ring that never moves by itself,
 * and the buttons of the full screen view, which follow the stage (`data-phase` on
 * `[data-animation-room]`). Where the browser cannot play a clip the engine skips it, and the
 * phases still run in the same order.
 */

test.describe.configure({ timeout: 180_000 });

const ROOT = process.cwd();

interface Data {
  characters: Array<{ slug: string; name: string }>;
  items: Array<{ id: string; chars: string[]; kind: string; label: string }>;
}

const DATA = JSON.parse(
  fs.readFileSync(path.join(ROOT, "public/data/library/animation.json"), "utf8"),
) as Data;

/** The order of the ring: by pair. */
const ORDER = [
  "selena",
  "obsidia",
  "guinevere",
  "vexana",
  "lesley",
  "change",
  "ruby",
  "angela",
  "layla",
  "fanny",
];
const NAME = Object.fromEntries(DATA.characters.map((c) => [c.slug, c.name]));

const room = (page: Page) => page.locator("[data-animation-room]");

/** A tall screen (phone and tablet upright): the options open from one Actions button. */
const isTall = async (page: Page) => (await room(page).getAttribute("data-shape")) === "tall";

/** The buttons of the full screen view that can be pressed now (the hidden ones are inert). */
const options = (page: Page) => page.getByRole("group", { name: "Animations" }).getByRole("button");

/** The one button at the foot of a tall screen: Actions, or the state of the pressed option. */
const dock = (page: Page) =>
  page.locator('[data-for="full"] [data-shown="true"] > button[data-kind]').last();

/** Open the sheet of a tall screen (a wide screen shows its options already). */
async function openOptions(page: Page) {
  if (!(await isTall(page))) return;
  await page.getByRole("button", { name: "Actions" }).click();
  await expect(page.getByRole("dialog", { name: /actions/iu })).toBeVisible();
}

/** Press an option by its label, through the sheet on a tall screen. */
async function pressOption(page: Page, label: RegExp) {
  await openOptions(page);
  await options(page).filter({ hasText: label }).click();
}

const phaseIs = (page: Page, phase: string | RegExp, timeout = 60_000) =>
  expect(room(page)).toHaveAttribute("data-phase", phase, { timeout });

async function open(page: Page, route = "/collection/animation/") {
  await skipGate(page);
  const errors = watchErrors(page);
  await page.goto(url(route));
  await expect(room(page)).toHaveAttribute("data-core", /ready|missing/, { timeout: 120_000 });
  return errors;
}

/** Wait until the ring stands on `slug`. */
async function standsOn(page: Page, slug: string) {
  await expect(room(page)).toHaveAttribute("data-active", slug, { timeout: 15_000 });
  await expect(room(page)).toHaveAttribute("data-target", slug);
}

test("the carousel holds the ten in pair order, Selena in front", async ({ page }) => {
  const errors = await open(page);
  await expect(page.getByRole("heading", { level: 1, name: "Animation" })).toBeAttached();
  const thumbs = page.getByRole("navigation", { name: "Characters" }).getByRole("button");
  await expect(thumbs).toHaveCount(10);
  expect(await thumbs.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")))).toEqual(
    ORDER.map((s) => NAME[s]),
  );
  await standsOn(page, "selena");
  await expect(thumbs.first()).toHaveAttribute("aria-current", "true");
  await expect(page.locator("[data-panel]")).toHaveCount(10);
  await expect(page.getByRole("link", { name: "Launch Selena full screen" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Collection" })).toBeVisible();
  // No way to the other rooms: the switcher of the library is not here.
  await expect(page.getByRole("navigation", { name: /collections/i })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("the buttons, the keys and the wheel turn the ring, round both ends", async ({
  page,
  isMobile,
}) => {
  await open(page);
  await standsOn(page, "selena");
  await page.getByRole("button", { name: "Character before" }).click();
  await standsOn(page, "fanny");
  await page.getByRole("button", { name: "Next character" }).click();
  await standsOn(page, "selena");
  await page.keyboard.press("ArrowRight");
  await standsOn(page, "obsidia");
  await page.keyboard.press("ArrowLeft");
  await standsOn(page, "selena");
  if (!isMobile) {
    // A wheel step (a touch screen has no wheel; it swipes, see the probes).
    await page.mouse.move(700, 400);
    await page.mouse.wheel(0, 200);
    await standsOn(page, "obsidia");
  }
  await page.getByRole("button", { name: NAME.ruby! }).click();
  await standsOn(page, "ruby");
  await expect(page.getByRole("heading", { level: 2, name: NAME.ruby! })).toBeVisible();
});

test("the ring never moves by itself", async ({ page }) => {
  await open(page);
  await standsOn(page, "selena");
  // The welcome plays first (about 16 s where the browser decodes it, at once where it cannot).
  await expect(room(page)).toHaveAttribute("data-stage", "idle", { timeout: 40_000 });
  // The old room stepped on after 6.5 s of idle. Now only the visitor moves it.
  await page.waitForTimeout(10_000);
  await standsOn(page, "selena");
  await expect(page.locator('[class*="drift"]')).toHaveCount(0);
});

test("Launch opens the full screen view, Back closes it into the ring", async ({ page }) => {
  const errors = await open(page);
  await standsOn(page, "selena");
  await page.getByRole("link", { name: "Launch Selena full screen" }).click();
  await expect(page).toHaveURL(/\/collection\/animation\/selena\/?$/u, { timeout: 15_000 });
  await expect(room(page)).toHaveAttribute("data-view", "full", { timeout: 10_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Selena, animation" })).toBeAttached();
  await phaseIs(page, "idle");
  await openOptions(page);
  // Selena: the welcome, three poses and three short clips (the idle loop is her rest).
  await expect(options(page)).toHaveCount(7);
  // It must not look like a video: no time, no bar of a player.
  const text = await page.locator("[data-animation-room]").innerText();
  expect(text).not.toMatch(/\b\d+:\d\d\b|\b\d+(\.\d+)?\s?s\b/u);
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await expect(page.getByRole("slider")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Collection" })).toBeHidden();
  if (await isTall(page)) {
    await page.getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("dialog", { name: /actions/iu })).toBeHidden();
  }

  await page.getByRole("link", { name: "Animation" }).click();
  await expect(page).toHaveURL(/\/collection\/animation\/?$/u, { timeout: 15_000 });
  await expect(room(page)).toHaveAttribute("data-view", "ring", { timeout: 10_000 });
  await standsOn(page, "selena");
  expect(errors).toEqual([]);
});

test("a press on the panel in front launches it, Escape and the browser come back", async ({
  page,
}) => {
  await open(page);
  await standsOn(page, "selena");
  const box = page.viewportSize()!;
  await page.mouse.click(box.width / 2, box.height * (box.width < box.height ? 0.36 : 0.47));
  await expect(page).toHaveURL(/\/collection\/animation\/selena\/?$/u, { timeout: 15_000 });
  await expect(room(page)).toHaveAttribute("data-view", "full", { timeout: 10_000 });
  await page.keyboard.press("Escape");
  await expect(room(page)).toHaveAttribute("data-view", "ring", { timeout: 10_000 });
  await page.goBack();
  await expect(page).toHaveURL(/\/collection\/animation\/selena\/?$/u, { timeout: 15_000 });
  await expect(room(page)).toHaveAttribute("data-view", "full", { timeout: 10_000 });
});

test("a full screen page opens by its address", async ({ page }) => {
  const errors = await open(page, "/collection/animation/vexana/");
  await expect(room(page)).toHaveAttribute("data-view", "full");
  await expect(room(page)).toHaveAttribute("data-active", "vexana");
  const labels = DATA.items
    .filter((i) => i.chars[0] === "vexana" && i.kind !== "idle")
    .map((i) => i.label);
  await phaseIs(page, "idle");
  await openOptions(page);
  await expect(options(page)).toHaveText(labels.map((l) => new RegExp(l, "iu")));
  if (await isTall(page)) {
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: /actions/iu })).toBeHidden();
  }
  await page.getByRole("link", { name: "Animation" }).click();
  await expect(room(page)).toHaveAttribute("data-view", "ring", { timeout: 15_000 });
  await standsOn(page, "vexana");
  expect(errors).toEqual([]);
});

test("the library search's address opens the carousel on that character", async ({ page }) => {
  const clip = DATA.items.find((i) => i.chars[0] === "angela" && i.kind === "short")!;
  await open(page, `/collection/animation/?i=${clip.id}`);
  await standsOn(page, "angela");
});

test("the buttons of the full screen view show only what can be pressed", async ({ page }) => {
  const errors = await open(page, "/collection/animation/selena/");
  const tall = await isTall(page);
  // The first welcome: only the way back, no option and no skip.
  if ((await room(page).getAttribute("data-phase")) === "first-welcome") {
    await expect(options(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /skip/iu })).toHaveCount(0);
    if (tall) await expect(page.getByRole("button", { name: "Actions" })).toBeHidden();
  }
  await expect(page.getByRole("link", { name: "Animation", exact: true })).toBeVisible();

  // At rest: every option.
  await phaseIs(page, "idle");
  await openOptions(page);
  await expect(options(page)).toHaveCount(7);

  // An action: the others hide at once, then nothing shows until she is back in her idle pose.
  await options(page).filter({ hasText: /badge/iu }).click();
  const seen = new Set<string>();
  for (let i = 0; i < 400; i += 1) {
    const phase = (await room(page).getAttribute("data-phase")) ?? "";
    seen.add(phase);
    if (phase === "idle" && seen.size > 1) break;
    await page.waitForTimeout(100);
  }
  expect([...seen].some((p) => p === "loading" || p === "action")).toBe(true);
  await phaseIs(page, "idle");

  // A pose that loops: one way back only, and it holds until it is pressed.
  await pressOption(page, /^flight/iu);
  await phaseIs(page, "pose");
  if (tall) {
    await expect(dock(page)).toHaveText(/back to idle/iu);
  } else {
    await expect(options(page)).toHaveCount(1);
    await expect(options(page)).toHaveText(/back to idle/iu);
  }
  await page.waitForTimeout(6_000);
  await expect(room(page)).toHaveAttribute("data-phase", "pose");
  await (tall ? dock(page) : options(page)).click();
  await phaseIs(page, /leaving|idle/u, 10_000);
  await phaseIs(page, "idle");

  // Welcome again: it plays from the start and every option hides until it is done.
  await pressOption(page, /^welcome/iu);
  await phaseIs(page, /welcome-again|idle/u, 10_000);
  if ((await room(page).getAttribute("data-phase")) === "welcome-again") {
    await expect(options(page)).toHaveCount(0);
  }
  await phaseIs(page, "idle");
  expect(errors).toEqual([]);
});

test("a tall screen opens the options from one Actions button, with full screen and whole frame", async ({
  page,
}) => {
  await open(page, "/collection/animation/ruby/");
  test.skip(!(await isTall(page)), "The Actions sheet is for a tall screen.");
  await phaseIs(page, "idle");
  const actions = page.getByRole("button", { name: "Actions" });
  await expect(actions).toBeVisible();
  // At the foot, in the middle.
  const box = (await actions.boundingBox())!;
  const view = page.viewportSize()!;
  expect(Math.abs(box.x + box.width / 2 - view.width / 2)).toBeLessThan(2);
  expect(box.y + box.height).toBeGreaterThan(view.height * 0.85);

  await actions.click();
  const sheet = page.getByRole("dialog", { name: /actions/iu });
  await expect(sheet).toBeVisible();
  await expect(options(page)).toHaveText([/welcome/iu, /pose/iu, /face/iu, /hand/iu, /scythe/iu]);
  // A press outside closes it.
  await page.mouse.click(view.width / 2, view.height * 0.15);
  await expect(sheet).toBeHidden();

  // Whole frame: the full recording across the width.
  const whole = page.getByRole("button", { name: "Whole frame" });
  await expect(whole).toHaveAttribute("aria-pressed", "false");
  await whole.click();
  await expect(whole).toHaveAttribute("aria-pressed", "true");
  await expect(room(page)).toHaveAttribute("data-whole", "true");
  await whole.click();
  await expect(room(page)).toHaveAttribute("data-whole", "false");

  // Full screen, where the browser can do it.
  const full = page.getByRole("button", { name: "Full screen" });
  if ((await full.count()) > 0) {
    await full.click();
    await expect(room(page)).toHaveAttribute("data-fullscreen", "true");
    await page.getByRole("button", { name: "Leave full screen" }).click();
    await expect(room(page)).toHaveAttribute("data-fullscreen", "false");
  }
});
