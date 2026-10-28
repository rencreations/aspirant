import { expect, test, type Page } from "@playwright/test";

import { skipGate, url, watchErrors } from "./helpers";

const KEY = "aspirants:drama:v1";

/** A visitor part way through: two answers given, three episodes open, no ending yet. */
const IN_PROGRESS = {
  version: 1,
  unlocked: ["2A", "3A"],
  crossed: ["1:0", "2A:0"],
  endings: [],
  run: {
    node: "3A",
    at: 12.5,
    route: [
      { from: "1", choice: 0 },
      { from: "2A", choice: 0 },
    ],
    finished: false,
  },
};

async function withSave(page: Page, save: unknown) {
  await page.addInitScript(
    ([key, value]) => {
      if (!window.localStorage.getItem(key)) {
        window.localStorage.setItem(key, JSON.stringify(value));
      }
    },
    [KEY, save] as const,
  );
}

const saved = (page: Page) =>
  page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as { run: { node: string } | null; unlocked: string[] }) : null;
  }, KEY);

async function openDrama(page: Page, slug = "vexana") {
  await page.goto(url(`/character/${slug}/`));
  const drama = page.locator("#drama");
  await drama.waitFor({ state: "attached" });
  await drama.evaluate((el) => {
    el.scrollIntoView({ block: "center" });
  });
  await expect(drama.getByRole("button", { name: /level select/i })).toBeVisible();
  return drama;
}

test.describe("interactive drama", () => {
  test.beforeEach(async ({ page }) => {
    await skipGate(page);
  });

  for (const slug of ["vexana", "guinevere"]) {
    test(`${slug}: the page opens at the top and the game takes nothing`, async ({ page }) => {
      await page.goto(url(`/character/${slug}/`));
      await page.waitForLoadState("load");
      await page.waitForTimeout(1500);
      expect(await page.evaluate(() => window.scrollY)).toBeLessThan(50);
      const inside = await page.evaluate(
        () => document.activeElement?.closest("#drama") !== null && document.activeElement !== null,
      );
      expect(inside).toBe(false);
    });
  }

  test("Continue shows where the run is, and Start New asks before it replaces the run", async ({
    page,
  }) => {
    await withSave(page, IN_PROGRESS);
    const drama = await openDrama(page);
    const cont = drama.getByRole("button", { name: /^continue/i });
    await expect(cont).toBeEnabled();
    await expect(cont).toContainText("Chapter 3");

    await drama.getByRole("button", { name: /start new/i }).click();
    await expect(drama.getByText("Your run will be replaced")).toBeVisible();
    // Nothing was lost yet.
    expect((await saved(page))?.run?.node).toBe("3A");

    // Esc and "Keep my run" both leave the run alone.
    await page.keyboard.press("Escape");
    await expect(drama.getByRole("button", { name: /start new/i })).toBeVisible();
    expect((await saved(page))?.run?.node).toBe("3A");

    await drama.getByRole("button", { name: /start new/i }).click();
    await drama.getByRole("button", { name: "Start over" }).click();
    await expect.poll(async () => (await saved(page))?.run?.node).toBe("1");
    // What was unlocked stays.
    expect((await saved(page))?.unlocked).toEqual(expect.arrayContaining(["2A", "3A"]));
  });

  test("a first visit has nothing to continue, and Start New does not ask", async ({ page }) => {
    const drama = await openDrama(page);
    await expect(drama.getByRole("button", { name: /^continue/i })).toBeDisabled();
    await drama.getByRole("button", { name: /start new/i }).click();
    await expect.poll(async () => (await saved(page))?.run?.node).toBe("1");
    await expect(drama.getByText("Your run will be replaced")).toHaveCount(0);
  });

  test("level select: locked episodes stay locked, open ones play", async ({ page }) => {
    const errors = watchErrors(page);
    await withSave(page, IN_PROGRESS);
    const drama = await openDrama(page);
    await drama.getByRole("button", { name: /level select/i }).click();
    const levels = drama.getByRole("group", { name: "Level select" });
    await expect(levels).toBeVisible();

    await levels
      .getByRole("button", { name: /chapter 5, locked/i })
      .first()
      .click();
    await expect(levels.getByRole("button", { name: /play from here/i })).toBeDisabled();
    await expect(levels.getByText("You have not reached this episode yet")).toBeVisible();

    // The run is at 3A, so the card is marked and playing from another episode warns first.
    await levels.getByRole("button", { name: /chapter 2, the emblem/i }).click();
    await expect(levels.getByText(/run in progress is replaced/i)).toBeVisible();
    await levels.getByRole("button", { name: /play from here/i }).click();
    await expect.poll(async () => (await saved(page))?.run?.node).toBe("2A");
    expect(errors.filter((e) => !/Failed to load resource|ERR_/.test(e))).toEqual([]);
  });

  test("level select: Esc goes back, Enter on an open episode plays it", async ({ page }) => {
    await withSave(page, IN_PROGRESS);
    const drama = await openDrama(page);
    await drama.getByRole("button", { name: /level select/i }).click();
    const levels = drama.getByRole("group", { name: "Level select" });
    await page.keyboard.press("Escape");
    await expect(levels).toHaveCount(0);

    await drama.getByRole("button", { name: /level select/i }).click();
    await expect(levels).toBeVisible();
    // The focus starts on the episode of the run (3A); Left goes to chapter 2.
    await page.keyboard.press("ArrowLeft");
    await expect(levels.locator("[aria-pressed='true']")).toHaveAccessibleName(/chapter 2/i);
    await page.keyboard.press("Enter");
    await expect.poll(async () => (await saved(page))?.run?.node).toBe("2A");
  });

  test("a save from another version or a broken one is ignored, not a crash", async ({ page }) => {
    const errors = watchErrors(page);
    await page.addInitScript((key) => {
      window.localStorage.setItem(key, "{not json");
    }, KEY);
    const drama = await openDrama(page);
    await expect(drama.getByRole("button", { name: /^continue/i })).toBeDisabled();
    expect(errors).toEqual([]);
  });

  test("on a narrow screen the tree keeps a readable size and the page does not scroll sideways", async ({
    page,
  }) => {
    await withSave(page, IN_PROGRESS);
    const drama = await openDrama(page);
    await drama.getByRole("button", { name: /level select/i }).click();
    await expect(drama.getByRole("group", { name: "Level select" })).toBeVisible();
    const overflow = await page.evaluate(() => {
      const el = document.scrollingElement ?? document.documentElement;
      return el.scrollWidth - window.innerWidth;
    });
    expect(overflow).toBeLessThanOrEqual(0);
    const card = await drama
      .getByRole("button", { name: /chapter 3, alarm/i })
      .or(drama.getByRole("button", { name: /chapter 3, where/i }))
      .first()
      .boundingBox();
    expect(card?.width ?? 0).toBeGreaterThan(48);
  });
});
