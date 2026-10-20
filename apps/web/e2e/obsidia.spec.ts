import { expect, test, type Page } from "@playwright/test";

import { skipGate, url, watchErrors } from "./helpers";

/**
 * Obsidia's page is one picture. The test browser may not decode H.264, so these specs check what
 * does not depend on playback: the interface, the drawers and the layout. The frame maths and the
 * director's state machine have unit tests next to the code.
 */

test.describe.configure({ timeout: 120_000 });

async function open(page: Page, path = "/character/obsidia/") {
  await skipGate(page);
  const errors = watchErrors(page);
  await page.goto(url(path));
  // The welcome animation can be skipped; without a decodable video the page goes straight on.
  const skip = page.getByRole("button", { name: "Skip" });
  await skip.click({ timeout: 4000 }).catch(() => undefined);
  await expect(page.getByRole("button", { name: "About", exact: true })).toBeVisible({
    timeout: 45_000,
  });
  // The buttons slide in; let them settle.
  await page.waitForTimeout(1300);
  return errors;
}

const SPOT_NAMES = [
  "Play the weapon animation",
  "Play the animation of her face",
  "Play the animation of her feet",
];

test("shows the three buttons and the three touch points, with one h1", async ({ page }) => {
  const errors = await open(page);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1, name: "Obsidia" })).toBeAttached();
  for (const name of ["About", "Skills", "Gallery"])
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  for (const name of SPOT_NAMES) await expect(page.getByRole("button", { name })).toBeVisible();
  // The trailer is on her About page, not on the main panel.
  await expect(page.getByRole("button", { name: /Play video: Obsidia, trailer/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Continue to Selena/ })).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("does not scroll", async ({ page }) => {
  await open(page);
  const extra = await page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return el.scrollHeight - window.innerHeight;
  });
  expect(extra).toBeLessThanOrEqual(0);
  await page.mouse.wheel(0, 900);
  await page.keyboard.press("End");
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test("her music is in the nav", async ({ page }) => {
  await open(page);
  const nav = page.getByRole("banner");
  await expect(nav.getByRole("button", { name: "Sound" })).toBeVisible();
  const record = nav.getByRole("button", { name: /Obsidia theme, The Aspirants/ });
  await expect(record).toBeVisible();
  await expect(record).toHaveAttribute("aria-pressed", /true|false/);
});

test("the three buttons sit side by side in the top left", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "The corner layout is the desktop one");
  await open(page);
  const vw = page.viewportSize()?.width ?? 0;
  const vh = page.viewportSize()?.height ?? 0;
  const boxes = [];
  for (const name of ["About", "Skills", "Gallery"]) {
    boxes.push((await page.getByRole("button", { name, exact: true }).boundingBox())!);
  }
  for (const b of boxes) {
    expect(b.y).toBeLessThan(vh * 0.3);
    expect(b.x + b.width).toBeLessThan(vw * 0.5);
  }
  // In one row, in order.
  expect(Math.abs(boxes[0]!.y - boxes[2]!.y)).toBeLessThan(4);
  expect(boxes[0]!.x).toBeLessThan(boxes[1]!.x);
  expect(boxes[1]!.x).toBeLessThan(boxes[2]!.x);
});

test("the buttons can be pressed without errors", async ({ page }) => {
  const errors = await open(page);
  await page.getByRole("button", { name: "Skills", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Skills", exact: true })).toBeVisible({
    timeout: 45_000,
  });
  expect(errors).toEqual([]);
});

test("a touch point plays its short at once and the main panel comes back, with no extra page", async ({
  page,
}) => {
  await open(page);
  const spot = page.getByRole("button", { name: SPOT_NAMES[0]! });
  // The circle follows the picture, so it is never still.
  await spot.click({ force: true });
  await expect(page.getByRole("button", { name: "Back", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "About", exact: true })).toBeVisible({
    timeout: 60_000,
  });
  await expect(spot).toBeVisible();
  await expect(spot).toBeEnabled();
});

test("every touch point stays on screen, on a phone too", async ({ page }) => {
  await open(page);
  const vw = page.viewportSize()?.width ?? 0;
  const vh = page.viewportSize()?.height ?? 0;
  for (const name of SPOT_NAMES) {
    const box = await page.getByRole("button", { name }).boundingBox();
    expect(box).not.toBeNull();
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;
    expect(cx).toBeGreaterThan(0);
    expect(cx).toBeLessThan(vw);
    expect(cy).toBeGreaterThan(0);
    expect(cy).toBeLessThan(vh);
  }
});

test("the cursor snaps to a touch point and shows what it is doing", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "Phones and tablets have no pointer to snap");
  await open(page);
  const cursor = page.locator("[data-overlay='cursor']");
  const spot = page.getByRole("button", { name: SPOT_NAMES[1]! });
  const box = (await spot.boundingBox())!;
  // Close, but not on the centre: the ring still locks on.
  await page.mouse.move(box.x + box.width / 2 + 24, box.y + box.height / 2 + 20, { steps: 6 });
  await expect(cursor).toHaveAttribute("data-state", "snap");
  await page.mouse.down();
  await expect(cursor).toHaveAttribute("data-state", "pressed");
  await page.mouse.up();
  await page.mouse.move(8, box.y + box.height / 2, { steps: 6 });
  await expect(cursor).toHaveAttribute("data-state", /idle|hover/);
});

test("each page has its own address, and the address opens the page", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Skills", exact: true }).click();
  await expect(page).toHaveURL(/\/character\/obsidia\/skills\/$/, { timeout: 45_000 });
  await expect(page.getByRole("button", { name: "Back", exact: true })).toBeVisible({
    timeout: 45_000,
  });
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page).toHaveURL(/\/character\/obsidia\/$/, { timeout: 45_000 });
  // Arriving at a page's address plays that page and skips the welcome.
  await page.goto(url("/character/obsidia/gallery/"));
  await expect(page.getByRole("button", { name: "Back", exact: true })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page).toHaveTitle(/Obsidia, Gallery/);
});

test("Esc leaves the page it opened", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "About", exact: true }).click();
  await expect(page.getByRole("button", { name: "Back", exact: true })).toBeVisible({
    timeout: 45_000,
  });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "About", exact: true })).toBeVisible({
    timeout: 45_000,
  });
});

async function openAbout(page: Page) {
  await open(page);
  await page.getByRole("button", { name: "About", exact: true }).click();
  await expect(page.locator("[class*='shell'][data-shown='true']")).toHaveCount(1, {
    timeout: 45_000,
  });
  await expect(page.getByRole("tabpanel", { name: "Details, scrollable" })).toBeVisible({
    timeout: 30_000,
  });
  await page.waitForTimeout(900);
}

const isNarrow = (info: { project: { name: string } }) => info.project.name !== "desktop";

test("About opens one drawer on the left with Details and Story, and her trailer in the corner", async ({
  page,
}, info) => {
  await openAbout(page);
  const tabs = page.getByRole("tablist", { name: "About Obsidia" });
  await expect(tabs.getByRole("tab", { name: "Details" })).toHaveAttribute("aria-selected", "true");
  await expect(tabs.getByRole("tab", { name: "Story" })).toHaveAttribute("aria-selected", "false");
  const details = page.getByRole("tabpanel", { name: "Details, scrollable" });
  expect(await details.evaluate((el) => el.scrollHeight > el.clientHeight + 200)).toBe(true);
  await expect(page.getByRole("button", { name: /Play video: Obsidia, The Queen/ })).toBeVisible();
  const vw = page.viewportSize()?.width ?? 0;
  const drawer = await page.getByRole("complementary", { name: "About Obsidia" }).boundingBox();
  const card = await page.getByRole("button", { name: /Play video/ }).boundingBox();
  if (!isNarrow(info)) {
    // The drawer takes at most 40 percent, so she stays in view on the right, and there is no
    // second drawer.
    expect(drawer!.x + drawer!.width).toBeLessThanOrEqual(vw * 0.4);
    await expect(page.getByRole("complementary")).toHaveCount(1);
    // The trailer is small and sits in the bottom right.
    expect(card!.x).toBeGreaterThan(vw * 0.6);
    expect(card!.width).toBeLessThan(vw * 0.25);
  }
});

test("the details list the facts, her profile picture and her voice", async ({ page }) => {
  await openAbout(page);
  const details = page.getByRole("tabpanel", { name: "Details, scrollable" });
  for (const label of ["Age", "Birthday", "MBTI", "Occupation", "Species"])
    await expect(details.getByText(label, { exact: true })).toBeVisible();
  await expect(details.getByText("November 13")).toBeVisible();
  await expect(details.getByText("INTJ")).toBeVisible();
  await expect(details.getByText("アイーダ")).toBeVisible();
  await expect(details.getByRole("img", { name: /Imperatrix Arashi/ })).toBeAttached();
  for (const n of [1, 30, 41])
    await expect(
      details.getByRole("button", { name: new RegExp(`Play voice line ${n}:`) }),
    ).toBeAttached();
});

test("the story is told by her, with tooltips, pictures and voice lines you can press", async ({
  page,
}) => {
  await openAbout(page);
  await page.getByRole("tab", { name: "Story" }).click();
  const story = page.getByRole("tabpanel", { name: "Story, scrollable" });
  await expect(story).toBeVisible();
  await expect(
    story.getByRole("heading", { level: 3, name: "I woke without a name" }),
  ).toBeAttached();
  expect(await story.getByRole("img").count()).toBeGreaterThanOrEqual(12);
  expect(
    await story.getByRole("button", { name: /Play voice line/ }).count(),
  ).toBeGreaterThanOrEqual(30);
  // A name opens a tooltip.
  const name = story.getByRole("button", { name: "Matrix" }).first();
  await name.evaluate((el) => {
    el.scrollIntoView({ block: "center" });
  });
  await name.click();
  await expect(page.getByRole("dialog").first()).toBeVisible();
  await page.keyboard.press("Escape");
  // A voice line toggles.
  const voice = story.getByRole("button", { name: /Play voice line 41:/ });
  await voice.evaluate((el) => {
    el.scrollIntoView({ block: "center" });
  });
  await voice.click();
  await expect(story.getByRole("button", { name: /voice line 41:/ })).toHaveAttribute(
    "aria-pressed",
    /true|false/,
  );
});

test("the story's index jumps to a section", async ({ page }) => {
  await openAbout(page);
  await page.getByRole("tab", { name: "Story" }).click();
  const story = page.getByRole("tabpanel", { name: "Story, scrollable" });
  const before = await story.evaluate((el) => el.scrollTop);
  await story
    .getByRole("navigation", { name: "Story sections" })
    .getByRole("button", { name: "12" })
    .click();
  await expect.poll(() => story.evaluate((el) => el.scrollTop)).toBeGreaterThan(before + 1000);
});

test("the drawer folds away and comes back", async ({ page }, info) => {
  test.skip(isNarrow(info), "The drawer folds on wide screens only");
  await openAbout(page);
  const drawer = page.getByRole("complementary", { name: "About Obsidia" });
  await page.waitForTimeout(1000);
  const before = await drawer.boundingBox();
  await drawer.getByRole("button", { name: /^Hide/ }).click();
  await expect.poll(async () => (await drawer.boundingBox())!.x).toBeLessThan(before!.x - 200);
  await drawer.getByRole("button", { name: /^Show/ }).click();
  await expect
    .poll(async () => Math.abs((await drawer.boundingBox())!.x - before!.x))
    .toBeLessThan(4);
});

test("the trailer opens the player in her colours, and Escape closes it and gives focus back", async ({
  page,
}) => {
  await openAbout(page);
  const card = page.getByRole("button", { name: /Play video: Obsidia, The Queen/ });
  await card.click();
  const player = page.getByRole("dialog", { name: /The Queen's Endgame/ });
  await expect(player).toBeVisible();
  await expect(player.getByRole("slider", { name: "Seek" })).toBeVisible();
  await expect(player.getByRole("button", { name: /^Quality/ })).toBeVisible();
  // Her colours: the keyline is gold, not the site's orange.
  expect(await player.evaluate((el) => getComputedStyle(el).getPropertyValue("--orange"))).toBe(
    "#e2b04a",
  );
  await page.keyboard.press("Escape");
  await expect(player).toHaveCount(0);
  await expect(card).toBeFocused();
});

test("Back closes the drawer and returns to the main panel", async ({ page }) => {
  await openAbout(page);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("button", { name: "About", exact: true })).toBeVisible({
    timeout: 45_000,
  });
  // The drawer stays built, off screen and inert, ready for the next visit.
  await expect(page.locator("[class*='shell'][data-shown='true']")).toHaveCount(0, {
    timeout: 45_000,
  });
});
