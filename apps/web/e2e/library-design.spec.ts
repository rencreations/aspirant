import { expect, test, type Page } from "@playwright/test";

import { skipGate, url, watchErrors } from "./helpers";

/**
 * The design room: the promotional posts by campaign and year. It checks the wall, the filters
 * and the address, the study table (a carousel, a reel) and the phone layout. It does not play
 * the reel: the test browser may lack H.264 and AAC.
 */

test.describe.configure({ timeout: 120_000 });

async function open(page: Page, query = "") {
  await skipGate(page);
  const errors = watchErrors(page);
  await page.goto(url(`/collection/design/${query}`));
  await page.waitForLoadState("networkidle");
  await expect(page.locator("h1")).toHaveText("Design");
  return errors;
}

const overflow = (page: Page) =>
  page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return el.scrollWidth - window.innerWidth;
  });

const summary = (page: Page) =>
  page
    .getByRole("status")
    .filter({ hasText: /posts|post/ })
    .first();

test("draws the wall by campaign and year with one h1 and no errors", async ({ page }) => {
  const errors = await open(page);
  await expect(
    page.getByRole("heading", { level: 2, name: "Layla and Fanny arrive" }),
  ).toBeVisible();
  await expect(page.locator("section[id^='c-']")).toHaveCount(18);
  await expect(page.locator("button[data-id^='design-']").first()).toBeVisible();
  await expect(summary(page)).toContainText("99 posts in 18 campaigns");
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});

test("search and filters narrow the wall, keep the address and clear", async ({ page }) => {
  await open(page);
  await page.getByRole("searchbox").fill("relationship");
  await expect(summary(page)).toContainText("of 99 posts");
  expect(new URL(page.url()).searchParams.get("q")).toBe("relationship");
  await page.getByRole("searchbox").fill("");

  await page.getByRole("button", { name: /^Filters/ }).click();
  await page.getByRole("button", { name: /^Reel \d+$/ }).click();
  await expect(summary(page)).toContainText("8 of 99 posts");
  expect(new URL(page.url()).searchParams.get("fmt")).toBe("reel");
  await page.getByRole("button", { name: "Clear all" }).first().click();
  await expect(summary(page)).toContainText("99 posts in 18 campaigns");
});

test("a mixed post answers a pair filter through the characters in it", async ({ page }) => {
  await open(page, "?pair=selena-obsidia");
  // The Skin Relationship Hub shows all ten characters, so it is on Selena and Obsidia's wall.
  await expect(
    page.getByRole("heading", { level: 2, name: "The Skin Relationship Hub" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Layla and Fanny arrive" })).toHaveCount(
    0,
  );
});

test("the details view shows size, ratio and colours", async ({ page }) => {
  await open(page, "?view=details");
  await expect(
    page.getByRole("group", { name: "View" }).getByRole("button", { name: "Details" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("1080 x 1080 px").first()).toBeVisible();
  await expect(page.getByLabel("Dominant colours").first()).toBeVisible();
});

test("a carousel opens in the viewer, moves by key and closes with Escape", async ({ page }) => {
  const errors = await open(page, "?i=design-CYisWWHF-ER");
  const dialog = page.getByRole("dialog", { name: "The voice cast is announced" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("01 / 02")).toBeVisible();
  await expect(dialog.getByText("Colours, slide 1")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(dialog.getByText("02 / 02")).toBeVisible();
  await expect(dialog.getByText("Colours, slide 2")).toBeVisible();
  await dialog.getByRole("button", { name: "Details" }).click();
  await expect(dialog.getByText("1080 PX").first()).toBeAttached();
  await expect(dialog.getByRole("link", { name: "View the original post" })).toHaveAttribute(
    "href",
    /instagram\.com\/p\/CYisWWHF-ER/,
  );
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(new URL(page.url()).searchParams.get("i")).toBeNull();
  expect(errors).toEqual([]);
});

test("a reel shows its player card, and a fan piece shows its badge and credit", async ({
  page,
}) => {
  await open(page, "?i=design-Dd0tPihiEpW");
  const dialog = page.getByRole("dialog", { name: "What is Selena up to in class?" });
  await expect(dialog.getByRole("button", { name: /Play video/ })).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("dialog")).not.toHaveAccessibleName("What is Selena up to in class?");
  await page.keyboard.press("Escape");

  await page.goto(url("/collection/design/?i=design-CjH5-aKJDhc"));
  const fan = page.getByRole("dialog", { name: "Layla against Fanny: who wins?" });
  await expect(fan.getByText("Fan work")).toBeVisible();
  await expect(fan.getByText(/@sire\.plays/).first()).toBeVisible();
});

test("opening a tile with the pointer fills the address and the focus returns on close", async ({
  page,
}) => {
  await open(page);
  const tile = page.locator("button[data-id='design-CZRDyqnL1af']");
  await tile.scrollIntoViewIfNeeded();
  await tile.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(new URL(page.url()).searchParams.get("i")).toBe("design-CZRDyqnL1af");
  await page.getByRole("button", { name: "Close the viewer" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(tile).toBeFocused();
});

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("fits the screen, keeps the filters behind a button and opens the viewer", async ({
    page,
  }) => {
    const errors = await open(page);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    await expect(page.getByRole("button", { name: /^Filters/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Reel \d+$/ })).toHaveCount(0);
    await page.goto(url("/collection/design/?i=design-ClszGOoroXA"));
    await expect(page.getByRole("dialog", { name: "Event guide: Ruby and Angela" })).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });
});
