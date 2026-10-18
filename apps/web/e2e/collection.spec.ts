import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { skipGate, url, watchErrors } from "./helpers";

/**
 * The collection archive: filters, the cinema, the music player, the comic reader, the art
 * viewer fan art credits and the voice archive. Playback itself is not asserted
 * (the test browser may lack H.264 and AAC); the interface state is.
 */

test.describe.configure({ timeout: 120_000 });

async function open(page: Page) {
  await skipGate(page);
  const errors = watchErrors(page);
  await page.goto(url("/collection/"));
  await page.waitForLoadState("networkidle");
  return errors;
}

async function serious(page: Page) {
  // Fixed chrome (the HUD) fades its colours when a section of another world passes under it.
  await page.waitForTimeout(900);
  // The HUD is shell chrome that samples one point of the page for its colours, so it can sit
  // on another world for a moment (the shell's own specs cover it).
  const results = await new AxeBuilder({ page })
    .exclude("[data-overlay='hud']")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target.join(" ")) }));
}

const overflow = (page: Page) =>
  page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return el.scrollWidth - window.innerWidth;
  });

test("shows the archive header with computed counts and one h1", async ({ page }) => {
  const errors = await open(page);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("h1")).toHaveText("Collection");
  await expect(page.getByText("Archive / Collection").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Films, 31. Show films" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Voice archive, 380. Show voice archive" }),
  ).toBeVisible();
  await expect(page.getByText("Total runtime").first()).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});

test("filters by type, announces the count and clears", async ({ page }) => {
  await open(page);
  const status = page.getByRole("status").filter({ hasText: /items|result/ });
  await expect(status).toContainText("468 items in the archive.");

  const films = page.getByRole("button", { name: "Films 31", exact: true });
  await films.click();
  await expect(films).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { level: 2, name: /^Films/ })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: /^Music/ })).toHaveCount(0);
  await expect(status).toContainText("31 results in films.");

  await page.getByRole("searchbox", { name: "Search the collection" }).fill("teaser");
  await expect(status).toContainText('1 result in films matching "teaser".');
  await expect(page.getByRole("button", { name: /^Watch Teaser/ })).toBeVisible();

  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(status).toContainText("468 items in the archive.");
  await expect(page.getByRole("button", { name: "All 468", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("filters by pair and by character", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: /^Who/ }).click();
  await page.getByRole("button", { name: "Selena and Obsidia", exact: true }).click();
  await expect(page.getByRole("button", { name: "Voice 87", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Fan art 0", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Everyone" }).click();
  await page.getByRole("button", { name: "Chang'e", exact: true }).click();
  await expect(page.getByRole("button", { name: "Voice 37", exact: true })).toBeVisible();
});

test("opens a section from the URL hash", async ({ page }) => {
  await skipGate(page);
  await page.goto(url("/collection/#fan-art"));
  await expect(page.getByRole("button", { name: "Fan art 29", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("cinema: opens with a poster, moves on, closes and returns focus", async ({ page }) => {
  await open(page);
  const card = page.getByRole("button", { name: /^Watch Trailer, Fanny and Layla/ });
  await card.scrollIntoViewIfNeeded();
  await card.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const video = dialog.locator("video");
  await expect(video).toHaveAttribute("preload", "none");
  await expect(video).toHaveAttribute("poster", /trailer\.jpg$/);
  await expect(video).toHaveAttribute("src", /trailer\.mp4$/);
  await expect(dialog.locator("track")).toHaveAttribute("src", /trailer\.vtt$/);
  await expect(dialog.getByRole("button", { name: /Fullscreen/ })).toBeVisible();
  const title = dialog.getByRole("heading", { level: 2 });
  const first = await title.textContent();
  await dialog.getByRole("button", { name: /Next in collection/ }).click();
  await expect(video).toHaveAttribute("src", /\.mp4$/);
  await expect(dialog).toContainText("Film 02 / 31");
  expect(first).toBeTruthy();
  expect(await serious(page)).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(card).toBeFocused();
});

test("vertical films get a vertical frame", async ({ page }) => {
  await open(page);
  const card = page.getByRole("button", { name: /^Watch Rerun/ });
  await expect(card).toHaveAttribute("data-vertical", "true");
});

test("says which recordings are not hosted", async ({ page }) => {
  await open(page);
  await expect(page.getByRole("heading", { level: 2, name: "Not on this site" })).toBeVisible();
  await expect(page.getByText(/live-action parody/)).toBeVisible();
  await expect(page.getByText(/long livestream recordings/i)).toBeVisible();
});

test("music: the player starts, pauses and closes", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Music 3", exact: true }).click();
  await page.getByRole("button", { name: /^Play We Believe/ }).click();
  const player = page.getByRole("region", { name: "Music player" });
  await expect(player).toBeVisible();
  await expect(player.getByText("We Believe")).toBeVisible();
  await expect(player.getByRole("slider", { name: "Seek" })).toBeVisible();
  // Small screens use the device volume; the slider lives on wide screens.
  if ((page.viewportSize()?.width ?? 0) > 900) {
    await expect(player.getByRole("slider", { name: "Volume" })).toBeVisible();
  }
  await expect(player.getByRole("button", { name: /^(Pause|Play)$/ })).toBeVisible();
  // The player stays while the visitor changes filters.
  await page.getByRole("button", { name: "Films 31", exact: true }).click();
  await expect(player).toBeVisible();
  await player.getByRole("button", { name: "Close player" }).click();
  await expect(player).toHaveCount(0);
});

test("comics: the reader opens, jumps to a page and remembers it", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Comics 2", exact: true }).click();
  const gv = page.getByRole("button", { name: /^Read Guinevere and Vexana/ });
  await expect(gv).toHaveAttribute("aria-label", /Pages 3, 23 and 40 are missing from the source/);
  await page.getByRole("button", { name: /^Read The Aspirant/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/Page .* of 42/)).toBeVisible();
  const jump = dialog.getByRole("textbox", { name: "Page" });
  await jump.fill("10");
  await jump.press("Enter");
  await expect(dialog.getByText(/^Page 10 of 42/)).toBeVisible({ timeout: 8000 });
  expect(await serious(page)).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /^Read The Aspirant.*Resume at page/ }),
  ).toBeVisible({
    timeout: 5000,
  });
});

test("art: the viewer zooms and moves between images", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Art 23", exact: true }).click();
  await page.getByRole("button", { name: /^View Fanny, splash art/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("100%")).toBeVisible();
  await dialog.getByRole("button", { name: "Zoom in" }).click();
  await expect(dialog.getByText("100%")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Reset zoom" }).click();
  await expect(dialog.getByText("100%")).toBeVisible();
  await dialog.getByRole("button", { name: "Next image" }).click();
  await expect(dialog.getByRole("heading", { level: 2 })).toContainText("Layla");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("fan art: every piece is credited, links only where trusted", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Fan art 29", exact: true }).click();
  const cards = page.getByRole("button", { name: /^View .*\. .+/ });
  await expect(cards).toHaveCount(29);
  await expect(page.getByText("Unknown artist, via Pixiv").first()).toBeVisible();
  const links = page.getByRole("link", { name: /View the original/ });
  // 29 pieces, one of them (a handle without a link) has no link.
  await expect(links).toHaveCount(28);
  await expect(links.first()).toHaveAttribute("rel", /noopener/);
  await cards.first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/^Art: /)).toBeVisible();
  expect(await serious(page)).toEqual([]);
});

test("voice: search by character or text and play a line", async ({ page }) => {
  const errors = await open(page);
  await page.getByRole("button", { name: "Voice 380", exact: true }).click();
  const search = page.getByRole("searchbox", { name: "Search the collection" });
  await search.fill("fanny");
  await expect(page.getByRole("button", { name: "Voice 28", exact: true })).toBeVisible();
  await search.fill("flying feels great");
  await expect(page.getByRole("button", { name: "Voice 1", exact: true })).toBeVisible();
  const play = page.getByRole("button", { name: /^Play Fanny, line 4/ });
  await expect(play).toBeVisible();
  await play.click();
  await search.fill("");
  await page.getByRole("button", { name: /Show \d+ more/ }).click();
  expect(await serious(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test("reduced motion: filters and dialogs still work", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = await open(page);
  await page.getByRole("button", { name: "Comics 2", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Read The Aspirant/ })).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  expect(await serious(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test("the page ends with the Home footer", async ({ page }) => {
  await open(page);
  await expect(page.getByRole("button", { name: /Continue|Next/ }).last()).toBeAttached();
  await expect(page.getByText("Next destination")).toBeAttached();
});
