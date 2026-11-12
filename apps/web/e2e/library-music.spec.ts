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

const SOUNDTRACK = "film-selena-and-obsidia-video-music-collection-001-4013351897154849593";

const field = (page: Page) => page.locator("[aria-roledescription='carousel']");
/** The title of the disc in front. */
const front = (page: Page) => field(page).locator("h2");

async function open(page: Page, query = "") {
  await skipGate(page);
  const errors = watch(page);
  await page.goto(url(`/collection/music/${query}`));
  // The data is in once the plain list has its seven tracks (it is always in the page).
  await expect(page.locator("li[id^='music-']")).toHaveCount(7, { timeout: 60_000 });
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

async function playFront(page: Page) {
  await field(page)
    .getByRole("button", { name: /^(Play|Resume)/ })
    .click();
  await answerSoundPrompt(page);
  await expect(player(page)).toBeVisible();
}

interface Snapshot {
  discs: Array<{ front: boolean; upright: boolean; spin: number; settling: boolean }>;
}

/** The discs as the scene sees them (`window.__musicRoom`), or null. */
async function discs(page: Page): Promise<Snapshot | null> {
  return page.evaluate(
    () =>
      (
        window as unknown as { __musicRoom?: { snapshot: () => Snapshot } }
      ).__musicRoom?.snapshot() ?? null,
  );
}

/** Every disc on screen comes to rest with its picture upright (a whole number of turns). */
async function expectUpright(page: Page) {
  await expect
    .poll(async () => (await discs(page))?.discs.every((d) => d.upright) ?? false, {
      timeout: 10_000,
      intervals: [200],
    })
    .toBe(true);
}

test("keeps the seven tracks and their credits in the page", async ({ page }) => {
  const errors = await open(page);
  const wb = page.locator("#music-we-believe");
  await expect(wb).toContainText("Yasuharu Takanashi");
  await expect(wb).toContainText("Funta7");
  await expect(wb).toContainText("Yoshino Nanjo");
  await expect(page.locator("#music-lullaby-of-oblivion")).toContainText("Kosuke Mizukami");
  await expect(page.locator("#music-gray-new-world")).toContainText("Rino");
  await expect(page.locator("#music-cross-credo-vexana")).toContainText("WaMi");
  await expect(page.locator("#music-cross-credo-guinevere")).toContainText("Eye");
  await expect(page.locator("#music-angela-ruby")).toContainText("Steven Song");
  // The owner's order.
  await expect(page.locator("li[id^='music-'] h2")).toHaveText([
    "Gray New World",
    "Lullaby of Oblivion",
    "Cross x Credo: Vexana version",
    "Cross x Credo: Guinevere version",
    "Chang'e & Lesley Music",
    "Angela & Ruby Music",
    "We Believe!",
  ]);
  expect(errors).toEqual([]);
});

test("has one way out, no way to the other rooms, and a bar without a background", async ({
  page,
}) => {
  await open(page);
  await expect(page.locator("[data-room-back]")).toHaveAttribute("href", /\/collection\/?$/);
  for (const room of ["arts", "voicelines", "models", "comic", "lore", "design", "others"]) {
    await expect(page.locator(`main a[href*='/collection/${room}']`)).toHaveCount(0);
  }
  await expect(page.locator("header[data-bare='true']")).toHaveCount(1);
  await expect(page.locator("h1")).toHaveCount(1);
});

test("the field turns without end, both ways", async ({ page }) => {
  await openField(page);
  await expect(front(page)).toHaveText("Gray New World");
  // Back past the first disc comes the last.
  await field(page).getByRole("button", { name: "Previous disc" }).click();
  await expect(front(page)).toHaveText("We Believe!", { timeout: 10_000 });
  // On past the last comes the first again.
  await field(page).getByRole("button", { name: "Next disc" }).click();
  await expect(front(page)).toHaveText("Gray New World", { timeout: 10_000 });
  // The arrows turn it too, and the address follows the disc in front.
  await page.keyboard.press("ArrowRight");
  await expect(front(page)).toHaveText("Lullaby of Oblivion", { timeout: 10_000 });
  await expect(page).toHaveURL(/i=music-lullaby-of-oblivion/);
});

test("a link opens the room on its disc", async ({ page }) => {
  await openField(page, "?i=music-angela-ruby");
  await expect(front(page)).toHaveText("Angela & Ruby Music");
  await expect(field(page)).toContainText("Steven Song");
});

test("comes back to the track it was on when the address names none", async ({ page }) => {
  await openField(page, "?i=music-cross-credo-vexana");
  await expect(front(page)).toHaveText("Cross x Credo: Vexana version");
  // A video room's way back is `/collection/music` with no `?i=`.
  await page.goto(url("/collection/music/"));
  await expect(field(page)).toHaveAttribute("data-entered", "true", { timeout: 60_000 });
  await expect(front(page)).toHaveText("Cross x Credo: Vexana version");
});

test("a press plays the disc in front through the room's player", async ({ page }) => {
  await openField(page);
  await playFront(page);
  await expect(player(page).getByRole("button", { name: "Pause", exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(field(page).getByRole("button", { name: /^Pause/ })).toBeVisible();
  const first = await seekValue(page);
  await expect.poll(() => seekValue(page), { timeout: 15_000 }).toBeGreaterThan(first);
});

test("the player's keys change track, and the field follows", async ({ page }) => {
  await openField(page);
  await playFront(page);
  await expect(player(page).getByRole("button", { name: "Pause", exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await page.keyboard.press("n");
  await expect(player(page).locator("p[aria-live]")).toContainText(/Lullaby of Oblivion/i);
  await expect(front(page)).toHaveText("Lullaby of Oblivion", { timeout: 10_000 });
  await page.keyboard.press("p");
  await page.keyboard.press("p");
  // Back past the first track comes the last, like the field.
  await expect(player(page).locator("p[aria-live]")).toContainText(/We Believe!/i);
  await page.keyboard.press("q");
  await expect(page.getByRole("region", { name: "Queue" }).getByRole("listitem")).toHaveCount(7);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("region", { name: "Queue" })).toHaveCount(0);
});

test("the player bar loops the track it was set on, and has no download", async ({ page }) => {
  await openField(page);
  await playFront(page);
  const bar = player(page);
  await expect(bar.getByRole("link", { name: /Download/ })).toHaveCount(0);
  const loop = bar.getByRole("button", { name: "Loop this track" });
  await expect(loop).toHaveAttribute("aria-pressed", "false");
  await loop.click();
  await expect(loop).toHaveAttribute("aria-pressed", "true");
  await loop.click();
  await expect(loop).toHaveAttribute("aria-pressed", "false");
  await loop.click();
  // The next track the visitor chooses plays once.
  await bar.getByRole("button", { name: "Next track" }).click();
  await expect(bar.locator("p[aria-live]")).toContainText(/Lullaby of Oblivion/i);
  await expect(bar.getByRole("button", { name: "Loop this track" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  // The download is still under the disc.
  await expect(field(page).getByRole("link", { name: /^Download/ })).toBeVisible();
});

test("downloads the original and links to the films with a way back", async ({ page }) => {
  await openField(page, "?i=music-we-believe");
  await expect(field(page).getByRole("link", { name: "Download We Believe!" })).toHaveAttribute(
    "href",
    /music\/original\/we-believe\.m4a$/,
  );
  await page.getByRole("button", { name: /^Watch/ }).click();
  const films = field(page).locator("a[href*='/collection/video/']:visible");
  await expect(films).toHaveCount(5);
  await expect(films.first()).toHaveAttribute(
    "href",
    /collection\/video\/films\/?\?i=film-layla-and-fanny-video-official-lore-trailer-trailer&from=music$/,
  );
  await page.keyboard.press("Escape");
  await expect(films.first()).toBeHidden();
});

test("Watch opens each film at the owner's time, with the way back to Music", async ({ page }) => {
  await openField(page);
  await page.getByRole("button", { name: /^Watch/ }).click();
  const list = field(page).locator("a[href*='/collection/video/']:visible");
  await expect(list).toHaveCount(3);
  await expect(list.nth(0)).toContainText("Selena trailer");
  await expect(list.nth(1)).toContainText("Day of Enders");
  await expect(list.nth(2)).toContainText("Soundtrack video");
  await expect(list.nth(2)).toContainText("3:11");
  await expect(list.nth(2)).toHaveAttribute(
    "href",
    new RegExp(`collection/video/others/?\\?i=${SOUNDTRACK}&t=191&from=music$`),
  );
});

test("Watch sits beside the Collection button on narrow screens", async ({ page }) => {
  await openField(page);
  const watchBtn = page.getByRole("button", { name: /^Watch/ });
  await expect(watchBtn).toHaveCount(1);
  const back = await page.locator("[data-room-back]").boundingBox();
  const box = await watchBtn.boundingBox();
  expect(back && box).toBeTruthy();
  if (!back || !box) return;
  const narrow = (page.viewportSize()?.width ?? 1440) <= 991;
  if (narrow) {
    // On the same line, just right of it.
    expect(Math.abs(box.y + box.height / 2 - (back.y + back.height / 2))).toBeLessThan(4);
    expect(box.x).toBeGreaterThanOrEqual(back.x + back.width);
    expect(box.x - (back.x + back.width)).toBeLessThan(16);
    // It opens its list under itself.
    await watchBtn.click();
    const first = field(page).locator("a[href*='/collection/video/']:visible").first();
    const item = await first.boundingBox();
    expect(item && item.y > box.y + box.height).toBe(true);
  } else {
    // Under the disc, with the way to play.
    expect(box.y).toBeGreaterThan(back.y + 200);
  }
});

test("shows the platforms of a released single, and none for the others", async ({ page }) => {
  await openField(page);
  const links = field(page)
    .getByRole("list", { name: "Listen on the platforms" })
    .getByRole("link");
  await expect(links).toHaveCount(4);
  for (const [name, href] of [
    ["Listen on Spotify", /^https:\/\/open\.spotify\.com\/album\/3RqpCLaKIsE0RprxgkQMvy$/],
    ["Listen on Apple Music", /^https:\/\/music\.apple\.com\/id\/album\/gray-new-world-single\//],
    ["Listen on YouTube", /^https:\/\/www\.youtube\.com\/playlist\?list=/],
    ["All platforms", /^https:\/\/sndo\.ffm\.to\/nbv6a32$/],
  ] as const) {
    const link = field(page).getByRole("link", { name, exact: true });
    await expect(link).toHaveAttribute("href", href);
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  }
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(front(page)).toHaveText("Cross x Credo: Vexana version", { timeout: 10_000 });
  await expect(field(page).getByRole("list", { name: "Listen on the platforms" })).toHaveCount(0);
});

test("every disc comes to rest upright after play, pause, next, previous and a drag", async ({
  page,
}) => {
  await openField(page);
  test.skip((await discs(page)) === null, "The scene's probe hook is not there.");
  await expectUpright(page);
  const bar = player(page);
  await playFront(page);
  await page.waitForTimeout(1500);
  await bar.getByRole("button", { name: "Pause", exact: true }).click();
  await expectUpright(page);

  await bar.getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForTimeout(1200);
  await bar.getByRole("button", { name: "Next track" }).click();
  await page.waitForTimeout(1500);
  await bar.getByRole("button", { name: "Previous track" }).click();
  await page.waitForTimeout(1500);
  await bar.getByRole("button", { name: "Pause", exact: true }).click();
  await expectUpright(page);

  // A drag turns the disc in front in 3D; let go, it comes back upright.
  const box = await field(page).boundingBox();
  if (box) {
    const x = box.x + box.width * 0.55;
    const y = box.y + box.height * 0.55;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let k = 1; k <= 12; k += 1) await page.mouse.move(x + k * 4, y + k * 20);
    await page.mouse.up();
  }
  await expectUpright(page);
});

test("ends with the takedown line", async ({ page }) => {
  await openField(page);
  await expect(field(page).getByRole("link", { name: "takedown page" })).toHaveAttribute(
    "href",
    /\/takedown\/?$/,
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
  const row = page.locator("#music-we-believe");
  const play = row.getByRole("button", { name: /^Play We Believe!/ });
  await expect(play).toBeVisible();
  // Its films come back to Music too.
  await expect(row.locator("a[href*='/collection/video/']").first()).toHaveAttribute(
    "href",
    /&from=music$/,
  );
  await play.click();
  await answerSoundPrompt(page);
  await expect(player(page)).toBeVisible();
  await expect(page.getByRole("link", { name: "takedown page" })).toHaveAttribute(
    "href",
    /\/takedown\/?$/,
  );
});
