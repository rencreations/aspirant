import { expect, test, type Page } from "@playwright/test";

import { skipGate, url, watchErrors } from "./helpers";

/**
 * The others room: the sticker wall, the gameplay clips, the skill icons, the art made for the
 * site and the links out. Playback is not asserted (the test browser may lack H.264 and AAC); the
 * interface state is. (The 3D models have their own room, see library-models.spec.ts.)
 */

test.describe.configure({ timeout: 120_000 });

async function open(page: Page, query = "") {
  await skipGate(page);
  const errors = watchErrors(page);
  await page.goto(url(`/collection/others/${query}`));
  await expect(page.locator("h1")).toHaveText("Others", { timeout: 60_000 });
  // The heading is in the server's HTML; the summary says "Loading" until the browser has the
  // data, so it shows that the page is hydrated and the controls take input.
  await expect(page.getByText(/items in \d+ sections?/)).toBeVisible({ timeout: 60_000 });
  return errors;
}

test("shows the five sections in order, with one h1", async ({ page }) => {
  const errors = await open(page);
  await expect(page.locator("h1")).toHaveCount(1);
  const titles = page.locator("main h2, section[id^='sec-'] h2");
  await expect(titles).toHaveText([
    "Emotes",
    "Gameplay clips (not part of the story)",
    "Skill icons",
    "Made for this site",
    "More of the world",
  ]);
  // The 3D models moved to their own room: no section and no chip for them here.
  await expect(page.getByRole("button", { name: /^3D models/ })).toHaveCount(0);
  expect(errors.filter((e) => !e.includes("Failed to load resource"))).toEqual([]);
});

test("an old link to a 3D model forwards to the Models room", async ({ page }) => {
  await skipGate(page);
  await page.goto(url("/collection/others/?i=others-3d-layla"));
  await expect(page).toHaveURL(/\/collection\/models\/\?i=models-layla/, { timeout: 60_000 });
});

test("a section chip shows one section and the address keeps it", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: /^Emotes/ }).click();
  await expect(page).toHaveURL(/s=emotes/);
  await expect(page.locator("section[id^='sec-']")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Emotes" })).toBeVisible();
  // 8 stickers loop; the preview film is a card.
  await expect(page.locator("video")).toHaveCount(8);
});

test("search narrows the items and hides the sections with no match", async ({ page }) => {
  await open(page);
  await page.getByRole("searchbox").fill("selena");
  await expect(page.getByRole("heading", { name: "Skill icons" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Emotes" })).toHaveCount(0);
  await expect(page.getByText(/of 72 items in/)).toBeVisible();
  await page.getByRole("searchbox").fill("zzzz");
  await expect(page.getByText("Nothing matches that search")).toBeVisible();
});

test("the skill icons are 100 px pictures, grouped by character, named from the file names", async ({
  page,
}) => {
  await open(page, "?s=skills");
  const icons = page.locator("img[alt$='skill icon']");
  await expect(icons).toHaveCount(22);
  // Their real size, whatever the reveal is doing: 100 px, with crisp scaling.
  const css = await icons.first().evaluate((el) => {
    const s = getComputedStyle(el);
    return { width: s.width, height: s.height, rendering: s.imageRendering };
  });
  expect(css).toEqual({ width: "100px", height: "100px", rendering: "pixelated" });
  await expect(page.getByText("Skill 2, blink")).toBeVisible();
  for (const name of ["Guinevere", "Obsidia", "Selena", "Vexana"]) {
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  }
});

test("the gameplay clips are cards that open the player, labelled as not part of the story", async ({
  page,
}) => {
  await open(page, "?s=gameplay");
  await expect(page.getByRole("button", { name: /^Play video:/ })).toHaveCount(10);
  await expect(page.getByText("not part of the story").first()).toBeVisible();
});

test("the art made for the site is labelled and opens in the viewer", async ({ page }) => {
  await open(page, "?s=site");
  await expect(page.getByText("Fan work").first()).toBeVisible();
  await page.getByRole("button", { name: "Open The Aspirants logo" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("the links lead to the novel, the drama and the ten character pages", async ({ page }) => {
  await open(page, "?s=more");
  const links = page.locator("section#sec-more a");
  await expect(links).toHaveCount(12);
  await expect(page.getByTestId("link-story")).toHaveAttribute("href", /\/story\/?$/);
  await expect(page.getByTestId("link-character:vexana").first()).toHaveAttribute(
    "href",
    /\/character\/vexana\/?$/,
  );
});

test("no horizontal scroll on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  // Every section is in its first (not yet revealed) state: a reveal must never push the page sideways.
  const over = await page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return el.scrollWidth - el.clientWidth;
  });
  expect(over).toBeLessThanOrEqual(0);
});
