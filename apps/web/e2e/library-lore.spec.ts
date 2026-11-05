import { expect, test, type Page } from "@playwright/test";

import { skipGate, url } from "./helpers";

/**
 * The Lore room of the collection (`/collection/lore/`): the library of 28 texts by group, the
 * reading room (contents rail, text size, deep links to a heading, next and previous), the
 * search with marked words, the atlas of 14 places and 10 entities (a plate opens in full), and
 * the Who is who view.
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
  await page.goto(url(`/collection/lore/${query}`));
  await expect(page.getByRole("tablist", { name: "Views of the lore room" })).toBeVisible();
  return errors;
}

/** Type into the search box. Retried, because a value typed before the page has hydrated is lost. */
async function search(page: Page, text: string) {
  const box = page.getByRole("searchbox");
  await expect(async () => {
    await box.fill(text);
    await expect(page).toHaveURL(new RegExp(`q=${text}`), { timeout: 1500 });
  }).toPass({ timeout: 20_000 });
}

test("the library shows the four groups and the plot note above Stories", async ({ page }) => {
  const errors = await open(page);
  for (const name of ["World", "Characters", "Stories", "Videos"]) {
    await expect(page.getByRole("heading", { level: 2, name, exact: true })).toBeVisible();
  }
  await expect(page.getByRole("note")).toHaveText(/These texts tell parts of the plot/);
  await expect(page.locator("a[href^='?view=texts&i=lore-']")).toHaveCount(28);
  await expect(page.getByText("Older text")).toHaveCount(2);
  expect(errors).toEqual([]);
});

test("a card opens the reading room, and the address keeps the text", async ({ page }) => {
  await open(page);
  await page.locator("a[href='?view=texts&i=lore-universe']").click();
  await expect(page).toHaveURL(/[?&]i=lore-universe/);
  await expect(page.getByRole("heading", { level: 2, name: "Universe A5-01" })).toBeVisible();
  const toc = page.getByRole("navigation", { name: "Contents of this text" });
  await expect(toc.getByRole("link", { name: "Will of the Cosmos" })).toBeVisible();
  // Back to the list with the button.
  await page.getByRole("button", { name: "All texts" }).first().click();
  await expect(page).not.toHaveURL(/[?&]i=/);
});

test("a deep link scrolls to its heading and the rail follows", async ({ page }) => {
  await open(page, "?view=texts&i=lore-selrick-archives#singularity-battle-report-timeline");
  const heading = page.locator("[data-heading='singularity-battle-report-timeline']");
  await expect(heading).toBeVisible();
  await expect
    .poll(async () => (await heading.boundingBox())?.y ?? 9999, { timeout: 8000 })
    .toBeLessThan(400);
  const current = page
    .getByRole("navigation", { name: "Contents of this text" })
    .locator("a[aria-current='location']");
  await expect(current).toHaveText(/Singularity/);
});

test("the text size control changes the reading size and is kept", async ({ page }) => {
  await open(page, "?view=texts&i=lore-day-of-enders");
  const room = page.locator("article[data-size]");
  await expect(room).toHaveAttribute("data-size", "m");
  await page.getByRole("button", { name: "Larger text" }).first().click();
  await expect(room).toHaveAttribute("data-size", "l");
  await page.reload();
  await expect(page.locator("article[data-size]")).toHaveAttribute("data-size", "l");
});

test("next and previous move through the texts", async ({ page }) => {
  await open(page, "?view=texts&i=lore-universe");
  await page
    .getByRole("navigation", { name: "Previous and next text" })
    .getByRole("button", { name: /Settings/ })
    .click();
  await expect(page).toHaveURL(/i=lore-settings/);
  await expect(page.getByRole("heading", { level: 2, name: "Settings" })).toBeVisible();
});

test("an older text says so", async ({ page }) => {
  await open(page, "?view=texts&i=lore-aspirant-backstory");
  await expect(page.getByText("Older text").first()).toBeVisible();
  await expect(page.getByText(/one of the two oldest official texts/i)).toBeVisible();
});

test("search finds words in the body, marks them and opens a text at the right heading", async ({
  page,
}) => {
  await open(page);
  await search(page, "mothership");
  await expect(page.getByRole("status").filter({ hasText: /texts? match/ })).toBeVisible();
  await expect(page.locator("mark").first()).toBeVisible();
  await page
    .locator("section[aria-label='Search results'] a", {
      hasText: /Singularity|Observation|Selrick Archives/,
    })
    .first()
    .click();
  await expect(page).toHaveURL(/i=lore-/);
  await expect(page.locator("article mark").first()).toBeVisible();
  // A word that no text holds.
  await page.getByRole("button", { name: "All texts" }).first().click();
  await page.getByRole("searchbox").fill("zzzz");
  await expect(page.getByText(/No text has all of these words/)).toBeVisible();
});

test("the atlas holds 14 places and 10 entities, and a plate opens in full", async ({ page }) => {
  const errors = await open(page, "?view=atlas");
  const plates = page.locator("button[aria-label$='Open the full entry.']");
  await expect(plates).toHaveCount(24);
  await page.getByRole("button", { name: /^Entities/ }).click();
  await expect(plates).toHaveCount(10);
  await page.getByRole("button", { name: /^All/ }).click();
  await page.getByRole("button", { name: /^Terrinia, plate/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Terrinia" })).toBeVisible();
  await expect(dialog.getByText(/humanity's final bastion/)).toBeVisible();
  await expect(page).toHaveURL(/a=lore-place-terrinia/);
  // The picture is shown at its own size, never enlarged.
  const pic = dialog.locator("img").first();
  const natural = await pic.evaluate((el) => (el as HTMLImageElement).naturalWidth);
  const shown = (await pic.boundingBox())?.width ?? 0;
  expect(shown).toBeLessThanOrEqual(natural + 1);
  // A text that mentions it opens in the reading room.
  await dialog
    .getByRole("button", { name: /Places/ })
    .first()
    .click();
  // The Texts view is the default, so the address holds only the text and the heading.
  await expect(page).toHaveURL(/i=lore-/);
  await expect(page).not.toHaveURL(/view=atlas/);
  await expect(page).not.toHaveURL(/a=lore-/);
  expect(errors).toEqual([]);
});

test("Esc closes a plate", async ({ page }) => {
  await open(page, "?view=atlas&a=lore-place-the-garden");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).not.toHaveURL(/a=/);
});

test("Who is who lists the ten, links to the pages and shows who sees whom", async ({ page }) => {
  await open(page, "?view=who");
  const roster = page.getByRole("group", { name: "The ten Aspirants" });
  await expect(roster.getByRole("button")).toHaveCount(10);
  await roster.getByRole("button", { name: "Selena" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Selena" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Open Selena's page/ })).toHaveAttribute(
    "href",
    /\/character\/selena\/?$/,
  );
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(10);
});

test("the three views fit a phone without sideways scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  for (const view of ["texts", "atlas", "who"]) {
    await page.goto(url(`/collection/lore/?view=${view}`));
    await expect(page.getByRole("tablist", { name: "Views of the lore room" })).toBeVisible();
    const over = await page.evaluate(() => {
      const el = document.scrollingElement ?? document.documentElement;
      return el.scrollWidth - window.innerWidth;
    });
    expect(over).toBeLessThanOrEqual(1);
  }
});
