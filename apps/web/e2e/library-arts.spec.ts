import { expect, test, type Page } from "@playwright/test";

import { skipGate, url } from "./helpers";

/**
 * The Arts room of the collection (`/collection/arts/`): the ribbon of the ten splash arts, the
 * search and the three filters, the two layouts, and the shared viewer (open, move, zoom, close,
 * deep link, share link). The scene stills tab belongs to its own spec.
 */

test.describe.configure({ timeout: 120_000 });

/**
 * Console errors and uncaught exceptions. A missing file counts as an error, except what belongs
 * to the other tab (its data `arts-scenes.json` and its code chunk, built by someone else and
 * possibly not there yet) and the library origin, whose files (the room cover, pictures) belong
 * to the pipeline and not to this room's code.
 */
function watch(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const where = msg.location().url;
    if (
      where.includes("arts-scenes.json") ||
      where.includes("arts_scenes") ||
      where.includes("/library/v1/")
    ) {
      return;
    }
    errors.push(`${msg.text()} ${where}`);
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

async function open(page: Page, query = "") {
  await skipGate(page);
  const errors = watch(page);
  await page.goto(url(`/collection/arts/${query}`));
  // Not by role: with a picture open from the address, the page behind it is hidden from the tree.
  await expect(page.locator("[data-tile]").first()).toBeAttached();
  return errors;
}

const tiles = (page: Page) => page.locator("[data-tile]");

/** The visible title in the details panel (the dialog also has a hidden title for screen readers). */
const title = (page: Page) => page.getByRole("dialog").locator("h2.display");

test("shows the room: one h1, the two tabs, the ribbon and the whole grid", async ({ page }) => {
  const errors = await open(page);
  await expect(page.locator("h1")).toHaveText("Arts");
  await expect(page.getByRole("tab", { name: /Official art/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("tab", { name: /Scene stills/ })).toHaveAttribute(
    "aria-selected",
    "false",
  );
  await expect(
    page.getByRole("list", { name: "The ten splash arts" }).getByRole("button"),
  ).toHaveCount(10);
  await expect(tiles(page)).toHaveCount(34);
  const overflow = await page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return el.scrollWidth - window.innerWidth;
  });
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});

test("keeps the tab in the address", async ({ page }) => {
  await open(page);
  await page.getByRole("tab", { name: /Scene stills/ }).click();
  await expect(page).toHaveURL(/tab=scenes/);
  await expect(page.getByRole("tab", { name: /Scene stills/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.getByRole("tab", { name: /Official art/ }).click();
  await expect(page).not.toHaveURL(/tab=/);
  await expect(tiles(page)).toHaveCount(34);
});

test("filters by character, kind and search, and clears", async ({ page }) => {
  await open(page);
  await page
    .getByRole("group", { name: "Character" })
    .getByRole("button", { name: /^Layla/ })
    .click();
  await expect(page).toHaveURL(/who=layla/);
  await expect(tiles(page)).toHaveCount(4);
  await page
    .getByRole("group", { name: "Kind" })
    .getByRole("button", { name: /^Lore cards/i })
    .click();
  await expect(page).toHaveURL(/kind=lore/);
  await expect(tiles(page)).toHaveCount(1);

  // A chip with nothing behind it is disabled, so nobody lands on an empty page by pressing it.
  await expect(
    page.getByRole("group", { name: "Pair" }).getByRole("button", { name: /^Ruby and Angela/ }),
  ).toBeDisabled();

  await page.getByRole("group", { name: "Kind" }).getByRole("button", { name: "All" }).click();
  await page.getByRole("group", { name: "Character" }).getByRole("button", { name: "All" }).click();
  await expect(tiles(page)).toHaveCount(34);

  await page.getByRole("searchbox").fill("father");
  await expect(tiles(page)).toHaveCount(3);
  await page.getByRole("searchbox").fill("zzzz");
  await expect(page.getByText("Nothing matches.")).toBeVisible();
  await page.getByRole("button", { name: "Clear the filters" }).click();
  await expect(tiles(page)).toHaveCount(34);
});

test("switches to the wall and keeps the choice in the address", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Wall" }).click();
  await expect(page).toHaveURL(/view=wall/);
  await expect(page.getByRole("button", { name: "Wall" })).toHaveAttribute("aria-pressed", "true");
  await expect(tiles(page)).toHaveCount(34);
  await page.getByRole("button", { name: "Gallery" }).click();
  await expect(page).not.toHaveURL(/view=/);
});

test("opens a picture, moves through them, zooms and closes with the focus back on the tile", async ({
  page,
}) => {
  const errors = await open(page);
  await tiles(page).nth(2).scrollIntoViewIfNeeded();
  await tiles(page).nth(2).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/[?&]i=arts-official-fanny-layla-fighting-together/);
  await expect(title(page)).toHaveText("Fanny and Layla, fighting together");

  // The details: size, the original file and the share button.
  await expect(dialog.getByText("3840 × 2160 px")).toBeVisible();
  await expect(dialog.getByRole("link", { name: /Download original/ })).toHaveAttribute(
    "download",
    /\.jpg$/,
  );
  await expect(dialog.getByRole("button", { name: "Copy link" })).toBeVisible();

  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/[?&]i=arts-official-fanny-and-layla/);
  await page.keyboard.press("ArrowLeft");
  await expect(page).toHaveURL(/[?&]i=arts-official-fanny-layla-fighting-together/);

  // Zoom with the keys: the readout changes, and 0 shows the whole picture again.
  const readout = dialog.locator("[aria-live='off']").first();
  const before = await readout.textContent();
  await page.keyboard.press("+");
  await expect(readout).not.toHaveText(before ?? "");
  await page.keyboard.press("0");
  await expect(readout).toHaveText(before ?? "");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page).not.toHaveURL(/[?&]i=/);
  await expect(tiles(page).nth(2)).toBeFocused();
  expect(errors).toEqual([]);
});

test("the back button closes the picture without a page change or a jump", async ({ page }) => {
  await open(page);
  const tile = tiles(page).nth(30);
  await tile.scrollIntoViewIfNeeded();
  await tile.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  // The page scrolls smoothly to the tile first, so the place to compare is the one while the
  // picture is open (the page is held still then).
  await page.waitForTimeout(600);
  const during = await page.evaluate(() => Math.round(window.scrollY));
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).not.toHaveURL(/[?&]i=/);
  await expect(page.locator('[data-overlay="transition"]')).toHaveAttribute("data-active", "false");
  const after = await page.evaluate(() => Math.round(window.scrollY));
  expect(Math.abs(after - during)).toBeLessThan(40);
});

test("opens straight on a picture from a shared link", async ({ page }) => {
  const errors = await open(page, "?i=arts-official-selena-observation-record");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(title(page)).toHaveText("Observation record, Selena");
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("a ribbon panel opens its splash art even when a filter hides it", async ({ page }) => {
  await open(page, "?who=layla");
  await page
    .getByRole("list", { name: "The ten splash arts" })
    .getByRole("button", { name: /^Selena/ })
    .click();
  await expect(title(page)).toHaveText("Selena, splash art");
});

test("is usable on a phone: no sideways scroll, the viewer fits", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  const overflow = await page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return el.scrollWidth - window.innerWidth;
  });
  expect(overflow).toBeLessThanOrEqual(0);
  await tiles(page).nth(1).scrollIntoViewIfNeeded();
  await tiles(page).nth(1).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box?.width).toBeLessThanOrEqual(390);
  await expect(dialog.getByRole("button", { name: "Next picture" })).toBeVisible();
});
