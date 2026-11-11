import { expect, test, type Page } from "@playwright/test";

import { settled, skipGate, url, watchErrors } from "./helpers";

/**
 * The Cosplay rooms of Arts: the roster of the ten Aspirants (`/collection/arts/cosplay/`) and one
 * page for each (`/collection/arts/cosplay/<slug>/`). Fanny and Layla hold photos, the other eight
 * hold none and still have a page. The checks are about structure and state (what is there, the
 * words, the address, the keys), not about pictures arriving: the files of the library may not be
 * in the bucket the run reads from.
 */

test.describe.configure({ timeout: 120_000 });

const ORDER = [
  ["fanny", "Fanny"],
  ["layla", "Layla"],
  ["ruby", "Ruby"],
  ["angela", "Angela"],
  ["lesley", "Lesley"],
  ["change", "Chang'e"],
  ["guinevere", "Guinevere"],
  ["vexana", "Vexana"],
  ["selena", "Selena"],
  ["obsidia", "Obsidia"],
] as const;

const DIALOG = "[role='dialog'][data-zoom-viewer]";
const DUO = "arts-cosplay-fanny-and-layla-photo-1-1afb08";
const LAYLA_SOLO = "arts-cosplay-layla-photo-1-674d04";

/** The console errors that are not a file of the library origin (those belong to the pipeline). */
function real(errors: string[]): string[] {
  return errors.filter((e) => !/\/library\/v1\/|Failed to load resource/u.test(e));
}

async function openCharacter(page: Page, slug: string, query = "") {
  await skipGate(page);
  const errors = watchErrors(page);
  const res = await page.goto(url(`/collection/arts/cosplay/${slug}/${query}`));
  expect(res?.status(), `${slug} answers`).toBe(200);
  return errors;
}

/**
 * Open a photo from its tile with the keyboard: the tile takes the focus (the browser brings it
 * into view), then Enter presses it.
 */
async function openTile(page: Page, id?: string) {
  const tile = id
    ? page.locator(`[data-flow-tile][data-id="${id}"]`)
    : page.locator("[data-flow-tile]").first();
  await expect(tile).toBeAttached({ timeout: 60_000 });
  await tile.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(DIALOG)).toBeVisible({ timeout: 15_000 });
}

async function noSidewaysScroll(page: Page) {
  const wide = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(wide, "the page does not scroll sideways").toBeLessThanOrEqual(1);
}

test.describe("the roster", () => {
  test("shows all ten Aspirants, with a calm line for those with no photo", async ({ page }) => {
    await skipGate(page);
    const errors = watchErrors(page);
    const res = await page.goto(url("/collection/arts/cosplay/"));
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: "Cosplay" })).toBeVisible();

    const tiles = page.locator("[data-cosplay-tile]");
    await expect(tiles).toHaveCount(10);
    expect(
      await tiles.evaluateAll((els) => els.map((el) => el.getAttribute("data-cosplay-tile"))),
    ).toEqual(ORDER.map(([slug]) => slug));
    for (const [slug, name] of ORDER) {
      await expect(page.locator(`[data-cosplay-tile="${slug}"]`)).toContainText(name);
      // Every tile shows her official art.
      await expect(page.locator(`[data-cosplay-tile="${slug}"] img`).first()).toBeAttached();
    }

    // The counts arrive with the data.
    await expect(page.locator('[data-cosplay-tile="fanny"]')).toHaveAttribute("data-count", "8");
    await expect(page.locator('[data-cosplay-tile="layla"]')).toHaveAttribute("data-count", "8");
    await expect(page.locator("[data-cosplay-total]")).toContainText("10 Aspirants, 12 photos");
    // Fanny and Layla show thumbnails; the other eight the calm line.
    expect(await page.locator('[data-cosplay-tile="fanny"] img').count()).toBeGreaterThanOrEqual(4);
    for (const [slug] of ORDER.slice(2)) {
      await expect(page.locator(`[data-cosplay-tile="${slug}"]`)).toContainText("No cosplay yet.");
      await expect(page.locator(`[data-cosplay-tile="${slug}"]`)).toHaveAttribute(
        "data-count",
        "0",
      );
    }
    await expect(page.getByText("Fan made archive")).toBeVisible();
    await noSidewaysScroll(page);
    expect(real(errors)).toEqual([]);
  });

  test("a tile opens her page", async ({ page }) => {
    await skipGate(page);
    await page.goto(url("/collection/arts/cosplay/"));
    await page.locator('[data-cosplay-tile="ruby"]').click();
    await expect(page).toHaveURL(/\/collection\/arts\/cosplay\/ruby\/$/u, { timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 1, name: "Ruby" })).toBeVisible({
      timeout: 30_000,
    });
  });

  test("a photo named in the address opens on its Aspirant's page", async ({ page }) => {
    await skipGate(page);
    await page.goto(url(`/collection/arts/cosplay/?i=${LAYLA_SOLO}`));
    await expect(page).toHaveURL(new RegExp(`/cosplay/layla/\\?i=${LAYLA_SOLO}$`, "u"), {
      timeout: 30_000,
    });
    await expect(page.locator(DIALOG)).toBeVisible({ timeout: 30_000 });
  });
});

test.describe("the ten pages", () => {
  for (const [slug, name] of ORDER) {
    test(`${slug} answers and shows her name`, async ({ page }) => {
      const errors = await openCharacter(page, slug);
      await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
      await expect(page.locator("[data-cosplay-switcher] [aria-current='page']")).toContainText(
        name,
      );
      await expect(page.locator("[data-cosplay-switcher] a")).toHaveCount(11);
      await expect(page.getByText("Fan made archive")).toBeVisible();
      await noSidewaysScroll(page);
      expect(real(errors)).toEqual([]);
    });
  }
});

test.describe("an Aspirant with photos", () => {
  test("shows her photos in rows under her art, with the line about real people", async ({
    page,
  }) => {
    await openCharacter(page, "fanny");
    await expect(page.locator("[data-flow-tile]")).toHaveCount(8, { timeout: 60_000 });
    await expect(page.locator("[data-flow-count]")).toContainText("8 photos");
    await expect(page.locator("[data-cosplay-feature] img")).toBeAttached();
    await expect(page.locator("[data-cosplay-people]")).toContainText("real people");
    await expect(page.locator("[data-cosplay-people]")).toContainText("removal");
    await expect(page.locator("[data-cosplay-empty]")).toHaveCount(0);
    await noSidewaysScroll(page);
  });

  test("a duo photo stands under both Aspirants", async ({ page }) => {
    await openCharacter(page, "fanny");
    await expect(page.locator(`[data-flow-tile][data-id="${DUO}"]`)).toBeAttached({
      timeout: 60_000,
    });
    await openCharacter(page, "layla");
    await expect(page.locator(`[data-flow-tile][data-id="${DUO}"]`)).toBeAttached({
      timeout: 60_000,
    });
    await expect(page.locator("[data-flow-tile]")).toHaveCount(8);
  });

  test("the zoom names the person who made the photo, with a link to the post", async ({
    page,
  }) => {
    await openCharacter(page, "fanny");
    await openTile(page, DUO);
    const caption = page.locator("[data-cosplay-caption]");
    await expect(caption).toContainText("Fan work");
    await expect(caption).toContainText("XiXia (Heliko) Beta");
    await expect(caption).toContainText("Instagram");
    await expect(caption).toContainText("14 Jan 2022");
    await expect(caption.getByRole("link", { name: "View the original" })).toHaveAttribute(
      "href",
      /instagram\.com\/p\//u,
    );
    await expect(page).toHaveURL(new RegExp(`i=${DUO}`, "u"));
    await page.keyboard.press("Escape");
    await expect(page.locator(DIALOG)).toHaveCount(0, { timeout: 15_000 });
  });

  test("a photo named in the address opens at once", async ({ page }) => {
    await openCharacter(page, "layla", `?i=${LAYLA_SOLO}`);
    await expect(page.locator(DIALOG)).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("[data-cosplay-caption]")).toContainText("Fan work");
    await page.keyboard.press("Escape");
    await expect(page.locator(DIALOG)).toHaveCount(0, { timeout: 15_000 });
  });

  test("the search narrows the photos, a word that nothing matches says so, clearing brings them back", async ({
    page,
  }) => {
    await openCharacter(page, "fanny");
    await expect(page.locator("[data-flow-tile]")).toHaveCount(8, { timeout: 60_000 });
    await page.locator("[data-flow-search] input").fill("duo");
    await expect(page.locator("[data-flow-tile]")).toHaveCount(4, { timeout: 15_000 });
    await expect(page.locator("[data-flow-count]")).toContainText("4 of 8 photos");

    // A word that nothing matches: the line that says so stands on the first screen.
    await page.locator("[data-flow-search] input").fill("zzzz");
    await expect(page.locator("[data-flow-empty]")).toBeVisible({ timeout: 15_000 });
    const box = await page.locator("[data-flow-empty]").boundingBox();
    const vh = page.viewportSize()?.height ?? 900;
    expect(box?.y ?? 9999).toBeLessThan(vh);

    // Clearing brings the photos back.
    await page.locator("[data-flow-search] input").fill("");
    await expect(page.locator("[data-flow-tile]")).toHaveCount(8, { timeout: 15_000 });
  });
});

test.describe("an Aspirant with no photo", () => {
  test("shows her art large and one calm line, never an empty box", async ({ page }) => {
    const errors = await openCharacter(page, "ruby");
    await expect(page.getByRole("heading", { level: 1, name: "Ruby" })).toBeVisible();
    await expect(page.locator("[data-cosplay-empty]")).toHaveText("No cosplay yet.", {
      timeout: 60_000,
    });
    const art = page.locator("[data-cosplay-feature] img");
    await expect(art).toBeVisible();
    await expect(art).toHaveAttribute("alt", /Ruby/u);
    const box = await art.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(250);
    expect(box?.height ?? 0).toBeGreaterThan(150);
    await expect(page.locator("[data-flow-tile]")).toHaveCount(0);
    await expect(page.getByText("Fan made archive")).toBeVisible();
    await noSidewaysScroll(page);
    expect(real(errors)).toEqual([]);
  });
});

test.describe("the switcher", () => {
  test("lists the ten with their counts, marks the open one and goes round", async ({ page }) => {
    await openCharacter(page, "angela");
    const links = page.locator("[data-cosplay-switcher] a");
    await expect(links).toHaveCount(11);
    expect(await links.evaluateAll((els) => els.map((el) => el.getAttribute("data-slug")))).toEqual(
      [null, ...ORDER.map(([slug]) => slug)],
    );
    await expect(page.locator('[data-cosplay-switcher] [data-slug="fanny"]')).toContainText("8");
    await expect(page.locator('[data-cosplay-switcher] [data-slug="ruby"]')).toContainText("0");
    await expect(page.locator("[data-cosplay-switcher] [aria-current='page']")).toHaveCount(1);
    await expect(page.locator("[data-cosplay-all]")).toHaveAttribute(
      "href",
      /\/collection\/arts\/cosplay\/?$/u,
    );
  });

  test("the arrow keys go to the next and the one before", async ({ page }) => {
    await openCharacter(page, "fanny");
    // The photos are drawn by the scripts, so once they stand the page has hydrated and listens.
    await expect(page.locator("[data-flow-tile]")).toHaveCount(8, { timeout: 60_000 });
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/\/cosplay\/layla\/$/u, { timeout: 30_000 });
    await settled(page);
    await expect(page.getByRole("heading", { level: 1, name: "Layla" })).toBeVisible();
    await expect(page.locator("[data-flow-tile]")).toHaveCount(8, { timeout: 60_000 });
    await page.keyboard.press("ArrowLeft");
    await expect(page).toHaveURL(/\/cosplay\/fanny\/$/u, { timeout: 30_000 });
    await settled(page);
    await expect(page.getByRole("heading", { level: 1, name: "Fanny" })).toBeVisible();
    await expect(page.locator("[data-flow-tile]")).toHaveCount(8, { timeout: 60_000 });
    // Before Fanny comes Obsidia: the ten go round.
    await page.keyboard.press("ArrowLeft");
    await expect(page).toHaveURL(/\/cosplay\/obsidia\/$/u, { timeout: 30_000 });
  });

  test("the arrows stay with a field, and with the zoom while it is open", async ({ page }) => {
    await openCharacter(page, "fanny");
    await expect(page.locator("[data-flow-tile]")).toHaveCount(8, { timeout: 60_000 });
    await page.locator("[data-flow-search] input").focus();
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(1200);
    await expect(page).toHaveURL(/\/cosplay\/fanny\/$/u);
    await page.locator("[data-flow-search] input").blur();

    await openTile(page);
    const first = new URL(page.url()).searchParams.get("i");
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => new URL(page.url()).searchParams.get("i")).not.toBe(first);
    await page.waitForTimeout(800);
    await expect(page).toHaveURL(/\/cosplay\/fanny\/\?i=/u);
    await page.keyboard.press("Escape");
    await expect(page.locator(DIALOG)).toHaveCount(0, { timeout: 15_000 });
  });
});
