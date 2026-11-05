import { expect, test, type Page } from "@playwright/test";

import { skipGate, url } from "./helpers";

/**
 * The Music room of the collection (`/collection/music/`): the records on a shelf, the tracklist
 * with credits, chapters and related films, and one player that stays at the foot of the screen
 * (play, pause, seek, volume, queue, keyboard, download).
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
  await page.goto(url(`/collection/music/${query}`));
  await expect(page.locator("li[id^='music-']").first()).toBeVisible({ timeout: 60_000 });
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

test("lists the tracks on the shelf and in the tracklist, with the credits of the sources", async ({
  page,
}) => {
  const errors = await open(page);
  await expect(page.locator("li[id^='music-']")).toHaveCount(9);
  await expect(page.getByRole("list", { name: "Records" }).getByRole("button")).toHaveCount(9);
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

test("a record plays in the player, which moves with the time and keeps its place", async ({
  page,
}) => {
  await open(page);
  await page
    .locator("#music-we-believe")
    .getByRole("button", { name: /^Play We Believe/ })
    .click();
  await answerSoundPrompt(page);
  await expect(player(page)).toBeVisible();
  await expect(player(page).getByRole("button", { name: "Pause", exact: true })).toBeVisible({
    timeout: 15_000,
  });
  const first = await seekValue(page);
  await expect.poll(() => seekValue(page), { timeout: 15_000 }).toBeGreaterThan(first);
  // The player stays while the visitor moves down the room.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(player(page)).toBeInViewport();
});

test("the keyboard plays, pauses, seeks, changes track and opens the queue", async ({ page }) => {
  await open(page);
  await page
    .locator("#music-we-believe")
    .getByRole("button", { name: /^Play We Believe/ })
    .click();
  await answerSoundPrompt(page);
  await expect(player(page).getByRole("button", { name: "Pause", exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await page.locator("body").click({ position: { x: 4, y: 400 } });
  const before = await seekValue(page);
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => seekValue(page)).toBeGreaterThanOrEqual(before + 4);
  await page.keyboard.press(" ");
  await expect(player(page).getByRole("button", { name: "Play", exact: true })).toBeVisible();
  await page.keyboard.press(" ");
  await expect(player(page).getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  await page.keyboard.press("n");
  await expect(player(page).locator("p[aria-live]")).toContainText(/Chang'e and Lesley/i);
  await page.keyboard.press("q");
  await expect(page.getByRole("region", { name: "Queue" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Queue" }).getByRole("listitem")).toHaveCount(9);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("region", { name: "Queue" })).toHaveCount(0);
});

test("a chapter of the long listen jumps to its track", async ({ page }) => {
  await open(page);
  const full = page.locator("#music-soundtrack-full");
  await full.scrollIntoViewIfNeeded();
  await full.getByRole("button", { name: /Gray New World/ }).click();
  await answerSoundPrompt(page);
  await expect(player(page)).toBeVisible();
  await expect.poll(() => seekValue(page), { timeout: 15_000 }).toBeGreaterThan(190);
});

test("search and the kind filter narrow the list and keep the address", async ({ page }) => {
  await open(page);
  const box = page.getByRole("searchbox");
  await expect(async () => {
    await box.fill("takanashi");
    await expect(page).toHaveURL(/q=takanashi/, { timeout: 1500 });
  }).toPass({ timeout: 20_000 });
  await expect(page.locator("li[id^='music-']")).toHaveCount(1);
  await box.fill("");
  await page
    .getByRole("group", { name: "Kind" })
    .getByRole("button", { name: /Pieces/ })
    .click();
  await expect(page.locator("li[id^='music-']")).toHaveCount(2);
  await expect(page).toHaveURL(/kind=piece/);
});

test("related films are links into the Films room", async ({ page }) => {
  await open(page);
  const links = page.locator("#music-we-believe").getByRole("link", { name: /Music video/ });
  await expect(links).toHaveAttribute(
    "href",
    /collection\/films\/?\?i=film-layla-and-fanny-video-official-other-music-video-music/,
  );
});

test("every track has a download link", async ({ page }) => {
  await open(page);
  await expect(
    page.locator("#music-we-believe").getByRole("link", { name: /Download We Believe/ }),
  ).toHaveAttribute("href", /music\/original\/we-believe\.m4a$/);
});

/** Move the seek bar the way a drag does: set the value and send the input event React listens to. */
async function seekBarTo(page: Page, seconds: number) {
  await player(page)
    .getByRole("slider", { name: "Seek" })
    .evaluate((el, value) => {
      const input = el as HTMLInputElement;
      // The native setter is the way to change a React controlled input from a test.
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set as
        ((this: HTMLInputElement, value: string) => void) | undefined;
      set?.call(input, String(value));
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }, seconds);
}

test("a track that ends starts the next one, and the last track plays again after it ends", async ({
  page,
}) => {
  await open(page);
  await page
    .locator("#music-obsidia-aspirant")
    .getByRole("button", { name: /^Play Obsidia: Aspirant/ })
    .click();
  await answerSoundPrompt(page);
  await expect(player(page).getByRole("button", { name: "Pause", exact: true })).toBeVisible({
    timeout: 15_000,
  });
  // Obsidia: Aspirant is 36.4 s long. Jump to its last second.
  await seekBarTo(page, 35.4);
  await expect(player(page).locator("p[aria-live]")).toContainText(/Obsidia: Solo/i, {
    timeout: 15_000,
  });
  // The queue ends with the long listen. Let Solo end, then the long listen.
  await seekBarTo(page, 79.2);
  await expect(player(page).locator("p[aria-live]")).toContainText(/soundtrack, in full/i, {
    timeout: 15_000,
  });
  await expect(player(page).getByRole("button", { name: "Pause", exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await seekBarTo(page, 854);
  // The end of the queue: it stops and offers Play again.
  await expect(player(page).getByRole("button", { name: "Play", exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await player(page).getByRole("button", { name: "Play", exact: true }).click();
  await expect(player(page).getByRole("button", { name: "Pause", exact: true })).toBeVisible({
    timeout: 15_000,
  });
  // It started again from the beginning and moves on.
  await expect.poll(() => seekValue(page), { timeout: 15_000 }).toBeLessThan(20);
  const a = await seekValue(page);
  await expect.poll(() => seekValue(page), { timeout: 15_000 }).toBeGreaterThan(a);
});
