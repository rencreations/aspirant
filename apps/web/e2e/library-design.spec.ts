import { expect, test, type Page } from "@playwright/test";

import { skipGate, url, watchErrors } from "./helpers";

/**
 * The design room: a film opens the page, the wall rises over it, and every post has its own address
 * (`/collection/design/<slug>/`) and opens as a window over the wall. It checks the first screen, the
 * bar and its dropdowns, the addresses (a click, a direct link, an old `?i=` link, Back) and the
 * phone layout. It does not play the film or a reel: the test browser may lack H.264 and AAC.
 */

test.describe.configure({ timeout: 120_000 });

async function open(page: Page, path = "/collection/design/") {
  await skipGate(page);
  const errors = watchErrors(page);
  await page.goto(url(path));
  // The film plays by itself and keeps downloading, so the network never goes quiet here.
  await page.waitForLoadState("load");
  await expect(page.locator("h1")).toHaveText("Design");
  return errors;
}

const overflow = (page: Page) =>
  page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return el.scrollWidth - window.innerWidth;
  });

/** The one line that says how many contents are on show. */
const status = (page: Page) => page.getByRole("status").filter({ hasText: /contents|match/ });

/** Scroll until the bar has docked under the top bar (the page has risen over the film). */
async function dock(page: Page) {
  await page.evaluate(() => {
    window.scrollTo(0, Math.round(window.innerHeight * 1.1));
  });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.querySelector("[data-design-bar]")?.getBoundingClientRect().top ?? 0,
      ),
    )
    .toBeLessThan(120);
}

test("opens on the film with one h1, one figure and one way back", async ({ page }) => {
  const errors = await open(page);
  await expect(page.getByText("93 contents").first()).toBeVisible();
  // Nothing that is too detailed on the first screen: no years, no campaign count, no reel count.
  const first = page.locator("section[aria-label='Design']");
  await expect(first.getByText(/campaigns|reels|20\d\d/i)).toHaveCount(0);
  // One button back to the shelf, and no link to another room above the wall.
  await expect(page.getByRole("link", { name: "Collection" }).first()).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Rooms of the collection" })).toHaveCount(0);
  await expect(page.locator("video").first()).toBeAttached();
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});

test("the top bar is bare over the film and takes its plate when the bar docks", async ({
  page,
}) => {
  await open(page);
  const nav = page.locator("header[data-overlay='nav']");
  await expect(nav).toHaveAttribute("data-bare", "true");
  await dock(page);
  await expect(nav).not.toHaveAttribute("data-bare", "true");
  await expect(nav).toHaveAttribute("data-theme", "daybreak");
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
  await expect(nav).toHaveAttribute("data-bare", "true");
});

test("draws the wall by campaign and year, with no post that belongs to Video", async ({
  page,
}) => {
  const errors = await open(page);
  await dock(page);
  await expect(
    page.getByRole("heading", { level: 2, name: "Layla and Fanny arrive" }),
  ).toBeVisible();
  await expect(page.locator("section[id^='c-']")).toHaveCount(18);
  await expect(page.locator("a[data-id^='design-']").first()).toBeVisible();
  // The six reels moved to Video, Others are not here.
  for (const id of [
    "DdyIX9wEk_7",
    "Dd0tPihiEpW",
    "Dd6LYQYDdbi",
    "Delakn4Cb9E",
    "DetJAmclG5M",
    "De6qFyvt0uP",
  ]) {
    await expect(page.locator(`a[data-id='design-${id}']`)).toHaveCount(0);
  }
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});

test("a choice narrows the wall, keeps the address and clears", async ({ page }) => {
  await open(page);
  await dock(page);
  await page.getByRole("button", { name: /^Characters/ }).click();
  await page.getByRole("radio", { name: /Selena and Obsidia/ }).click();
  await expect(status(page)).toHaveText(/of 93 contents/i);
  expect(new URL(page.url()).searchParams.get("pair")).toBe("selena-obsidia");
  // The menu closed by itself, and the button says what is chosen.
  await expect(page.getByRole("radiogroup")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Selena and Obsidia/ })).toBeVisible();
  await page.getByRole("button", { name: "Clear" }).click();
  await expect(status(page)).toHaveText(/^93 contents$/i);
  expect(new URL(page.url()).searchParams.get("pair")).toBeNull();

  await page.getByRole("searchbox").fill("relationship");
  await expect(status(page)).toHaveText(/of 93 contents/i);
  expect(new URL(page.url()).searchParams.get("q")).toBe("relationship");
});

test("a list closes on a press outside it, on Escape, and one is open at a time", async ({
  page,
}) => {
  await open(page);
  await dock(page);
  const characters = page.getByRole("button", { name: /^Characters/ });
  await characters.click();
  await expect(page.getByRole("radiogroup", { name: "Characters" })).toBeVisible();
  // A press on a post closes the list and does nothing else: no window opens.
  await page.mouse.click(700, 600);
  await expect(page.getByRole("radiogroup")).toHaveCount(0);
  expect(new URL(page.url()).pathname).toBe("/collection/design/");
  await expect(page.locator("[role=dialog][aria-modal=true]")).toHaveCount(0);

  await characters.click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("radiogroup")).toHaveCount(0);
  await expect(characters).toBeFocused();

  await characters.click();
  await page.getByRole("button", { name: /^Year/ }).click();
  await expect(page.getByRole("radiogroup")).toHaveCount(1);
  await expect(page.getByRole("radiogroup", { name: "Year" })).toBeVisible();
});

test("a mixed post answers a pair filter through the characters in it", async ({ page }) => {
  await open(page, "/collection/design/?pair=selena-obsidia");
  await dock(page);
  // The Skin Relationship Hub shows all ten characters, so it is on Selena and Obsidia's wall.
  await expect(
    page.getByRole("heading", { level: 2, name: "The Skin Relationship Hub" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Layla and Fanny arrive" })).toHaveCount(
    0,
  );
});

test("a post opens at its own address, moves by key, and Escape returns to the wall", async ({
  page,
}) => {
  const errors = await open(page);
  await dock(page);
  const tile = page.locator("a[data-id='design-CZRDyqnL1af']");
  await tile.scrollIntoViewIfNeeded();
  await expect(tile).toHaveAttribute("href", /\/collection\/design\/the-comic-begins\/$/);
  const before = await page.evaluate(() => Math.round(window.scrollY));
  await tile.click();
  const dialog = page.getByRole("dialog", { name: "The comic begins" });
  await expect(dialog).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/collection/design/the-comic-begins/");
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("dialog")).not.toHaveAccessibleName("The comic begins");
  expect(new URL(page.url()).pathname).not.toBe("/collection/design/the-comic-begins/");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(new URL(page.url()).pathname).toBe("/collection/design/");
  // The wall is where it was, and the focus is back on the tile that opened it.
  expect(Math.abs((await page.evaluate(() => Math.round(window.scrollY))) - before)).toBeLessThan(
    4,
  );
  await expect(tile).toBeFocused();
  expect(errors).toEqual([]);
});

test("Back closes the window", async ({ page }) => {
  await open(page);
  await dock(page);
  const tile = page.locator("a[data-id='design-CZRDyqnL1af']");
  await tile.scrollIntoViewIfNeeded();
  await tile.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(new URL(page.url()).pathname).toBe("/collection/design/");
});

test("a link to a post opens its window, and an old ?i= link becomes its address", async ({
  page,
}) => {
  const errors = await open(page, "/collection/design/the-voice-cast-is-announced/");
  const dialog = page.getByRole("dialog", { name: "The voice cast is announced" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("01 / 02")).toBeVisible();
  await expect(dialog.getByText("Colours, slide 1")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(dialog.getByText("02 / 02")).toBeVisible();
  await dialog.getByRole("button", { name: "Details" }).click();
  await expect(dialog.getByText("1080 PX").first()).toBeAttached();
  await expect(dialog.getByRole("link", { name: "View the original post" })).toHaveAttribute(
    "href",
    /instagram\.com\/p\/CYisWWHF-ER/,
  );
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(new URL(page.url()).pathname).toBe("/collection/design/");

  await page.goto(url("/collection/design/?i=design-CYisWWHF-ER&year=2022"));
  await expect(page.getByRole("dialog", { name: "The voice cast is announced" })).toBeVisible();
  const now = new URL(page.url());
  expect(now.pathname).toBe("/collection/design/the-voice-cast-is-announced/");
  expect(now.searchParams.get("i")).toBeNull();
  expect(now.searchParams.get("year")).toBe("2022");
  expect(errors).toEqual([]);
});

test("a post that is not Moonton's own shows its badge, its credit and a takedown link", async ({
  page,
}) => {
  await open(page, "/collection/design/layla-against-fanny-who-wins/");
  const fan = page.getByRole("dialog", { name: "Layla against Fanny: who wins?" });
  await expect(fan.getByText("Fan work")).toBeVisible();
  await expect(fan.getByText(/@sire\.plays/).first()).toBeVisible();
  await expect(fan.getByRole("link", { name: /Copyright or takedown/ })).toBeVisible();
});

test("a reel that stayed shows its player card", async ({ page }) => {
  await open(page, "/collection/design/become-the-hero-of-your-own-story/");
  const dialog = page.getByRole("dialog", { name: "Become the hero of your own story" });
  await expect(dialog.getByRole("button", { name: /Play video/ })).toBeVisible();
});

test("a post that moved to Video has no page here", async ({ page }) => {
  await skipGate(page);
  const res = await page.goto(url("/collection/design/pick-your-girl/"));
  expect(res?.status()).toBe(404);
});

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("fits the screen, keeps the bar to two rows and opens a post", async ({ page }) => {
    const errors = await open(page);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    await dock(page);
    const bar = await page.locator("[data-design-bar]").boundingBox();
    expect(bar?.height ?? 999).toBeLessThan(130);
    await expect(page.getByRole("button", { name: /^Characters/ })).toBeVisible();
    await page.goto(url("/collection/design/event-guide-ruby-and-angela/"));
    await expect(page.getByRole("dialog", { name: "Event guide: Ruby and Angela" })).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });
});
