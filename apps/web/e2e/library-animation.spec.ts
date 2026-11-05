import fs from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { skipGate, url, watchErrors } from "./helpers";

/**
 * The Animation room. The test browser may not decode H.264, so these specs check what does not
 * depend on playback: the picker, the buttons, the keys, the address and the "Preparing" state.
 * Selena plays from the site's own files, so the specs open her. The six characters that come from
 * the library folder are never needed: a tab of a character without stage data must say Preparing,
 * and which tabs those are is read from the folder, not written here.
 */

test.describe.configure({ timeout: 240_000 });

const ROOT = process.cwd();
const ANIMATION = path.join(ROOT, "src/features/library/animation");

interface Data {
  characters: Array<{ slug: string; name: string }>;
  items: Array<{ id: string; chars: string[]; kind: string; label: string }>;
}

const DATA = JSON.parse(
  fs.readFileSync(path.join(ROOT, "public/data/library/animation.json"), "utf8"),
) as Data;

/** The characters that play from the site's own files, and those with a generated stage file. */
const SITE = ["selena", "obsidia", "vexana", "guinevere"];
const BUILT = fs
  .readdirSync(path.join(ANIMATION, "stage-data"), { withFileTypes: true })
  .filter((f) => f.isFile() && f.name.endsWith(".generated.ts"))
  .map((f) => f.name.replace(".generated.ts", ""));
const PLAYS = new Set([...SITE, ...BUILT]);
const PREPARING = DATA.characters.filter((c) => !PLAYS.has(c.slug));

async function open(page: Page, query = "?c=selena") {
  await skipGate(page);
  const errors = watchErrors(page);
  await page.goto(url(`/collection/animation/${query}`));
  await expect(page.getByRole("tablist", { name: "Character" })).toBeVisible({ timeout: 100_000 });
  return errors;
}

test("lists the ten characters as tabs and one set of buttons", async ({ page }) => {
  const errors = await open(page);
  const tabs = page.getByRole("tab");
  await expect(tabs).toHaveCount(10);
  await expect(page.getByRole("tab", { name: /Selena/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { level: 1, name: "Animation" })).toBeVisible();
  // Selena has the welcome, the idle loop, three poses and three short clips.
  const clips = DATA.items.filter((i) => i.chars[0] === "selena");
  expect(clips).toHaveLength(8);
  for (const clip of clips) {
    await expect(
      page.getByRole("button", { name: new RegExp(`^\\S*\\s*${clip.label}`) }).first(),
    ).toBeAttached({
      timeout: 100_000,
    });
  }
  // One version: there is no quality picker.
  await expect(page.getByText(/quality/i)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("the arrow keys change the character and the address follows", async ({ page }) => {
  await open(page);
  await page.keyboard.press("ArrowRight");
  // Selena is the last tab, so the choice wraps round to Fanny.
  await expect(page.getByRole("tab", { name: /Fanny/ })).toHaveAttribute("aria-selected", "true");
  await expect(page).toHaveURL(/c=fanny/);
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("tab", { name: /Selena/ })).toHaveAttribute("aria-selected", "true");
  await expect(page).toHaveURL(/c=selena/);
});

test("a tab opens its character from the address and a click", async ({ page }) => {
  await open(page, "?c=vexana");
  await expect(page.getByRole("tab", { name: /Vexana/ })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: /Obsidia/ }).click();
  await expect(page.getByRole("tab", { name: /Obsidia/ })).toHaveAttribute("aria-selected", "true");
  await expect(page).toHaveURL(/c=obsidia/);
});

test("every character without stage data says Preparing", async ({ page }) => {
  test.skip(PREPARING.length === 0, "every character has stage data");
  const errors = await open(page);
  const first = PREPARING[0]!;
  // The tab says so, and the stage says so with its still picture.
  await expect(page.getByRole("tab", { name: new RegExp(first.name) })).toContainText("Preparing");
  await page.getByRole("tab", { name: new RegExp(first.name) }).click();
  await expect(page.getByText("is not ready yet")).toBeVisible({ timeout: 30_000 });
  // A character that plays has no such label.
  for (const slug of PLAYS) {
    const name = DATA.characters.find((c) => c.slug === slug)?.name ?? slug;
    await expect(page.getByRole("tab", { name: new RegExp(name) })).not.toContainText("Preparing");
  }
  expect(errors).toEqual([]);
});

test("the page of a character is one link away", async ({ page }) => {
  await open(page);
  await expect(page.getByRole("link", { name: /Open Selena.s page/ })).toHaveAttribute(
    "href",
    /\/character\/selena\/?$/,
  );
});
