import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { skipGate, url } from "./helpers";

/**
 * The Voicelines room of the collection (`/collection/voicelines/`): a film behind the title, the ten
 * Aspirants in the layout of the Cosplay roster, a shortcut to each of eight languages under every
 * one of them and a larger button to her page. The page of an Aspirant
 * (`/collection/voicelines/<slug>/`) shows her lines in one language at a time: the language is the
 * parameter `?lang=` of the same page (Japanese when there is none), changed in place without a new
 * history entry, so Back goes to the room. Search, a translation under each line, a download for
 * each line and for all of them, and the old addresses of the room.
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

async function openRoom(page: Page, query = "") {
  await skipGate(page);
  const errors = watch(page);
  await page.goto(url(`/collection/voicelines/${query}`));
  await expect(page.locator("[data-voicelines-tile]").first()).toBeVisible({ timeout: 60_000 });
  return errors;
}

async function openPage(page: Page, slug: string, query = "") {
  await skipGate(page);
  const errors = watch(page);
  await page.goto(url(`/collection/voicelines/${slug}/${query}`));
  await expect(page.locator("[data-voicelines-lines] li").first()).toBeVisible({ timeout: 60_000 });
  return errors;
}

const lang = (page: Page) => new URL(page.url()).searchParams.get("lang");
const firstText = (page: Page) => page.locator("[data-voicelines-lines] li p[lang]").first();

test("the room shows the ten Aspirants, eight shortcuts under each and a larger button", async ({
  page,
}) => {
  const errors = await openRoom(page);
  await expect(page.getByRole("heading", { level: 1, name: "Voicelines" })).toBeVisible();
  await expect(page.locator("[data-voicelines-tile]")).toHaveCount(10);
  for (const slug of [
    "fanny",
    "layla",
    "ruby",
    "angela",
    "lesley",
    "change",
    "guinevere",
    "vexana",
    "selena",
    "obsidia",
  ]) {
    const tile = page.locator(`[data-voicelines-tile=${slug}]`);
    await expect(tile.locator("[data-lang]")).toHaveCount(8);
    await expect(tile.locator("[data-voicelines-open]")).toHaveCount(1);
  }
  await expect(page.locator("[data-voicelines-figures]")).toContainText("8 languages");
  // Each shortcut says its language in that language, with a flag.
  const fanny = page.locator("[data-voicelines-tile=fanny]");
  for (const name of [
    "English",
    "Bahasa Indonesia",
    "日本語",
    "اللغة العربية",
    "español",
    "português",
    "türkçe",
    "русский",
  ]) {
    await expect(fanny.locator("[data-lang]", { hasText: name })).toHaveCount(1);
  }
  await expect(fanny.locator("[data-lang] svg[data-flag]")).toHaveCount(8);
  expect(errors).toEqual([]);
});

test("the shortcuts and the button are links to the page of the Aspirant", async ({ page }) => {
  await openRoom(page);
  const fanny = page.locator("[data-voicelines-tile=fanny]");
  await expect(fanny.locator("[data-lang=es]")).toHaveAttribute(
    "href",
    /\/collection\/voicelines\/fanny\/?\?lang=es$/u,
  );
  await expect(fanny.locator("[data-voicelines-open]")).toHaveAttribute(
    "href",
    /\/collection\/voicelines\/fanny\/?$/u,
  );
  await expect(fanny.locator("[data-voicelines-open]")).toContainText("日本語");
});

test("a shortcut opens her page in that language", async ({ page }) => {
  await openRoom(page);
  await page.locator("[data-voicelines-tile=fanny] [data-lang=es]").click();
  await expect(page.locator("[data-voicelines-character=fanny]")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("[data-voicelines-character=fanny]")).toHaveAttribute(
    "data-lang",
    "es",
  );
  await expect(firstText(page)).toContainText("Girar", { timeout: 30_000 });
  await expect(page.locator("[data-voicelines-rail] a[data-lang=es]")).toHaveAttribute(
    "aria-current",
    "true",
  );
});

test("the larger button opens her page in Japanese, with the full recording and the trailer clips", async ({
  page,
}) => {
  await openRoom(page);
  await page.locator("[data-voicelines-tile=fanny] [data-voicelines-open]").click();
  await expect(page.locator("[data-voicelines-character=fanny]")).toHaveAttribute(
    "data-lang",
    "jp",
    {
      timeout: 60_000,
    },
  );
  await expect(page.locator("[data-voicelines-recording]")).toBeVisible();
  await expect(page.locator("[data-voicelines-trailer]")).toBeVisible();
  await expect(page.locator("[data-voicelines-lines] li")).toHaveCount(28);
  await expect(page.locator("[data-voicelines-lines] li [data-voice-play]").first()).toBeEnabled();
});

test("a language switch changes the address in place, and Back goes to the room", async ({
  page,
}) => {
  await openRoom(page);
  await page.locator("[data-voicelines-tile=layla] [data-voicelines-open]").click();
  await expect(page.locator("[data-voicelines-character=layla]")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("[data-voicelines-lines] li").first()).toBeVisible();
  const before = await page.evaluate(() => history.length);

  await page.locator("[data-voicelines-rail] a[data-lang=ru]").click();
  await expect.poll(() => lang(page)).toBe("ru");
  await expect(page.locator("[data-voicelines-character=layla]")).toHaveAttribute(
    "data-lang",
    "ru",
  );
  await expect(firstText(page)).toContainText("Цельсь");
  await page.locator("[data-voicelines-rail] a[data-lang=en]").click();
  await expect.poll(() => lang(page)).toBe("en");
  await expect(firstText(page)).toContainText("Aim");
  expect(await page.evaluate(() => history.length)).toBe(before);

  await page.goBack();
  await expect(page.locator("[data-voicelines-roster]")).toBeVisible({ timeout: 30_000 });
  expect(new URL(page.url()).pathname.replace(/\/$/u, "")).toBe("/collection/voicelines");
});

test("the button at the top goes to the room, whatever language is open", async ({ page }) => {
  await openPage(page, "obsidia", "?lang=tr");
  await page.locator("[data-room-back]").click();
  await expect(page.locator("[data-voicelines-roster]")).toBeVisible({ timeout: 30_000 });
  expect(new URL(page.url()).pathname.replace(/\/$/u, "")).toBe("/collection/voicelines");
});

test("an address names the language: jp, ja, and anything unknown is Japanese", async ({
  page,
}) => {
  await openPage(page, "ruby", "?lang=pt");
  await expect(page.locator("[data-voicelines-character=ruby]")).toHaveAttribute("data-lang", "pt");
  await page.goto(url("/collection/voicelines/ruby/?lang=ja"));
  await expect(page.locator("[data-voicelines-character=ruby]")).toHaveAttribute(
    "data-lang",
    "jp",
    { timeout: 60_000 },
  );
  await page.goto(url("/collection/voicelines/ruby/?lang=zz"));
  await expect(page.locator("[data-voicelines-character=ruby]")).toHaveAttribute(
    "data-lang",
    "jp",
    { timeout: 60_000 },
  );
});

test("Arabic is drawn right to left, with its own language rows", async ({ page }) => {
  await openPage(page, "layla", "?lang=ar");
  await expect(firstText(page)).toHaveAttribute("dir", "rtl");
  await expect(firstText(page)).toHaveAttribute("lang", "ar");
  await expect(page.locator("[data-voicelines-rail] a[data-lang=ar]")).toHaveAttribute(
    "aria-current",
    "true",
  );
});

test("search narrows the lines and is kept in the address", async ({ page }) => {
  await openPage(page, "fanny", "?lang=en");
  const rows = page.locator("[data-voicelines-lines] li");
  await expect(rows).toHaveCount(28);
  const box = page.getByRole("searchbox");
  await expect(async () => {
    await box.fill("terrinia");
    expect(new URL(page.url()).searchParams.get("q")).toBe("terrinia");
  }).toPass({ timeout: 20_000 });
  const count = await rows.count();
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThan(28);
  await expect(page.locator("[data-voicelines-figures]")).toContainText(`${count} of 28 lines`);
});

test("the translation under a line can be changed or turned off", async ({ page }) => {
  await openPage(page, "fanny", "?lang=es");
  const select = page.getByLabel("Translate");
  await expect(select).toHaveValue("en");
  await expect(page.locator("[data-voicelines-lines] li").first()).toContainText("Swivel");
  await select.selectOption("ru");
  await expect.poll(() => new URL(page.url()).searchParams.get("tr")).toBe("ru");
  await expect(page.locator("[data-voicelines-lines] li").first()).toContainText("Поворот");
  await select.selectOption("off");
  await expect(page.locator("[data-voicelines-lines] li").first()).not.toContainText("Поворот");
});

test("the Japanese list carries its own English translation", async ({ page }) => {
  await openPage(page, "fanny", "?lang=jp");
  await expect(page.locator("[data-voicelines-lines] li").first()).toContainText(
    "A strong Aspirant spirit",
  );
  await expect(page.getByLabel("Translate").locator("option")).toHaveCount(2);
});

test("every line has a play button, and a download named after the Aspirant, the language and the line", async ({
  page,
}) => {
  await openPage(page, "selena", "?lang=id");
  await expect(page.locator("[data-voicelines-lines] li")).toHaveCount(47);
  await expect(page.locator("[data-voicelines-lines] li [data-voice-play]")).toHaveCount(47);
  const first = page.locator("[data-voicelines-lines] li a[download]").first();
  await expect(first).toHaveAttribute("download", "Selena - Indonesian - 01.flac");
  await expect(first).toHaveAttribute("href", /\/library\/v1\/voicelines\/selena\/id\/01\.flac$/u);
  await expect(page.locator("[data-voicelines-save-all]")).toBeEnabled();
});

test("the addresses of the first version of the room still arrive", async ({ page }) => {
  await skipGate(page);
  await page.goto(url("/collection/voicelines/?who=obsidia"));
  await expect(page.locator("[data-voicelines-character=obsidia]")).toBeVisible({
    timeout: 60_000,
  });
  await page.goto(url("/collection/voicelines/?i=voice-fanny-03"));
  await expect(page.locator("[data-voicelines-character=fanny]")).toBeVisible({ timeout: 60_000 });
  const params = new URL(page.url()).searchParams;
  expect(params.get("lang")).toBe("jp");
  expect(params.get("i")).toBe("03");
  await expect(page.locator("[data-voicelines-lines] li#line-03")).toBeVisible();
});

test("no sideways scroll at a phone's width, and the language row slides", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openRoom(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.goto(url("/collection/voicelines/vexana/?lang=ru"));
  await expect(page.locator("[data-voicelines-lines] li").first()).toBeVisible({ timeout: 60_000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await expect(page.locator("[data-voicelines-rail] a[data-lang=ru]")).toHaveAttribute(
    "aria-current",
    "true",
  );
});

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => ({ id: v.id, help: v.help, nodes: v.nodes.map((n) => n.target.join(" ")) }));
}

test("no serious accessibility violations on the room", async ({ page }) => {
  await openRoom(page);
  // The film streams, so the network never goes quiet: wait a moment instead.
  await page.waitForTimeout(1500);
  const serious = await seriousViolations(page);
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
});

for (const query of ["?lang=jp", "?lang=ar", "?lang=tr"]) {
  test(`no serious accessibility violations on the page of an Aspirant (${query})`, async ({
    page,
  }) => {
    await openPage(page, "layla", query);
    await page.waitForTimeout(800);
    const serious = await seriousViolations(page);
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });
}
