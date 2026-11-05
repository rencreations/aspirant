import fs from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { skipGate, url } from "./helpers";

/**
 * The scene stills of the Arts room (`/collection/arts/?tab=scenes`): the rail of films, the strip
 * of stills of each film with its scrubber, the filters, the contact sheet and the viewer with its
 * link to the Films room.
 */

test.describe.configure({ timeout: 120_000 });

interface Film {
  id: string;
  title: string;
  chars: string[];
  pair: string;
  scenes: Array<{ id: string; t: number; time: string; note: string }>;
}

const DATA = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "public/data/library/arts-scenes.json"), "utf8"),
) as { films: Film[]; totals: { films: number; scenes: number } };

const FIRST = DATA.films[0]!;

/**
 * Console errors and uncaught exceptions. The pictures come from the library origin, which a test
 * run may not serve, so a failed file under `/library/v1/` is not counted.
 */
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
  await page.goto(url(`/collection/arts/?tab=scenes${query}`));
  await expect(page.locator("[data-film]").first()).toBeAttached({ timeout: 30_000 });
  return errors;
}

const cells = (page: Page) => page.locator("[data-cell]");

test("shows a strip for every film and the rail", async ({ page }) => {
  const errors = await open(page);
  await expect(page.getByRole("navigation", { name: "Films" })).toBeVisible();
  // The films are drawn a few at a time, then all of them.
  await expect(page.locator("[data-film]")).toHaveCount(DATA.totals.films, { timeout: 30_000 });
  await expect(page.getByRole("status").filter({ hasText: "stills in" })).toContainText(
    `${DATA.totals.scenes.toLocaleString("en-US")} stills in ${DATA.totals.films} films`,
  );
  const first = page.locator("[data-film]").first();
  await expect(first.getByRole("heading", { level: 2 })).toHaveText(FIRST.title);
  await expect(first.locator("[data-cell]")).toHaveCount(FIRST.scenes.length);
  expect(errors).toEqual([]);
});

test("a press on a still opens the viewer with a link that watches that moment", async ({
  page,
}) => {
  await open(page);
  const first = FIRST.scenes[0]!;
  await cells(page).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`i=${first.id}`));
  const link = dialog.getByRole("link", { name: "Watch this scene" });
  await expect(link).toHaveAttribute(
    "href",
    new RegExp(`/collection/films/?\\?i=${FIRST.id}&t=${Math.floor(first.t)}`),
  );
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("a link to a still opens it, even when a filter would hide it", async ({ page }) => {
  const film = DATA.films[DATA.films.length - 1]!;
  const scene = film.scenes[0]!;
  await open(page, `&sf=${encodeURIComponent(FIRST.id)}&i=${encodeURIComponent(scene.id)}`);
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("dialog").getByRole("link", { name: "Watch this scene" }),
  ).toBeVisible();
});

test("filters by film, character and search, and clears", async ({ page }) => {
  await open(page);
  await page.getByLabel("Film", { exact: true }).selectOption(FIRST.id);
  await expect(page.locator("[data-film]")).toHaveCount(1);
  await expect(page).toHaveURL(/sf=/);
  await page.getByLabel("Film", { exact: true }).selectOption("");
  await expect(page.locator("[data-film]")).toHaveCount(DATA.totals.films, { timeout: 30_000 });

  const withNotes = DATA.films.flatMap((f) => f.scenes).find((s) => s.note.length > 0);
  if (withNotes) {
    const word =
      withNotes.note.split(" ").find((w) => w.length > 5) ?? withNotes.note.split(" ")[0] ?? "";
    await page.getByRole("searchbox").fill(word);
    await expect(page.getByRole("status").filter({ hasText: "stills in" })).toContainText(" of ");
    await page.getByRole("searchbox").fill("zzzzzzzzqq");
    await expect(page.getByText("No scene matches")).toBeVisible();
    await page.getByRole("button", { name: "Clear the filters" }).click();
    await expect(page.locator("[data-film]").first()).toBeAttached();
  }

  const group = page.getByRole("group", { name: "Character" });
  await group.getByRole("button", { name: /^Selena/ }).click();
  await expect(page).toHaveURL(/sw=selena/);
  const expected = DATA.films.filter((f) => f.chars.includes("selena")).length;
  await expect(page.locator("[data-film]")).toHaveCount(expected, { timeout: 30_000 });
});

test("the contact sheet shows the same stills closer together", async ({ page }) => {
  await open(page, `&sf=${encodeURIComponent(FIRST.id)}`);
  const strip = await cells(page).first().boundingBox();
  await page.getByRole("button", { name: "Sheet" }).click();
  await expect(page).toHaveURL(/sv=sheet/);
  await expect(cells(page)).toHaveCount(FIRST.scenes.length);
  const sheet = await cells(page).first().boundingBox();
  expect(sheet?.width ?? 0).toBeLessThan(strip?.width ?? 0);
});

test("the scrubber moves with the scroll and a press on the rail goes to a film", async ({
  page,
}) => {
  await open(page);
  await expect(page.locator("[data-film]")).toHaveCount(DATA.totals.films, { timeout: 30_000 });
  const second = DATA.films[1]!;
  await page
    .getByRole("navigation", { name: "Films" })
    .getByRole("button", { name: new RegExp(second.title) })
    .first()
    .click();
  const section = page.locator(`[data-film="${second.id}"]`);
  // On a wide screen the film comes up near the top; on a narrow one the rail and the header take
  // more of the screen, so "in view" is the test.
  const view = page.viewportSize() ?? { width: 1440, height: 900 };
  const limit = view.width < 900 ? view.height * 0.95 : 400;
  await expect
    .poll(async () => (await section.boundingBox())?.y ?? 9999, { timeout: 10_000 })
    .toBeLessThan(limit);
  // Scroll down inside the film: the readout moves on.
  const read = section.locator("[data-read]");
  const before = (await read.textContent()) ?? "";
  await page.mouse.wheel(0, 1400);
  await expect
    .poll(async () => (await read.textContent()) ?? "", { timeout: 10_000 })
    .not.toBe(before);
  expect(
    await section.locator("[data-head]").evaluate((el) => (el as HTMLElement).style.transform),
  ).toContain("translate3d");
});

test("fits the phone without a sideways scroll", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await open(page);
  const over = await page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return el.scrollWidth - window.innerWidth;
  });
  expect(over).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});
