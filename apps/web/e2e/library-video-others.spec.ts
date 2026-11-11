import { expect as baseExpect, test, type Page } from "@playwright/test";

import { skipGate, url } from "./helpers";

/**
 * The Others room of the collection (`/collection/video/others/`): one wall of every video that is
 * not one of the ten films. The data file is in the repo, the pictures and videos are in the library
 * (R2, or the local mirror in development), so these checks stand on structure and states: the
 * bundled Chromium cannot play H.264, and a thumbnail that is not uploaded yet must not fail them.
 */

test.describe.configure({ timeout: 120_000 });

// The wall draws in slices and a development server compiles on demand: give each check room.
const expect = baseExpect.configure({ timeout: 15_000 });

const TEASER = "film-layla-and-fanny-video-official-lore-teaser-001-2753027083653666852";
const LESLEY_TEASER = "film-lesley-and-change-video-official-teaser-001-3307542160288522496";
const DRAMA_3A2 = "film-vexana-and-guinevere-video-interactive-drama-3a2";
const SHELVES = [
  "parody",
  "trailers",
  "shorts",
  "showcases",
  "music",
  "interviews",
  "drama",
  "live",
  "reels",
  "gameplay",
  "emotes",
  "edits",
  "fan",
];

/** Console errors and uncaught exceptions. Files of the library origin belong to the pipeline, not to this code. */
function watch(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    if (msg.location().url.includes("/library/v1/")) return;
    errors.push(`${msg.text()} ${msg.location().url}`);
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

async function open(page: Page, query = "") {
  await skipGate(page);
  const errors = watch(page);
  await page.goto(url(`/collection/video/others/${query}`));
  await expect(page.locator("[data-tile]").first()).toBeAttached();
  return errors;
}

/** Press a shelf in the index, then wait until the page has moved there and stopped (it glides, then corrects itself once). */
async function jumpTo(page: Page, shelf: RegExp) {
  await page
    .getByRole("navigation", { name: "Shelves of the wall" })
    .getByRole("button", { name: shelf })
    .click();
  await expect
    .poll(() => page.evaluate(() => window.scrollY), { timeout: 15_000 })
    .toBeGreaterThan(300);
  await settled(page);
}

/** Wait until the page has stopped scrolling. */
async function settled(page: Page) {
  let last = -1;
  await expect
    .poll(
      async () => {
        const y = await page.evaluate(() => window.scrollY);
        const same = Math.abs(y - last) < 2;
        last = y;
        await page.waitForTimeout(450);
        return same;
      },
      { timeout: 15_000 },
    )
    .toBe(true);
}

const dialog = (page: Page) => page.getByRole("dialog").first();
const tiles = (page: Page) => page.locator("[data-tile]");
const tile = (page: Page, id: string) => page.locator(`[data-tile="${id}"] button`);

test("shows the wall: one h1, thirteen shelves in order, the parody first, built in slices", async ({
  page,
}) => {
  const errors = await open(page);
  await expect(page.locator("h1")).toHaveText("Others");

  // The wall is built a few shelves at a time: all of it is there a moment later.
  await expect.poll(() => tiles(page).count(), { timeout: 20_000 }).toBe(92);
  const shelves = await page
    .locator("section[data-shelf]")
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-shelf")));
  expect(shelves).toEqual(SHELVES);

  const parody = page.locator('section[data-shelf="parody"]');
  await expect(parody.locator("[data-tile]")).toHaveCount(1);
  await expect(parody).toContainText("Non-canon parody");
  expect(errors).toEqual([]);
});

test("a video opened by a link from another room closes back to that room", async ({ page }) => {
  await skipGate(page);
  const id = "film-selena-and-obsidia-video-music-collection-001-4013351897154849593";
  await page.goto(url(`/collection/video/others/?i=${id}&t=191&from=music`));
  await expect(dialog(page)).toBeVisible({ timeout: 60_000 });
  // The back button names the room the visitor came from.
  await expect(page.locator("[data-room-back]")).toContainText("Music");
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/collection\/music\/?(\?|$)/, { timeout: 30_000 });
});

test("has one way out to the collection and no link to another room", async ({ page }) => {
  await open(page);
  const back = page.locator("[data-room-back]");
  await expect(back).toHaveCount(1);
  await expect(back).toHaveAttribute("href", /\/collection\/?$/);
  await expect(page.getByRole("navigation", { name: "Rooms of the collection" })).toHaveCount(0);

  // Every link of the page: the takedown page, the way back, the top bar, and the drama's own page.
  const hrefs = await page
    .locator("main a[href], footer a[href], header a[href]")
    .evaluateAll((els) => els.map((e) => e.getAttribute("href") ?? ""));
  for (const href of hrefs) {
    expect(href).not.toMatch(
      /\/collection\/(arts|music|voicelines|fanart|comic|lore|design|animation|others|video\/films)/,
    );
  }
});

test("the finder: search, filters by character, canon and length, a group by pair, and clear", async ({
  page,
}) => {
  await open(page);
  await expect.poll(() => tiles(page).count()).toBe(92);

  await page.getByRole("searchbox").fill("believe");
  await expect(page).toHaveURL(/q=believe/);
  await expect(tile(page, TEASER)).toBeVisible();
  expect(await tiles(page).count()).toBeLessThan(10);

  await page.getByRole("searchbox").fill("zzzz nothing");
  await expect(page.getByText("No video matches")).toBeVisible();
  await page.getByRole("button", { name: "Clear the filters" }).click();
  await expect(page.getByRole("searchbox")).toHaveValue("");
  await expect.poll(() => tiles(page).count()).toBe(92);

  await page.getByRole("button", { name: /^Filters/ }).click();
  await page
    .getByRole("group", { name: "Character" })
    .getByRole("button", { name: /^Ruby/ })
    .click();
  await expect(page).toHaveURL(/who=ruby/);
  const ruby = await tiles(page).count();
  expect(ruby).toBeLessThan(92);
  expect(ruby).toBeGreaterThan(0);

  await page
    .getByRole("group", { name: "Canon" })
    .getByRole("button", { name: /^Fan work/ })
    .click();
  await expect(page).toHaveURL(/canon=fan/);
  expect(await tiles(page).count()).toBeLessThan(ruby);

  await page.getByRole("button", { name: "Clear all" }).click();
  await expect.poll(() => tiles(page).count()).toBe(92);

  await page
    .getByRole("group", { name: "Length" })
    .getByRole("button", { name: /^Over 10 min/ })
    .click();
  await expect(page).toHaveURL(/length=long/);
  await expect(tiles(page)).toHaveCount(4);
  await page.getByRole("button", { name: "Clear all" }).click();

  // Group by pair: the shelves become the five pairs and the rest.
  await page
    .getByRole("group", { name: "Group the wall by" })
    .getByRole("button", { name: "Pair" })
    .first()
    .click({ force: true });
  await expect(page).toHaveURL(/group=pair/);
  await expect(page.locator("section[data-shelf]")).toHaveCount(6);
  await expect.poll(() => tiles(page).count()).toBe(92);
});

test("the index follows the scroll and jumps to a shelf", async ({ page }) => {
  await open(page);
  await expect.poll(() => tiles(page).count()).toBe(92);
  const index = page.getByRole("navigation", { name: "Shelves of the wall" });
  await expect(index.getByRole("button")).toHaveCount(13);
  await expect(index.getByRole("button").first()).toHaveAttribute("aria-current", "true");

  await jumpTo(page, /^Gameplay/);
  await expect(index.getByRole("button", { name: /^Gameplay/ })).toHaveAttribute(
    "aria-current",
    "true",
  );
  const top = await page
    .locator('section[data-shelf="gameplay"]')
    .evaluate((e) => e.getBoundingClientRect().top);
  expect(top).toBeLessThan(260);
  expect(top).toBeGreaterThan(-20);
});

test("opens a video in the viewer, steps with the buttons and the arrows, and Esc closes it", async ({
  page,
}) => {
  const errors = await open(page);
  const first = page.locator('section[data-shelf="trailers"] [data-tile] button').first();
  const label = await first.getAttribute("aria-label");
  await first.click();
  await expect(dialog(page)).toBeVisible();
  await expect(page).toHaveURL(/[?&]i=film-/);
  const title = await dialog(page).getByRole("heading", { level: 2 }).textContent();
  expect(label).toContain(title ?? "?");
  const counter = dialog(page).locator("[aria-label^='Video ']");
  // The parody is the first shelf (one video), so the first trailer is the second video.
  await expect(counter).toHaveAttribute("aria-label", /^Video 2 of \d+$/);
  // Nothing plays by itself: no video element exists until play is pressed.
  await expect(page.locator("video")).toHaveCount(0);

  await dialog(page).getByRole("button", { name: "Next video" }).click();
  await expect(counter).toHaveAttribute("aria-label", /^Video 3 of \d+$/);
  const second = await dialog(page).getByRole("heading", { level: 2 }).textContent();
  expect(second).not.toBe(title);

  await page.keyboard.press("ArrowLeft");
  await expect(dialog(page).getByRole("heading", { level: 2 })).toHaveText(title ?? "");

  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  await expect(page).not.toHaveURL(/[?&]i=/);
  // Focus is back on the tile that was pressed.
  await expect(first).toBeFocused();
  expect(errors).toEqual([]);
});

test("the Back button closes the viewer and keeps the place on the wall", async ({ page }) => {
  await open(page);
  await expect.poll(() => tiles(page).count()).toBe(92);
  await jumpTo(page, /^Edits/);
  const before = await page.evaluate(() => window.scrollY);
  expect(before).toBeGreaterThan(1000);
  await page.locator('section[data-shelf="edits"] [data-tile] button').first().click();
  await expect(dialog(page)).toBeVisible();
  await page.goBack();
  await expect(dialog(page)).toHaveCount(0);
  const after = await page.evaluate(() => window.scrollY);
  expect(Math.abs(after - before)).toBeLessThan(40);
});

test("a deep link with a start time opens the video primed at that second", async ({ page }) => {
  await open(page, `?i=${LESLEY_TEASER}&t=45`);
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).getByText("Plays from 0:45")).toBeVisible();
  await expect(page.locator("video")).toHaveCount(0);
  // The "continue where you stopped" bar never shows when the address names a video.
  await expect(page.getByRole("region", { name: "Continue where you stopped" })).toHaveCount(0);
});

test("a video posted under a second id opens through that id", async ({ page }) => {
  await open(page, `?i=${DRAMA_3A2}`);
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).getByRole("heading", { level: 2 })).toContainText("Where They Met");
  await expect(dialog(page).getByRole("link", { name: /interactive drama/i })).toHaveAttribute(
    "href",
    /\/story\/interactive-drama\/?$/,
  );
});

test("labels: the parody is non-canon, an official edit is not called a parody, fan work is credited", async ({
  page,
}) => {
  await open(page);
  await expect.poll(() => tiles(page).count()).toBe(92);

  const edit = page.locator('section[data-shelf="edits"] [data-tile]').first();
  await expect(edit).toContainText("Not story");
  await expect(edit).toContainText("Official edit");
  await expect(edit).not.toContainText("parody");

  const gameplay = page.locator('section[data-shelf="gameplay"] [data-tile]').first();
  await expect(gameplay).toContainText("Not story");

  const fan = page.locator('section[data-shelf="fan"] [data-tile]');
  await expect(fan.first()).toContainText("Fan work");

  // The viewer says it in full, and never with the parody's words.
  await edit.locator("button").click();
  await expect(dialog(page).getByRole("note")).toContainText("Official reel, not story");
  await expect(dialog(page).getByRole("note")).not.toContainText("parody");
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);

  await page.locator('section[data-shelf="parody"] [data-tile] button').click();
  await expect(dialog(page).getByRole("note")).toContainText("Nothing in it counts as canon");
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);

  await fan.first().locator("button").click();
  await expect(dialog(page).getByRole("note")).toContainText("fan");
  await expect(dialog(page)).toContainText(/on (TikTok|Instagram)|Artist not named/);
});

test("a hover shows the preview strip, and nothing is read until play", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "a hover needs a mouse");
  await open(page);
  const card = tile(page, TEASER);
  await card.scrollIntoViewIfNeeded();
  await expect(card.locator("img[src*='strip.webp']")).toHaveCount(0);
  await card.hover();
  await expect(card.locator("img[src*='strip.webp']")).toHaveCount(1);
  await expect(card).toHaveAttribute("data-hover", "true");
  await page.mouse.move(2, 2);
  await expect(card).not.toHaveAttribute("data-hover", "true");
  await expect(page.locator("video")).toHaveCount(0);
});

test("a scene press opens the player at that second", async ({ page }) => {
  const errors = await open(page, `?i=${LESLEY_TEASER}`);
  await expect(dialog(page)).toBeVisible();
  const scenes = dialog(page).getByRole("list").getByRole("button");
  expect(await scenes.count()).toBeGreaterThanOrEqual(5);
  await scenes.nth(3).click();
  const video = page.locator("video");
  await expect(video).toHaveCount(1);
  await expect(video).toHaveAttribute("src", /#t=\d/);
  expect(errors).toEqual([]);

  // Esc closes the player first, and the viewer stays.
  await page.keyboard.press("Escape");
  await expect(page.locator("video")).toHaveCount(0, { timeout: 10_000 });
  await expect(dialog(page)).toBeVisible();
});

test("remembers where the visitor stopped and offers to continue", async ({ page }) => {
  await open(page);
  await expect.poll(() => tiles(page).count()).toBe(92);
  await jumpTo(page, /^Emotes/);
  const stopped = await page.evaluate(() => window.scrollY);
  expect(stopped).toBeGreaterThan(1500);
  // The place is saved a moment after the last scroll.
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            JSON.parse(window.localStorage.getItem("aspirants:video-others") ?? "{}") as {
              at?: string;
            }
          ).at,
      ),
    )
    .toBeTruthy();

  await page.goto(url("/collection/video/others/"));
  const bar = page.getByRole("region", { name: "Continue where you stopped" });
  await expect(bar).toBeVisible();
  await bar.getByRole("button", { name: "Continue" }).click();
  await expect
    .poll(() => page.evaluate(() => window.scrollY), { timeout: 10_000 })
    .toBeGreaterThan(1000);
});

test("the old Films address forwards to the right room", async ({ page }) => {
  await skipGate(page);
  await page.goto(url(`/collection/films/?i=${TEASER}&t=5`));
  await expect(page).toHaveURL(/\/collection\/video\/others\/\?i=.*&t=5/);
  await expect(dialog(page)).toBeVisible();
});

test("the arrow keys move over the wall, and the wheel over the viewer leaves the page where it is", async ({
  page,
}) => {
  await open(page);
  await expect.poll(() => tiles(page).count()).toBe(92);
  const first = page.locator("[data-tile] button").first();
  await first.focus();
  const idOfFocus = () =>
    page.evaluate(
      () => document.activeElement?.closest("[data-tile]")?.getAttribute("data-tile") ?? "",
    );
  const startId = await idOfFocus();
  await page.keyboard.press("ArrowRight");
  const second = await idOfFocus();
  expect(second).not.toBe(startId);
  await page.keyboard.press("ArrowLeft");
  expect(await idOfFocus()).toBe(startId);
  const topOf = (tileId: string) =>
    page.evaluate(
      (t) => document.querySelector(`[data-tile="${t}"]`)?.getBoundingClientRect().top ?? 0,
      tileId,
    );
  const before = await topOf(startId);
  await page.keyboard.press("ArrowDown");
  const below = await idOfFocus();
  expect(below).not.toBe(startId);
  // The tile below sits lower on the page (the page may have scrolled to show it, so compare the document positions).
  const docTop = (tileId: string) =>
    page.evaluate(
      (t) =>
        (document.querySelector(`[data-tile="${t}"]`)?.getBoundingClientRect().top ?? 0) +
        window.scrollY,
      tileId,
    );
  expect(await docTop(below)).toBeGreaterThan(before - 1);

  // Enter opens it, and the wheel over the open viewer does not move the page behind.
  await page.keyboard.press("Enter");
  await expect(dialog(page)).toBeVisible();
  const y = await page.evaluate(() => window.scrollY);
  await page.mouse.move(300, 300);
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.scrollY)).toBe(y);
});
