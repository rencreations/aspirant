import fs from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { splashFor } from "../src/features/library/animation/splash";
import { skipGate, url, watchErrors } from "./helpers";

/**
 * The look and the sound of the Animation room: the slat field behind the ring (its canvas, its
 * colours by character, its rest while the full screen view covers it), the splash art of the
 * panels (the picture and the point it is held at), and the theme song (which song, from memory,
 * looping, going on across a pair, the sound switch). Structure and state only, read from the
 * room's probes (`window.__slats`, `window.__themeMusic`): nothing here judges a picture.
 */

test.describe.configure({ timeout: 180_000 });

const ROOT = process.cwd();

interface MusicFile {
  items: Array<{ id: string; title: string }>;
}

const MUSIC = JSON.parse(
  fs.readFileSync(path.join(ROOT, "public/data/library/music.json"), "utf8"),
) as MusicFile;
const TITLE = Object.fromEntries(MUSIC.items.map((t) => [t.id, t.title]));

const room = (page: Page) => page.locator("[data-animation-room]");

async function open(page: Page, slug: string) {
  await skipGate(page);
  const errors = watchErrors(page);
  await page.goto(url(`/collection/animation/?c=${slug}`));
  await expect(room(page)).toHaveAttribute("data-core", /ready|missing/, { timeout: 120_000 });
  return errors;
}

const slats = (page: Page) => page.evaluate(() => window.__slats?.snapshot() ?? null);
const song = (page: Page) => page.evaluate(() => window.__themeMusic?.snapshot() ?? null);

/** Relative luminance of `#rrggbb`. */
function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    .map((v) => v / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((s, v, i) => s + v * ([0.2126, 0.7152, 0.0722][i] ?? 0), 0);
}

test("the field is a canvas of slats in the colours of the character in front", async ({
  page,
}) => {
  const errors = await open(page, "selena");
  await expect(page.locator("[data-slats] canvas")).toHaveCount(1);
  await expect.poll(async () => (await slats(page))?.running).toBe(true);
  const selena = await slats(page);
  expect(selena?.cols).toBeGreaterThan(20);
  // White type reads over the slats (4.5 to 1), and the ground is darker still.
  const white = (hex: string) => 1.05 / (luminance(hex) + 0.05);
  expect(white(selena?.color ?? "#ffffff")).toBeGreaterThanOrEqual(4.5);
  expect(luminance(selena?.ground ?? "#ffffff")).toBeLessThan(
    luminance(selena?.color ?? "#000000"),
  );

  // The next character rolls her own colours in.
  await page.keyboard.press("ArrowRight");
  await expect(room(page)).toHaveAttribute("data-target", "obsidia");
  await expect.poll(async () => (await slats(page))?.color).not.toBe(selena?.color);
  await expect.poll(async () => (await slats(page))?.wash, { timeout: 5_000 }).toBe(1);
  expect(errors).toEqual([]);
});

test("the field rests while the full screen view covers it", async ({ page }) => {
  await open(page, "ruby");
  await expect.poll(async () => (await slats(page))?.running).toBe(true);
  await page.keyboard.press("Enter");
  await expect(room(page)).toHaveAttribute("data-view", "full", { timeout: 15_000 });
  await expect.poll(async () => (await slats(page))?.running).toBe(false);
  const frames = (await slats(page))?.frames ?? 0;
  await page.waitForTimeout(600);
  expect((await slats(page))?.frames).toBe(frames);
  await page.keyboard.press("Escape");
  await expect(room(page)).toHaveAttribute("data-view", "ring", { timeout: 15_000 });
  await expect.poll(async () => (await slats(page))?.running).toBe(true);
});

test("every panel shows its splash art, held at its own point", async ({ page }) => {
  await open(page, "layla");
  for (const slug of [
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
  ] as const) {
    const img = page.locator(`[data-panel="${slug}"] img[data-splash]`);
    const { src, focus } = splashFor(slug);
    await expect(img).toHaveAttribute("src", new RegExp(`${src.replace(/\./gu, "\\.")}$`, "u"));
    const position = await img.evaluate((el) => getComputedStyle(el).objectPosition);
    const [x, y] = position.split(" ").map((v) => Number.parseFloat(v));
    expect(x).toBeCloseTo(focus.x * 100, 0);
    expect(y).toBeCloseTo(focus.y * 100, 0);
    expect(await img.evaluate((el) => getComputedStyle(el).objectFit)).toBe("cover");
  }
  // The pictures are the official art at the source's height.
  const first = page.locator('[data-panel="layla"] img[data-splash]');
  await expect.poll(() => first.evaluate((el: HTMLImageElement) => el.naturalHeight)).toBe(1440);
});

test("the theme plays from memory, loops, goes on across a pair and obeys the sound switch", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "One screen is enough for the sound.");
  await open(page, "lesley");
  // A press of the visitor (the browser's rule for sound).
  await page.mouse.click(10, 880);
  await expect
    .poll(async () => (await song(page))?.current, { timeout: 30_000 })
    .toBe("music-change-lesley-display");
  await expect.poll(async () => (await song(page))?.live).toBe(true);
  const first = await song(page);
  expect(first?.loop).toBe(true);
  expect(first?.fromMemory).toBe(true);
  expect(first?.nav).toBe(TITLE["music-change-lesley-display"]);

  const plays = await page.evaluate(() => new Audio().canPlayType('audio/mp4; codecs="mp4a.40.2"'));
  test.skip(plays === "", "This browser cannot play AAC: the state above is what can be checked.");

  await expect.poll(async () => (await song(page))?.paused).toBe(false);
  const before = (await song(page))?.time ?? 0;

  // Chang'e shares the song: it goes on, it does not start again.
  await page.keyboard.press("ArrowRight");
  await expect(room(page)).toHaveAttribute("data-active", "change", { timeout: 15_000 });
  await page.waitForTimeout(800);
  const pair = await song(page);
  expect(pair?.current).toBe("music-change-lesley-display");
  expect(pair?.time ?? 0).toBeGreaterThan(before);

  // The sound switch: off pauses the song where it is, on brings it back from there.
  const sound = page.locator('button[aria-keyshortcuts="M"]').first();
  await sound.click();
  await expect.poll(async () => (await song(page))?.paused).toBe(true);
  const held = (await song(page))?.time ?? 0;
  await sound.click();
  await expect.poll(async () => (await song(page))?.paused).toBe(false);
  expect((await song(page))?.time ?? 0).toBeGreaterThanOrEqual(held);

  // Ruby has another song: it takes over once the ring rests on her.
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(async () => (await song(page))?.current, { timeout: 15_000 })
    .toBe("music-angela-ruby");
  await expect.poll(async () => (await song(page))?.nav).toBe(TITLE["music-angela-ruby"]);
});

test("a character's own page plays her song", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "One screen is enough for the sound.");
  await skipGate(page);
  await page.goto(url("/collection/animation/vexana/"));
  await expect(room(page)).toHaveAttribute("data-view", "full", { timeout: 120_000 });
  await page.mouse.click(720, 450);
  await expect
    .poll(async () => (await song(page))?.current, { timeout: 30_000 })
    .toBe("music-cross-credo-vexana");
  await expect.poll(async () => (await song(page))?.live).toBe(true);
  expect((await song(page))?.nav).toBe(TITLE["music-cross-credo-vexana"]);
});
