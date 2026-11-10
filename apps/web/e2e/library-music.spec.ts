import { expect, test, type Page } from "@playwright/test";

import { skipGate, url } from "./helpers";

/**
 * The Music room of the collection (`/collection/music/`): a field of discs that turns without end
 * (WebGL), the words of the disc in front laid over it, a press that plays the disc through the
 * room's player, and the plain list for a browser without WebGL. The checks go through the page's
 * own controls, so they hold with and without WebGL.
 */

test.describe.configure({ timeout: 120_000 });

/** Console errors and uncaught exceptions. Files of the library origin belong to the pipeline. */
function watch(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const where = msg.location().url;
    if (where.includes("/library/v1/")) return;
    errors.push(`${msg.text()} ${where}`);
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

const field = (page: Page) => page.locator("[aria-roledescription='carousel']");
/** The title of the disc in front. */
const front = (page: Page) => field(page).locator("h2");

async function open(page: Page, query = "") {
  await skipGate(page);
  const errors = watch(page);
  await page.goto(url(`/collection/music/${query}`));
  // The data is in once the plain list has its nine tracks (it is always in the page).
  await expect(page.locator("li[id^='music-']")).toHaveCount(9, { timeout: 60_000 });
  return errors;
}

/** Open the room and wait for the field (skips the test when this browser has no WebGL). */
async function openField(page: Page, query = "") {
  const errors = await open(page, query);
  const live = await field(page)
    .waitFor({ timeout: 30_000 })
    .then(() => true)
    .catch(() => false);
  test.skip(!live, "This browser has no WebGL: the plain list is tested on its own.");
  await expect(front(page)).toBeVisible({ timeout: 30_000 });
  // The scene takes presses once its faces are in (`data-entered`). The loading screen waits for
  // them on a real visit, but these specs skip it, so a press could land before the faces arrive.
  await expect(field(page)).toHaveAttribute("data-entered", "true", { timeout: 60_000 });
  return errors;
}

/** If the site's sound is off, the first press opens a question. Answer it. */
async function answerSoundPrompt(page: Page) {
  const turnOn = page.getByRole("button", { name: "Turn sound on" });
  if (await turnOn.isVisible().catch(() => false)) await turnOn.click();
}

const player = (page: Page) => page.getByRole("region", { name: "Music player" });
const seekValue = async (page: Page) =>
  Number(await player(page).getByRole("slider", { name: "Seek" }).inputValue());

test("keeps the nine tracks and their credits in the page", async ({ page }) => {
  const errors = await open(page);
  const wb = page.locator("#music-we-believe");
  await expect(wb).toContainText("Yasuharu Takanashi");
  await expect(wb).toContainText("Funta7");
  await expect(wb).toContainText("Yoshino Nanjo");
  await expect(page.locator("#music-lullaby-of-oblivion")).toContainText("Kosuke Mizukami");
  await expect(page.locator("#music-gray-new-world")).toContainText("Rino");
  await expect(page.locator("#music-cross-credo-vexana")).toContainText("WaMi");
  await expect(page.locator("#music-cross-credo-guinevere")).toContainText("Eye");
  expect(errors).toEqual([]);
});

test("has one way out, no way to the other rooms, and a bar without a background", async ({
  page,
}) => {
  await open(page);
  await expect(page.locator("[data-room-back]")).toHaveAttribute("href", /\/collection\/?$/);
  for (const room of ["arts", "voicelines", "fanart", "comic", "lore", "design", "others"]) {
    await expect(page.locator(`main a[href*='/collection/${room}']`)).toHaveCount(0);
  }
  await expect(page.locator("header[data-bare='true']")).toHaveCount(1);
  await expect(page.locator("h1")).toHaveCount(1);
});

test("the field turns without end, both ways", async ({ page }) => {
  await openField(page);
  await expect(front(page)).toHaveText("We Believe");
  // Back past the first disc comes the last.
  await field(page).getByRole("button", { name: "Previous disc" }).click();
  await expect(front(page)).toHaveText("The Aspirants soundtrack, in full", { timeout: 10_000 });
  // On past the last comes the first again.
  await field(page).getByRole("button", { name: "Next disc" }).click();
  await expect(front(page)).toHaveText("We Believe", { timeout: 10_000 });
  // The arrows turn it too, and the address follows the disc in front.
  await page.keyboard.press("ArrowRight");
  await expect(front(page)).toHaveText(/Chang'e and Lesley/, { timeout: 10_000 });
  await expect(page).toHaveURL(/i=music-change-lesley-display/);
});

test("a link opens the room on its disc", async ({ page }) => {
  await openField(page, "?i=music-gray-new-world");
  await expect(front(page)).toHaveText("Gray New World");
  await expect(field(page)).toContainText("Rino");
});

test("a press plays the disc in front through the room's player", async ({ page }) => {
  await openField(page);
  await field(page).getByRole("button", { name: /^Play/ }).click();
  await answerSoundPrompt(page);
  await expect(player(page)).toBeVisible();
  await expect(player(page).getByRole("button", { name: "Pause", exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(field(page).getByRole("button", { name: /^Pause/ })).toBeVisible();
  const first = await seekValue(page);
  await expect.poll(() => seekValue(page), { timeout: 15_000 }).toBeGreaterThan(first);
});

test("the player's keys change track, and the field follows", async ({ page }) => {
  await openField(page);
  await field(page).getByRole("button", { name: /^Play/ }).click();
  await answerSoundPrompt(page);
  await expect(player(page).getByRole("button", { name: "Pause", exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await page.keyboard.press("n");
  await expect(player(page).locator("p[aria-live]")).toContainText(/Chang'e and Lesley/i);
  await expect(front(page)).toHaveText(/Chang'e and Lesley/, { timeout: 10_000 });
  await page.keyboard.press("p");
  await page.keyboard.press("p");
  // Back past the first track comes the last, like the field.
  await expect(player(page).locator("p[aria-live]")).toContainText(/soundtrack, in full/i);
  await page.keyboard.press("q");
  await expect(page.getByRole("region", { name: "Queue" }).getByRole("listitem")).toHaveCount(9);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("region", { name: "Queue" })).toHaveCount(0);
});

test("downloads the original and links to the films", async ({ page }) => {
  await openField(page);
  await expect(field(page).getByRole("link", { name: "Download We Believe" })).toHaveAttribute(
    "href",
    /music\/original\/we-believe\.m4a$/,
  );
  await field(page)
    .getByRole("button", { name: /^Watch/ })
    .click();
  const films = field(page).locator("a[href*='/collection/video/']");
  await expect(films).toHaveCount(5);
  await expect(films.first()).toHaveAttribute(
    "href",
    /collection\/video\/films\/?\?i=film-layla-and-fanny-video-official-lore-trailer-trailer/,
  );
  await page.keyboard.press("Escape");
  await expect(films.first()).toBeHidden();
});

test("a chapter of the long listen plays from its track", async ({ page }) => {
  await openField(page, "?i=music-soundtrack-full");
  await expect(front(page)).toHaveText("The Aspirants soundtrack, in full");
  await field(page).getByRole("button", { name: "Chapters" }).click();
  await field(page)
    .getByRole("button", { name: /Gray New World/ })
    .click();
  await answerSoundPrompt(page);
  await expect(player(page)).toBeVisible();
  await expect.poll(() => seekValue(page), { timeout: 15_000 }).toBeGreaterThan(190);
});

test("ends with the takedown line", async ({ page }) => {
  await openField(page);
  await expect(field(page).getByRole("link", { name: "open an issue" })).toHaveAttribute(
    "href",
    /github\.com\/rencreations\/aspirant\/issues/,
  );
});

test("without WebGL the room is the plain list, and every track still plays", async ({ page }) => {
  await page.addInitScript(() => {
    // A browser without WebGL: the 2D canvas stays.
    const proto = HTMLCanvasElement.prototype as unknown as {
      getContext: (this: HTMLCanvasElement, type: string, ...rest: unknown[]) => unknown;
    };
    const original = proto.getContext;
    proto.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (type.startsWith("webgl")) return null;
      return original.call(this, type, ...rest);
    };
  });
  await open(page);
  await expect(field(page)).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: "Music" })).toBeVisible();
  const play = page.locator("#music-we-believe").getByRole("button", { name: /^Play We Believe/ });
  await expect(play).toBeVisible();
  await play.click();
  await answerSoundPrompt(page);
  await expect(player(page)).toBeVisible();
  await expect(page.getByRole("link", { name: "open an issue" })).toHaveAttribute(
    "href",
    /github\.com\/rencreations\/aspirant\/issues/,
  );
});
