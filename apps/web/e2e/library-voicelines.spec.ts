import { expect, test, type Page } from "@playwright/test";

import { skipGate, url } from "./helpers";

/**
 * The Voicelines room of the collection (`/collection/voicelines/`): ten panels with 380 lines in
 * Japanese and English, a play button and a live waveform, the long compilation of each
 * character, the sixteen trailer clips, search, the language switch, a random line, "play next",
 * the three notes, the keyboard (Up, Down, Enter) and the link to the lossless file.
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

async function open(page: Page, query = "") {
  await skipGate(page);
  const errors = watch(page);
  await page.goto(url(`/collection/voicelines/${query}`));
  await expect(page.locator("[data-voice-play]").first()).toBeVisible({ timeout: 60_000 });
  return errors;
}

/** If the site's sound is off, the first press opens a question. Answer it. */
async function answerSoundPrompt(page: Page) {
  const turnOn = page.getByRole("button", { name: "Turn sound on" });
  if (await turnOn.isVisible().catch(() => false)) await turnOn.click();
}

/** Type into the search box. Retried, because a value typed before the page has hydrated is lost. */
async function search(page: Page, text: string) {
  const box = page.getByRole("searchbox");
  await expect(async () => {
    await box.fill(text);
    const q = new URL(page.url()).searchParams.get("q");
    expect(q).toBe(text);
  }).toPass({ timeout: 20_000 });
}

test("shows ten panels, the rail, 396 play buttons and the totals", async ({ page }) => {
  const errors = await open(page);
  await expect(page.locator("section[data-slug]")).toHaveCount(11);
  await expect(page.locator("[data-voice-play]")).toHaveCount(396);
  await expect(
    page.getByRole("navigation", { name: "Characters" }).getByRole("button"),
  ).toHaveCount(11);
  await expect(page.getByText("380 lines, 10 recordings, 16 trailer clips")).toBeVisible();
  expect(errors).toEqual([]);
});

test("a line plays, shows a pressed state and stops by itself", async ({ page }) => {
  await open(page);
  const first = page.getByRole("button", { name: "Play Fanny, line 02" });
  await first.click();
  await answerSoundPrompt(page);
  await expect(first).toHaveAttribute("aria-pressed", "true", { timeout: 15_000 });
  await expect(first).toHaveAttribute("aria-pressed", "false", { timeout: 15_000 });
});

test("Up and Down move between play buttons and Enter plays", async ({ page }) => {
  await open(page);
  const one = page.getByRole("button", { name: "Play Fanny, line 01" });
  await one.focus();
  await page.keyboard.press("ArrowDown");
  const two = page.getByRole("button", { name: "Play Fanny, line 02" });
  await expect(two).toBeFocused();
  await page.keyboard.press("Enter");
  await answerSoundPrompt(page);
  await expect(two).toHaveAttribute("aria-pressed", "true", { timeout: 15_000 });
  await page.keyboard.press("ArrowUp");
  await expect(one).toBeFocused();
});

test("random line and play next each start one line", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: /random line/i }).click();
  await answerSoundPrompt(page);
  await expect(page.locator('[data-voice-play][aria-pressed="true"]')).toHaveCount(1, {
    timeout: 15_000,
  });
  await page.getByRole("button", { name: /play next/i }).click();
  await expect(page.locator('[data-voice-play][aria-pressed="true"]')).toHaveCount(1, {
    timeout: 15_000,
  });
  await expect(page).toHaveURL(/i=voice-/);
});

test("search covers the English and the Japanese and keeps the address", async ({ page }) => {
  await open(page);
  await search(page, "shooting star");
  await expect(page.getByRole("status").filter({ hasText: /lines? match/ })).toBeVisible();
  await expect(page.locator("#voice-vexana-42")).toBeVisible();
  await search(page, "ジョーカー");
  await expect(page.locator("#voice-lesley-36")).toBeVisible();
  await expect(page.locator("#voice-lesley-37")).toBeVisible();
  await search(page, "zzzzqqq");
  await expect(page.getByText("No voice line matches")).toBeVisible();
});

test("the language switch hides the other language", async ({ page }) => {
  await open(page);
  const row = page.locator("#voice-fanny-02");
  await expect(row.getByText("Off we go, toward a free world!")).toBeVisible();
  await page
    .getByRole("group", { name: "Language" })
    .getByRole("button", { name: "Japanese" })
    .click();
  await expect(row.getByText("Off we go, toward a free world!")).toHaveCount(0);
  await expect(row.getByText("自由な世界に向かって出発よ")).toBeVisible();
  await page
    .getByRole("group", { name: "Language" })
    .getByRole("button", { name: "English" })
    .click();
  await expect(row.getByText("自由な世界に向かって出発よ")).toHaveCount(0);
  await expect(page).toHaveURL(/lang=en/);
});

test("the three notes are shown", async ({ page }) => {
  await open(page);
  await expect(page.locator("#voice-lesley-36")).toContainText("addressed to Chang'e");
  await expect(page.locator("#voice-vexana-42")).toContainText("cut off");
  await expect(page.locator("#voice-guinevere-30")).toContainText("also in Vexana");
});

test("a deep link scrolls to the line", async ({ page }) => {
  await open(page, "?i=voice-selena-30");
  const row = page.locator("#voice-selena-30");
  await expect(row).toBeInViewport({ timeout: 15_000 });
  await expect(row).toHaveAttribute("data-target", "true");
});

test("a compilation plays from the panel header and can be sought", async ({ page }) => {
  await open(page);
  // The name flips between Play and Pause, so the button is found by the part that stays.
  const play = page.getByRole("button", { name: /the full compilation of Layla/ });
  await play.click();
  await answerSoundPrompt(page);
  await expect(play).toHaveAttribute("aria-pressed", "true", { timeout: 15_000 });
  const seek = page.getByRole("slider", { name: "Position in the compilation of Layla" });
  await expect(seek).toBeEnabled();
  await play.click();
  await expect(play).toHaveAttribute("aria-pressed", "false");
});

test("the trailer clips show the Japanese, the trailer's subtitle and the note", async ({
  page,
}) => {
  await open(page);
  const clip = page.locator("#voice-trailer-01");
  await clip.scrollIntoViewIfNeeded();
  await expect(clip).toContainText("アンジェラ、やめて！");
  await expect(clip).toContainText("Angela, stop!");
  await expect(clip).toContainText("No official translation");
  await expect(
    clip.getByRole("link", { name: /Watch this moment in the trailer/ }),
  ).toHaveAttribute("href", /i=film-ruby-and-angela-video-trailer-trailer-final&t=26/);
});

test("every line has a link to its lossless file", async ({ page }) => {
  await open(page);
  const link = page
    .locator("#voice-layla-05")
    .getByRole("link", { name: /Download the lossless FLAC/ });
  await expect(link).toHaveAttribute("href", /voicelines\/layla\/05\.flac$/);
  await expect(link).toHaveAttribute("download", /^05_.+\.flac$/);
});

test("a compilation that ends can be played again from the start", async ({ page }) => {
  await open(page);
  const play = page.getByRole("button", { name: /the full compilation of Fanny/ });
  await play.click();
  await answerSoundPrompt(page);
  await expect(play).toHaveAttribute("aria-pressed", "true", { timeout: 15_000 });
  // Fanny's recording is 126.7 s long. Jump to its last two seconds.
  await page
    .getByRole("slider", { name: "Position in the compilation of Fanny" })
    .evaluate((el) => {
      const input = el as HTMLInputElement;
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      set?.call(input, "125");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  await expect(play).toHaveAttribute("aria-pressed", "false", { timeout: 20_000 });
  await play.click();
  await expect(play).toHaveAttribute("aria-pressed", "true", { timeout: 15_000 });
  const seek = page.getByRole("slider", { name: "Position in the compilation of Fanny" });
  await expect
    .poll(async () => Number(await seek.inputValue()), { timeout: 15_000 })
    .toBeLessThan(20);
});
