import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

import { skipGate, url } from "./helpers";

/**
 * The Films room of the collection (`/collection/video/films/`): the ten official films on an
 * endless strip, one to a screen. Playwright's bundled browser cannot play H.264 and the library
 * files are only in the bucket once they are uploaded, so the files of the room are answered here
 * (a small picture for every poster, and the films as this browser sees them). The spec checks the
 * structure and the states, not the playback: the strip, the wrap at both ends, the contents (its
 * jump, a press outside a film closes it, the focus goes back to Index), the address and the way
 * back to the room that opened a film, the failed film (its poster and a retry), the chrome of the
 * room (Index at the top on a phone), the thin time line kept clear of the buttons, subtitles on at
 * every visit, and full screen (in, the whole frame without words, the plain time line row with
 * its handle and a jump, controls that hide when idle, the contents and keys inside it, out).
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
  for (const name of ["Index", "Previous film", "Next film", "Whole frame", "Full screen"]) {
    if (name.endsWith("film") && (page.viewportSize()?.width ?? 0) < 900) continue;
    await expect(page.getByRole("button", { name, exact: true })).toBeAttached();
  }
  await expect(page.getByRole("button", { name: /^Sound (on|off)$/u })).toBeAttached();
  await expect(page.getByRole("slider", { name: "Time in the film" })).toBeAttached();
  // Phones and smaller screens (800 px and below) have Index at the top beside the way back; a
  // wider screen has it first in the bar at the foot.
  const backBox = await back.boundingBox();
  const indexBox = await page.getByRole("button", { name: "Index", exact: true }).boundingBox();
  expect(backBox && indexBox).toBeTruthy();
  if (backBox && indexBox) {
    if ((page.viewportSize()?.width ?? 0) <= 800) {
      expect(Math.abs(indexBox.y - backBox.y)).toBeLessThan(4);
      expect(indexBox.x).toBeGreaterThan(backBox.x + backBox.width);
    } else {
      expect(indexBox.y).toBeGreaterThan((page.viewportSize()?.height ?? 0) / 2);
    }
  }
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

test("the thin time line keeps to the foot and never catches a press meant for a button", async ({
  page,
}) => {
  await open(page);
  const slider = page.getByRole("slider", { name: "Time in the film" });
  await expect(slider).toHaveAttribute("aria-valuemax", "180");
  // The time stands beside the counter in the bar ("00:00 / 03:00").
  await expect(page.locator("[data-films-controls]")).toContainText("/ 03:00");
  const problems = await page.evaluate(() => {
    const line = document.querySelector<HTMLElement>("[role='slider']");
    const panel = document.querySelector("[data-films-controls]");
    if (!line || !panel) return ["no time line"];
    const s = line.getBoundingClientRect();
    const out: string[] = [];
    // Along the very foot of the screen, a thin strip.
    if (Math.abs(s.bottom - window.innerHeight) > 1) out.push(`line ends at ${s.bottom}`);
    if (s.height > 16) out.push(`line is ${s.height} px tall`);
    const buttons = [...panel.querySelectorAll("button")].filter((b) => b.getClientRects().length);
    // The Index button stands in the bar on a wide screen (it lives with the way back).
    const index = [...document.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === "Index" && b.getBoundingClientRect().top > s.top - 100,
    );
    if (index) buttons.push(index);
    const name = (b: Element) => b.getAttribute("aria-label") ?? b.textContent ?? "";
    for (const b of buttons) {
      const r = b.getBoundingClientRect();
      // At least 5 px of dead panel between a button and the line.
      if (r.bottom > s.top - 5) out.push(`too close: ${name(b)}`);
      const points: Array<[number, number]> = [
        [r.left + r.width / 2, r.top + r.height / 2],
        [r.left + r.width / 2, r.top + 1],
        [r.left + r.width / 2, r.bottom - 1],
      ];
      for (const [x, y] of points) {
        const hit = document.elementFromPoint(x, y);
        if (hit?.closest("button") !== b) out.push(`${name(b)} at ${x},${y}`);
      }
    }
    // A press between two buttons lands on the panel (or a button), never on the film behind it.
    const row = buttons[0]?.parentElement?.parentElement?.getBoundingClientRect();
    if (row) {
      for (let x = row.left; x < row.right; x += 4) {
        const hit = document.elementFromPoint(x, row.top + row.height / 2);
        if (!hit || !(panel.contains(hit) || hit.closest("button"))) {
          out.push(`gap at ${x} hits ${hit?.tagName ?? "nothing"}`);
        }
      }
    }
    // Just above the line, and just under each button, is the panel: never the line.
    for (const b of buttons) {
      const r = b.getBoundingClientRect();
      const x = r.left + r.width / 2;
      for (let y = r.bottom; y < s.top; y += 1) {
        const hit = document.elementFromPoint(x, y);
        if (hit && line.contains(hit)) out.push(`line reaches ${name(b)} at ${y}`);
      }
    }
    return out;
  });
  expect(problems).toEqual([]);
});

test("the contents close on a press outside a film, and the focus goes back to Index", async ({
  page,
}) => {
  await open(page);
  const index = page.getByRole("button", { name: "Index", exact: true });
  await index.click();
  const sheet = page.getByRole("dialog", { name: "Films" });
  await expect(sheet).toBeVisible();
  // The film on screen has the focus.
  await expect(sheet.locator("[aria-current='true']")).toBeFocused();
  await page.waitForTimeout(700);
  // On a narrow screen: a Close button with room round it, and a header that stays at the top.
  const width = page.viewportSize()?.width ?? 0;
  if (width <= 900) {
    const close = sheet.getByRole("button", { name: "Close", exact: true });
    const box = await close.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(width - ((box?.x ?? 0) + (box?.width ?? 0))).toBeGreaterThan(12);
    await sheet.evaluate((el) => {
      el.scrollTop = 1200;
    });
    await expect.poll(async () => (await close.boundingBox())?.y ?? -1).toBeLessThan(40);
  }
  // A press on an empty part of the sheet.
  const spot = await sheet.evaluate((el) => {
    const r = el.getBoundingClientRect();
    for (let y = r.top + 120; y < r.bottom - 10; y += 6) {
      for (let x = r.left + 10; x < r.right - 10; x += 12) {
        const hit = document.elementFromPoint(x, y);
        if (hit instanceof HTMLElement && hit.hasAttribute("data-blank")) return { x, y };
      }
    }
    return null;
  });
  expect(spot).not.toBeNull();
  if (spot) await page.mouse.click(spot.x, spot.y);
  await expect(sheet).toBeHidden();
  await expect(index).toBeFocused();
  await expect(counter(page)).toContainText("01 / 10");
});

test("the back button returns to the room that opened the film", async ({ page }) => {
  await open(page, `?i=${IDS[2]}&from=music`);
  const back = page.locator("a[data-room-back]");
  await expect(back).toHaveAttribute("href", /\/collection\/music\/?$/u);
  await expect(back).toContainText("Music");
  // The strip rewrites `?i=` and keeps where the visitor came from.
  await page.keyboard.press("ArrowDown");
  await expect(counter(page)).toContainText("04 / 10");
  await expect(page).toHaveURL(/from=music/u);
  await expect(back).toHaveAttribute("href", /\/collection\/music\/?$/u);
});

test("subtitles are on at every visit, even after they were turned off", async ({ page }) => {
  await open(page, `?i=${IDS[5]}`);
  const cc = page.getByRole("button", { name: /CC/u });
  await expect(cc).toHaveAttribute("aria-pressed", "true");
  await cc.click();
  await expect(cc).toHaveAttribute("aria-pressed", "false");
  await page.reload();
  await expect(slides(page)).toHaveCount(10, { timeout: 60_000 });
  await expect(page.getByRole("button", { name: /CC/u })).toHaveAttribute("aria-pressed", "true");
});

test("full screen holds the room, its controls and the contents, and leaves cleanly", async ({
  page,
}) => {
  await open(page);
  const room = page.getByRole("region", { name: "Films" });
  const button = page.getByRole("button", { name: "Full screen", exact: true });
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await button.click();
  await expect(room).toHaveAttribute("data-fullscreen", "true");
  await expect(button).toHaveAttribute("aria-pressed", "true");
  const held = await page.evaluate(() =>
    document.fullscreenElement?.getAttribute("aria-roledescription"),
  );
  expect(held).toBe("carousel");
  // The contents open inside the room (anything outside it is not drawn), and the keys still work.
  await page.keyboard.press("i");
  const sheet = page.getByRole("dialog", { name: "Films" });
  await expect(sheet).toBeVisible();
  const inside = await room.evaluate((el) =>
    el.contains(document.querySelector("[role='dialog']")),
  );
  expect(inside).toBe(true);
  await sheet.getByRole("button", { name: "Close", exact: true }).click();
  await expect(sheet).toBeHidden();
  await page.keyboard.press("ArrowDown");
  await expect(counter(page)).toContainText("02 / 10");
  // The browser's own way out (Esc, its control) is followed.
  await page.evaluate(() => document.exitFullscreen());
  await expect(room).not.toHaveAttribute("data-fullscreen", "true");
  await expect(button).toHaveAttribute("aria-pressed", "false");
  // The button goes in and out.
  await button.click();
  await expect(room).toHaveAttribute("data-fullscreen", "true");
  await button.click();
  await expect(room).not.toHaveAttribute("data-fullscreen", "true");
});

test("full screen shows the whole frame without words, and its controls hide when idle", async ({
  page,
}) => {
  await open(page);
  const room = page.getByRole("region", { name: "Films" });
  const title = page.getByRole("heading", { level: 2, name: "Day of Enders" });
  const wholeFrame = page.getByRole("button", { name: "Whole frame", exact: true });
  const before = await room.getAttribute("data-fill");
  await page.getByRole("button", { name: "Full screen", exact: true }).click();
  await expect(room).toHaveAttribute("data-fullscreen", "true");
  // The whole picture, fitted: no cover, no switch for it, no words over it.
  await expect(room).toHaveAttribute("data-fill", "false");
  await expect(wholeFrame).toHaveCount(0);
  await expect(title).toBeHidden();
  // The plain time line takes the thin one's place: a row above the bar, with its handle and the
  // length at its end. The bar's own time is not repeated.
  const row = page.locator("[data-films-timeline]");
  const line = page.getByRole("slider", { name: "Time in the film" });
  await expect(row).toBeVisible();
  await expect(row.locator("[data-films-knob]")).toBeVisible();
  await expect(row).toContainText("03:00");
  await expect(line).toHaveCount(1);
  const readout = await page
    .locator("[data-films-controls] [aria-live='polite']")
    .evaluate((el) => el.parentElement?.getBoundingClientRect().width ?? 0);
  expect(readout).toBeLessThanOrEqual(1);
  // A press on the row jumps there: the middle of a 3 minute film.
  const lineBox = await row.getByRole("slider").boundingBox();
  if (lineBox)
    await page.mouse.click(lineBox.x + lineBox.width / 2, lineBox.y + lineBox.height / 2);
  await expect(row.getByRole("slider")).toHaveAttribute("aria-valuenow", "90");
  const view = page.viewportSize() ?? { width: 0, height: 0 };
  // Off the controls, nothing done: they hide.
  await page.mouse.move(view.width / 2, view.height / 3);
  await expect(room).toHaveAttribute("data-idle", "", { timeout: 4_000 });
  // The pointer moving brings them back, and so does a key.
  await page.mouse.move(view.width / 2 + 20, view.height / 3 + 10);
  await expect(room).not.toHaveAttribute("data-idle");
  await expect(room).toHaveAttribute("data-idle", "", { timeout: 4_000 });
  await page.keyboard.press("Shift");
  await expect(room).not.toHaveAttribute("data-idle");
  // The contents hold them shown while open.
  await page.keyboard.press("i");
  const sheet = page.getByRole("dialog", { name: "Films" });
  await expect(sheet).toBeVisible();
  await page.waitForTimeout(3_200);
  await expect(room).not.toHaveAttribute("data-idle");
  await sheet.getByRole("button", { name: "Close", exact: true }).click();
  await expect(sheet).toBeHidden();
  // Leaving puts the frame and the words back.
  await page.evaluate(() => document.exitFullscreen());
  await expect(room).not.toHaveAttribute("data-fullscreen", "true");
  await expect(room).toHaveAttribute("data-fill", before ?? "true");
  await expect(room).not.toHaveAttribute("data-idle");
  await expect(wholeFrame).toBeVisible();
  await expect(title).toBeVisible();
  // And the thin line at the foot, in place of the row.
  await expect(row).toHaveCount(0);
  await expect(line).toBeVisible();
});
