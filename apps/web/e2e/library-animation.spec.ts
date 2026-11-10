import fs from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { skipGate, url, watchErrors } from "./helpers";

/**
 * The Animation room: a carousel of the ten on a tilted ring, and a full screen view of each one
 * at `/collection/animation/<slug>`. The test browser cannot decode H.264, so the stage falls back
 * to its still and goes straight to its idle state: these specs check what does not depend on
 * playback (the order, the moves, the address, the launch and the way back, the drift) through the
 * room's own state on `[data-animation-room]`.
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

test("the ring moves on by itself once the character in front idles", async ({ page }) => {
  await open(page);
  await standsOn(page, "selena");
  // The welcome plays first (about 16 s where the browser decodes it, at once where it cannot).
  await expect(room(page)).toHaveAttribute("data-stage", "idle", { timeout: 40_000 });
  await expect(room(page)).toHaveAttribute("data-active", "selena");
  // Then the idle hold (6.5 s) and the step, with no input at all.
  await expect(room(page)).toHaveAttribute("data-active", "obsidia", { timeout: 15_000 });
  // The next one plays its welcome again from the start.
  await expect(room(page)).toHaveAttribute("data-stage", /boot|welcome|idle/u);
});

test("Launch opens the full screen view, Back closes it into the ring", async ({ page }) => {
  const errors = await open(page);
  await standsOn(page, "selena");
  await page.getByRole("link", { name: "Launch Selena full screen" }).click();
  await expect(page).toHaveURL(/\/collection\/animation\/selena\/?$/u);
  await expect(room(page)).toHaveAttribute("data-view", "full", { timeout: 10_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Selena, animation" })).toBeAttached();
  const options = page.getByRole("group", { name: "Animations" }).getByRole("button");
  // Selena: the welcome, three poses and three short clips (the idle loop is her rest).
  await expect(options).toHaveCount(7);
  // It must not look like a video: no time, no bar of a player.
  const text = await page.locator("[data-animation-room]").innerText();
  expect(text).not.toMatch(/\b\d+:\d\d\b|\b\d+(\.\d+)?\s?s\b/u);
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await expect(page.getByRole("slider")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Collection" })).toBeHidden();

  await page.getByRole("link", { name: "Animation" }).click();
  await expect(page).toHaveURL(/\/collection\/animation\/?$/u);
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
  await expect(page).toHaveURL(/\/collection\/animation\/selena\/?$/u);
  await expect(room(page)).toHaveAttribute("data-view", "full", { timeout: 10_000 });
  await page.keyboard.press("Escape");
  await expect(room(page)).toHaveAttribute("data-view", "ring", { timeout: 10_000 });
  await page.goBack();
  await expect(page).toHaveURL(/\/collection\/animation\/selena\/?$/u);
  await expect(room(page)).toHaveAttribute("data-view", "full", { timeout: 10_000 });
});

test("a full screen page opens by its address", async ({ page }) => {
  const errors = await open(page, "/collection/animation/vexana/");
  await expect(room(page)).toHaveAttribute("data-view", "full");
  await expect(room(page)).toHaveAttribute("data-active", "vexana");
  const labels = DATA.items
    .filter((i) => i.chars[0] === "vexana" && i.kind !== "idle")
    .map((i) => i.label);
  await expect(page.getByRole("group", { name: "Animations" }).getByRole("button")).toHaveText(
    labels.map((l) => new RegExp(l, "iu")),
  );
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
