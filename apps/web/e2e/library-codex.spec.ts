import fs from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { skipGate, url } from "./helpers";

/**
 * The codex of the lore room (`/collection/lore/`): a page for every person, place, thing, group,
 * idea, creature and event of the story, opening as a window over the room with an address of its
 * own (`/collection/lore/<slug>/`), the relationship pictures and pages, and the spoiler shield.
 */

test.describe.configure({ timeout: 120_000 });

interface Row {
  slug: string;
  name: string;
  kind: string;
  first: number;
  rel: Array<{ to: string }>;
}

const CODEX = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "public/data/library/lore-codex.json"), "utf8"),
) as { entries: Row[]; pairs: Array<{ slug: string; a: string; b: string }> };

const bySlug = new Map(CODEX.entries.map((e) => [e.slug, e] as const));
const LATE = CODEX.entries.find((e) => e.kind === "person" && e.first >= 50 && e.rel.length > 0);

/** A reader who has reached chapter 3. */
const READER = JSON.stringify({
  v: 3,
  chapterId: "c03",
  paragraphId: "c03-p002",
  textScale: 1,
  theme: "daybreak",
  furthest: 3,
});

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

const win = (page: Page) => page.getByRole("dialog");

test("every entry and every relationship has a page of its own", () => {
  expect(CODEX.entries.length).toBeGreaterThan(500);
  expect(new Set(CODEX.entries.map((e) => e.slug)).size).toBe(CODEX.entries.length);
  for (const p of CODEX.pairs) {
    expect(bySlug.has(p.a) && bySlug.has(p.b), p.slug).toBe(true);
    expect(p.slug).toBe(`${p.a}--${p.b}`);
    expect(p.a < p.b).toBe(true);
  }
  for (const slug of [
    "layla",
    "fanny",
    "ruby",
    "angela",
    "lesley",
    "change",
    "guinevere",
    "vexana",
    "selena",
    "obsidia",
  ]) {
    expect(bySlug.get(slug)?.kind, slug).toBe("person");
  }
});

test("the room opens on the codex, by kind, with a card for each entry", async ({ page }) => {
  await skipGate(page);
  const errors = watch(page);
  await page.goto(url("/collection/lore/"));
  await expect(page.getByRole("tab", { name: /Codex/ })).toHaveAttribute("aria-selected", "true");
  const people = CODEX.entries.filter((e) => e.kind === "person").length;
  await expect(page.locator("section[aria-label='The codex'] ul > li")).toHaveCount(people);
  await page.getByRole("button", { name: /^Places/ }).click();
  const places = CODEX.entries.filter((e) => e.kind === "place").length;
  await expect(page.locator("section[aria-label='The codex'] ul > li")).toHaveCount(places);
  expect(errors).toEqual([]);
});

test("a card opens a window and the address, without leaving the room; Back closes it", async ({
  page,
}) => {
  await skipGate(page);
  await page.goto(url("/collection/lore/"));
  await page.evaluate(() => {
    (window as unknown as { __room: number }).__room = 1;
  });
  await page.locator("a[href='/collection/lore/layla/']").first().click();
  await expect(win(page)).toBeVisible();
  await expect(win(page).getByRole("heading", { level: 2, name: "Layla" })).toBeVisible();
  await expect(page).toHaveURL(/\/collection\/lore\/layla\/$/);
  // The room was not reloaded.
  expect(await page.evaluate(() => (window as unknown as { __room?: number }).__room)).toBe(1);
  // The Aspirants have their own page too.
  await expect(win(page).getByRole("link", { name: /Open Layla.s own page/ })).toHaveAttribute(
    "href",
    /\/character\/layla\/?$/,
  );
  await page.goBack();
  await expect(win(page)).toHaveCount(0);
  await expect(page).toHaveURL(/\/collection\/lore\/$/);
});

test("a window opened by its link (a cold load) shows the entry, and Esc closes it to the room", async ({
  page,
}) => {
  await skipGate(page);
  const errors = watch(page);
  await page.goto(url("/collection/lore/fanny/"));
  await expect(win(page).getByRole("heading", { level: 2, name: "Fanny" })).toBeVisible();
  await expect(
    win(page).getByRole("heading", { level: 3, name: "What the story says" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(win(page)).toHaveCount(0);
  await expect(page).toHaveURL(/\/collection\/lore\/$/);
  expect(errors).toEqual([]);
});

test("the relationships of an entry: a picture, a list, and each tie opens its own page", async ({
  page,
}) => {
  await skipGate(page);
  await page.goto(url("/collection/lore/layla/"));
  const rel = win(page).locator("section[aria-labelledby='codex-rel']");
  await expect(rel.locator("svg")).toBeVisible();
  const item = rel.locator("ul > li").first();
  await expect(item).toBeVisible();
  // The way to the page of the two together.
  await item.getByRole("link", { name: /are tied/ }).click();
  await expect(page).toHaveURL(/\/collection\/lore\/[a-z0-9-]+--[a-z0-9-]+\/$/);
  await expect(
    win(page).getByRole("heading", { level: 3, name: "What the story says of the two" }),
  ).toBeVisible();
  // And on to one of the two.
  await win(page).locator("ul a").first().click();
  await expect(page).toHaveURL(/\/collection\/lore\/[a-z0-9-]+\/$/);
});

test("a page of two entries opens by its own address", async ({ page }) => {
  await skipGate(page);
  const pair = CODEX.pairs.find((p) => p.slug === "fanny--layla") ?? CODEX.pairs[0];
  expect(pair).toBeDefined();
  await page.goto(url(`/collection/lore/${pair?.slug ?? ""}/`));
  await expect(win(page).getByRole("heading", { level: 3 }).first()).toBeVisible();
  await expect(win(page).locator("ul li").first()).toBeVisible();
});

test("search finds an entry by name and opens it", async ({ page }) => {
  await skipGate(page);
  await page.goto(url("/collection/lore/"));
  const box = page.getByRole("searchbox");
  await expect(async () => {
    await box.fill("storm citadel");
    await expect(page.locator("section[aria-label='The codex'] ul > li").first()).toContainText(
      /Storm Citadel/i,
      { timeout: 1500 },
    );
  }).toPass({ timeout: 20_000 });
  await page.locator("section[aria-label='The codex'] ul > li a").first().click();
  await expect(win(page)).toBeVisible();
});

test("the spoiler shield keeps a reader's unread chapters shut, and one press opens them", async ({
  page,
}) => {
  test.skip(!LATE, "no late person with ties in the data");
  await skipGate(page);
  await page.addInitScript((saved) => localStorage.setItem("aspirants:reader", saved), READER);
  await page.goto(url(`/collection/lore/${LATE?.slug ?? ""}/`));
  await expect(win(page).getByText("Show it anyway")).toBeVisible();
  await expect(win(page).getByRole("heading", { level: 2, name: "Not met yet" })).toBeVisible();
  await win(page).getByRole("button", { name: "Show it anyway" }).click();
  await expect(win(page).getByRole("heading", { level: 2, name: LATE?.name ?? "" })).toBeVisible();
});

test("the wheel scrolls inside the window and not the room behind it", async ({ page }) => {
  await skipGate(page);
  await page.goto(url("/collection/lore/selena/"));
  const sheet = win(page);
  await expect(sheet.getByRole("heading", { level: 3, name: "What the story says" })).toBeVisible();
  const box = await sheet.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(
    (box?.x ?? 0) + (box?.width ?? 0) / 2,
    (box?.y ?? 0) + (box?.height ?? 0) / 2,
  );
  await page.mouse.wheel(0, 700);
  await expect
    .poll(() => sheet.evaluate((el) => el.scrollTop), { timeout: 5000 })
    .toBeGreaterThan(100);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test("the window fits a phone: no sideways scroll, full screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await skipGate(page);
  await page.goto(url("/collection/lore/layla/"));
  const sheet = win(page);
  await expect(sheet).toBeVisible();
  const box = await sheet.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(388);
  const over = await sheet.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(over).toBeLessThanOrEqual(1);
});
