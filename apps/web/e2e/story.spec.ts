import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { skipGate, url, watchErrors } from "./helpers";

test.beforeEach(async ({ page }) => {
  await skipGate(page);
});

async function open(page: Page) {
  const errors = watchErrors(page);
  const response = await page.goto(url("/story/"));
  expect(response?.status()).toBe(200);
  await page.waitForLoadState("networkidle");
  return errors;
}

async function overflow(page: Page) {
  return page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return el.scrollWidth - window.innerWidth;
  });
}

async function scrollTo(page: Page, selector: string, offset = -80) {
  await page.evaluate(
    ([sel, off]) => {
      const el = document.querySelector(sel as string);
      if (!el) throw new Error(`missing ${String(sel)}`);
      window.scrollTo({
        top: el.getBoundingClientRect().top + window.scrollY + Number(off),
        behavior: "instant",
      });
    },
    [selector, offset],
  );
  await page.waitForTimeout(500);
}

test("loads with one h1, every section, no console errors and no horizontal overflow", async ({
  page,
}) => {
  const errors = await open(page);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1, name: /Story/ })).toBeVisible();
  for (const id of [
    "places-title",
    "before-after-title",
    "cycle-title",
    "hierarchy-title",
    "lab-title",
    "timeline-title",
    "who-title",
    "open-title",
    "words-title",
  ]) {
    await expect(page.locator(`#${id}`)).toHaveCount(1);
  }
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});

test("places: choosing a hex shows its line and chapter links", async ({ page }) => {
  await open(page);
  await scrollTo(page, "#places-title");
  await page.getByRole("button", { name: /Underhill/ }).click();
  const inspector = page.locator("[aria-live=polite]", { hasText: "Place 06 of 09" });
  await expect(inspector).toContainText("A black market in forgotten cellars");
  const link = inspector.getByRole("link", { name: "Read Chapter 50" });
  await expect(link).toHaveAttribute("href", /experience\/#c50$/);
  // Keyboard: arrow keys move between hexes.
  await page.getByRole("button", { name: /Valemont/ }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("button", { name: /Hollin Reach/ })).toBeFocused();
});

test("before and after: the slider and the hold button change the view", async ({ page }) => {
  await open(page);
  await scrollTo(page, '[data-track="oro"]', 20);
  const stage = page.locator('[data-track="oro"] [role=group]');
  const slider = page.locator('[data-track="oro"] input[type=range]');
  await slider.focus();
  await page.keyboard.press("End");
  await expect.poll(async () => stage.getAttribute("data-phase")).toBe("after");
  await page.keyboard.press("Home");
  await expect.poll(async () => stage.getAttribute("data-phase")).toBe("before");
  const hold = page
    .locator('[data-track="oro"]')
    .getByRole("button", { name: /Hold to see before/ });
  await hold.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.locator('[data-track="oro"]').getByRole("button", { name: /Release for after/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Enter");
  await expect(hold).toHaveAttribute("aria-pressed", "false");
});

test("the Cycle: tabs turn the ring and read the stage", async ({ page }) => {
  await open(page);
  await scrollTo(page, "#cycle-title");
  await page.getByRole("tab", { name: /Embers are spared/ }).click();
  const panel = page.getByRole("tabpanel");
  await expect(panel).toContainText("Most of it is destroyed, and a few embers are spared.");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: /The survivors rebuild/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("the hierarchy: each layer opens, and the Core is a device", async ({ page }) => {
  await open(page);
  await scrollTo(page, "#hierarchy-title");
  const core = page.getByRole("button", { name: /The Ender Control Core/ });
  await core.click();
  await expect(core).toHaveAttribute("aria-expanded", "true");
  const detail = page.getByRole("region", { name: /The Ender Control Core/ });
  await expect(detail).toContainText("Not a being");
  await expect(detail).toContainText("left open");
  await page.getByRole("button", { name: /The Mother Matrix/ }).click();
  await expect(page.getByRole("region", { name: /The Mother Matrix/ })).toContainText("web");
});

test("the lab: presets set the story's real scores", async ({ page }) => {
  await open(page);
  await scrollTo(page, "#lab-title");
  await page.getByRole("button", { name: /Fanny and Layla/ }).click();
  await expect(page.getByRole("meter", { name: "Coupling" })).toHaveAttribute(
    "aria-valuenow",
    /^2\.1/,
    { timeout: 5000 },
  );
  await page.getByRole("button", { name: /Guinevere and Vexana/ }).click();
  await expect(page.getByRole("meter", { name: "Coupling" })).toHaveAttribute(
    "aria-valuenow",
    /^1\.62/,
    { timeout: 5000 },
  );
  const slider = page.getByRole("slider", { name: "How close the two crystals are" });
  await slider.focus();
  await page.keyboard.press("Home");
  await expect(page.getByRole("meter", { name: "Coupling" })).toHaveAttribute("aria-valuenow", "0");
});

test("the timeline: stops link to chapters and the buttons move", async ({ page }, info) => {
  await open(page);
  await scrollTo(page, "#timeline-title", 40);
  const first = page.getByRole("link", { name: "Read Chapter 24" }).first();
  await expect(first).toHaveAttribute("href", /experience\/#c24$/);
  if (info.project.name === "phone") {
    await expect(page.getByRole("button", { name: "Next stop" })).toBeHidden();
    return;
  }
  await page.getByRole("button", { name: "Next stop" }).click();
  await expect(page.getByText(/Stop 02 of/)).toBeVisible();
});

test("who is who: a slat opens with the partner highlighted", async ({ page }) => {
  await open(page);
  await scrollTo(page, "#who-title", 60);
  const guinevere = page.locator("button[aria-controls=who-guinevere]");
  await guinevere.click();
  await expect(guinevere).toHaveAttribute("aria-expanded", "true");
  const link = page.getByRole("link", { name: "Meet Guinevere" });
  await expect(link).toHaveAttribute("href", /character\/guinevere\/$/);
  await expect(page.locator("li[data-partner=true]")).toHaveCount(1);
  await page.locator("button[aria-controls=who-selena]").click();
  await expect(page.locator("li[data-partner=true]")).toHaveCount(0);
});

test("open questions: seals break and show the story's own text", async ({ page }) => {
  await open(page);
  await scrollTo(page, "#open-title", 60);
  const seal = page.locator("button[aria-controls=open-answer-1]");
  await expect(seal).toHaveAttribute("aria-expanded", "false");
  await seal.click();
  await expect(seal).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#open-answer-1")).toContainText(
    "The Will took it back into its own dark void. Nobody knows where it is.",
  );
});

test("glossary: search and filters narrow the list and announce the count", async ({ page }) => {
  await open(page);
  await scrollTo(page, "#words-title", 60);
  const status = page.getByRole("status").filter({ hasText: "entries" });
  const total = (await status.textContent()) ?? "";
  await page.getByRole("searchbox", { name: "Search the glossary" }).fill("ember");
  await expect(status).toContainText(/of \d+ entries/);
  await expect(page.getByRole("heading", { level: 3, name: "Embers" })).toBeVisible();
  await page.getByRole("searchbox", { name: "Search the glossary" }).fill("");
  await expect(status).toHaveText(total);
  await page.getByRole("button", { name: "Places" }).click();
  await expect(page.getByRole("button", { name: "Places" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(status).toContainText(/of \d+ entries/);
});

test("ends with one Next footer to the characters", async ({ page }) => {
  await open(page);
  await expect(page.getByRole("heading", { level: 2, name: "Next: The ten" })).toBeAttached();
  await expect(page.getByRole("button", { name: "Continue to The ten" })).toBeAttached();
  await expect(page.getByRole("heading", { level: 2, name: /^Next:/ })).toHaveCount(1);
});

test("reduced motion: content and controls still work", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = await open(page);
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  await scrollTo(page, '[data-track="dawnbreak-978"]', 0);
  const stage = page.locator('[data-track="dawnbreak-978"] [role=group]');
  await expect.poll(async () => stage.getAttribute("data-phase")).toBe("after");
  await page.locator('[data-track="dawnbreak-978"] input[type=range]').focus();
  await page.keyboard.press("Home");
  await expect.poll(async () => stage.getAttribute("data-phase")).toBe("before");
  expect(errors).toEqual([]);
});

test("no serious accessibility violations", async ({ page }) => {
  await open(page);
  // Open one of each revealable thing so its hidden content is checked too.
  await scrollTo(page, "#open-title", 60);
  await page.locator("button[aria-controls=open-answer-0]").click();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  const serious = results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => ({ id: v.id, help: v.help, nodes: v.nodes.map((n) => n.target.join(" ")) }));
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
});
