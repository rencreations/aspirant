import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

import { skipGate, url } from "./helpers";

/**
 * The Films room of the collection (`/collection/video/films/`): the ten official films on an
 * endless strip, one to a screen. Playwright's bundled browser cannot play H.264 and the library
 * files are only in the bucket once they are uploaded, so the files of the room are answered here
 * (a small picture for every poster, and the films as this browser sees them). The spec checks the
 * structure and the states, not the playback: the strip, the wrap at both ends, the contents and
 * its jump, the address, the failed film (its poster and a retry), the chrome of the room.
 */

test.describe.configure({ timeout: 120_000 });

const IDS = [
  "film-selena-and-obsidia-video-trailer-001-3994447231709070185",
  "film-selena-and-obsidia-video-selena-video",
  "film-selena-and-obsidia-video-obsidia-001-3997406762701005025",
  "film-vexana-and-guinevere-video-connection-lost-final-video",
  "film-vexana-and-guinevere-video-relink-final-video2",
  "film-lesley-and-change-video-official-trailer-o3ryhixwofw",
  "film-ruby-and-angela-video-ruby-ruby-final",
  "film-ruby-and-angela-video-angela-angela-final",
  "film-ruby-and-angela-video-trailer-trailer-final",
  "film-layla-and-fanny-video-official-lore-trailer-trailer",
];

// A 1x1 PNG, for every picture of the room.
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

/** Answer the room's library files: pictures and captions here, films gone (404) or unplayable. */
async function serveLibrary(page: Page, films: "gone" | "garbage" = "garbage") {
  await page.route(
    (u) => u.pathname.includes("/library/v1/video/films/"),
    async (route: Route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith(".vtt")) {
        await route.fulfill({
          contentType: "text/vtt",
          body: "WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nA line\n",
        });
      } else if (path.endsWith(".mp4")) {
        if (films === "gone") await route.fulfill({ status: 404, body: "" });
        else await route.fulfill({ status: 200, contentType: "video/mp4", body: Buffer.alloc(64) });
      } else {
        await route.fulfill({ contentType: "image/png", body: PIXEL });
      }
    },
  );
}

/** Console errors and uncaught exceptions. Files of the library origin belong to the pipeline. */
function watch(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const where = msg.location().url;
    if (where.includes("/library/v1/") || msg.text().includes("Failed to load resource")) return;
    errors.push(`${msg.text()} ${where}`);
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

const slides = (page: Page) => page.locator("section[aria-roledescription='slide']");
const counter = (page: Page) => page.locator("[aria-live='polite']").filter({ hasText: "/ 10" });

async function open(page: Page, query = "", films: "gone" | "garbage" = "garbage") {
  await skipGate(page);
  await serveLibrary(page, films);
  const errors = watch(page);
  await page.goto(url(`/collection/video/films/${query}`));
  await expect(slides(page)).toHaveCount(10, { timeout: 60_000 });
  // A development server puts its badge over the foot of the screen (the built site has none).
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  return errors;
}

test("shows the ten films, one to a screen, with the room's chrome", async ({ page }) => {
  const errors = await open(page);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("h1")).toHaveText("Films");
  await expect(counter(page)).toContainText("01 / 10");
  // One slide is current; the rest are hidden from assistive technology.
  await expect(
    page.locator("section[aria-roledescription='slide']:not([aria-hidden])"),
  ).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 2, name: "Day of Enders" })).toBeAttached();
  // The top bar has no background, one way back, no way to another room.
  await expect(page.locator("header[data-overlay='nav']")).toHaveAttribute("data-bare", "true");
  const back = page.locator("a[data-room-back]");
  await expect(back).toHaveCount(1);
  await expect(back).toHaveAttribute("href", /\/collection\/?$/u);
  await expect(page.locator("main a[href*='/collection/']:not([data-room-back])")).toHaveCount(0);
  // The buttons of the bar have names.
  for (const name of ["Index", "Previous film", "Next film", "Whole frame"]) {
    if (name.endsWith("film") && (page.viewportSize()?.width ?? 0) < 900) continue;
    await expect(page.getByRole("button", { name })).toBeAttached();
  }
  await expect(page.getByRole("button", { name: /Sound (on|off)/u })).toBeAttached();
  await expect(page.getByRole("slider", { name: "Time in the film" })).toBeAttached();
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(wide).toBe(false);
  expect(errors).toEqual([]);
});

test("the strip is endless both ways, and the address follows", async ({ page }) => {
  await open(page);
  await page.keyboard.press("ArrowDown");
  await expect(counter(page)).toContainText("02 / 10");
  await expect(page).toHaveURL(new RegExp(`\\?i=${IDS[1]}`, "u"));
  await page.keyboard.press("ArrowUp");
  await expect(counter(page)).toContainText("01 / 10");
  await page.keyboard.press("ArrowUp");
  await expect(counter(page)).toContainText("10 / 10");
  await expect(page).toHaveURL(new RegExp(`\\?i=${IDS[9]}`, "u"));
  await page.keyboard.press("ArrowDown");
  await expect(counter(page)).toContainText("01 / 10");
});

test("the wheel moves one film a notch", async ({ page, isMobile }) => {
  test.skip(isMobile, "no wheel on a phone");
  await open(page);
  await page.mouse.move(400, 400);
  await page.mouse.wheel(0, 100);
  await expect(counter(page)).toContainText("02 / 10", { timeout: 5_000 });
  await page.waitForTimeout(800);
  await page.mouse.wheel(0, -100);
  await expect(counter(page)).toContainText("01 / 10", { timeout: 5_000 });
  await page.waitForTimeout(800);
  await page.mouse.wheel(0, -100);
  await expect(counter(page)).toContainText("10 / 10", { timeout: 5_000 });
});

test("the contents go straight to a film", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Index" }).click();
  const sheet = page.getByRole("dialog", { name: "Films" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("listitem")).toHaveCount(10);
  await sheet.getByRole("button", { name: /Awakening/u }).click();
  await expect(sheet).toBeHidden();
  await expect(counter(page)).toContainText("09 / 10");
  await expect(page).toHaveURL(new RegExp(`\\?i=${IDS[8]}`, "u"));
  // The film that arrived is the current slide, and it has English captions.
  await expect(page.getByRole("button", { name: /CC/u })).toBeAttached();
  // Esc closes the sheet without moving.
  await page.getByRole("button", { name: "Index" }).click();
  await expect(sheet).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(counter(page)).toContainText("09 / 10");
});

test("a deep link opens its film", async ({ page }) => {
  await open(page, `?i=${IDS[4]}&t=20`);
  await expect(counter(page)).toContainText("05 / 10");
  await expect(page.getByRole("heading", { level: 2, name: "Re:Link" })).toBeAttached();
});

test("a film that cannot be had shows its poster and a retry", async ({ page }) => {
  await open(page, "", "gone");
  const alert = page.getByRole("alert").filter({ hasText: "This film did not load" });
  await expect(alert).toBeVisible({ timeout: 30_000 });
  await expect(alert.getByRole("button", { name: "Try again" })).toBeVisible();
  const current = page.locator("section[aria-roledescription='slide']:not([aria-hidden])");
  await expect(current.locator("img").first()).toBeAttached();
  // The room still moves on to the next film.
  await page.keyboard.press("ArrowDown");
  await expect(counter(page)).toContainText("02 / 10");
});

test("has no detectable accessibility violations", async ({ page }) => {
  await open(page);
  await page.waitForTimeout(1500);
  const results = await new AxeBuilder({ page })
    .include("main")
    .disableRules(["color-contrast"])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
});
