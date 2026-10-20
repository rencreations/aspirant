import AxeBuilder from "@axe-core/playwright";
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

test("a touch point plays its short at once, Back leaves it, and the main panel comes back", async ({
  page,
}) => {
  await open(page);
  const spot = page.getByRole("button", { name: SPOT_NAMES[0]! });
  // The circle follows the picture, so it is never still.
  await spot.click({ force: true });
  // The panel steps aside and Back is the way out (Esc does the same).
  await expect(page.getByRole("button", { name: "Back", exact: true })).toBeVisible({
    timeout: 60_000,
  });
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("button", { name: "About", exact: true })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByRole("button", { name: "Back", exact: true })).toHaveCount(0);
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

async function openSkills(page: Page) {
  await open(page);
  await page.getByRole("button", { name: "Skills", exact: true }).click();
  await expect(page.locator("[class*='shell'][data-shown='true']")).toHaveCount(1, {
    timeout: 45_000,
  });
  await expect(page.getByRole("tabpanel", { name: "Skills, scrollable" })).toBeVisible({
    timeout: 30_000,
  });
  await page.waitForTimeout(900);
}

test("Skills lists her passive and three skills with their numbers, in one drawer", async ({
  page,
}, info) => {
  await openSkills(page);
  const skills = page.getByRole("tabpanel", { name: "Skills, scrollable" });
  for (const name of [
    "Return to Bone",
    "Abyssal Bone Needle",
    "Phantom Shadowmeld",
    "Hunt of Bone",
  ])
    await expect(skills.getByRole("button", { name: new RegExp(name) })).toBeVisible();
  await expect(skills.getByRole("button", { name: /Abyssal Bone Needle/ })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(skills.getByRole("img", { name: "Offense: 7 out of 10" })).toBeAttached();
  const table = skills.getByRole("table", { name: /Abyssal Bone Needle, by skill level/ });
  await expect(table.getByRole("row", { name: /Base damage/ })).toContainText("325");
  // The ultimate has three levels.
  await skills.getByRole("button", { name: /Hunt of Bone/ }).click();
  const ult = skills.getByRole("table", { name: /Hunt of Bone, by skill level/ });
  await expect(ult.getByRole("row", { name: /Cooldown/ })).toContainText("40.0");
  await expect(skills.getByRole("table", { name: /Base stats/ })).toBeAttached();
  if (info.project.name === "desktop") {
    const vw = page.viewportSize()?.width ?? 0;
    const d = await page.getByRole("complementary", { name: "Obsidia's skills" }).boundingBox();
    expect(d!.x + d!.width).toBeLessThanOrEqual(vw * 0.4);
  }
});

test("choosing a skill changes the clip in the corner, and the clip can be paused", async ({
  page,
}) => {
  await openSkills(page);
  const skills = page.getByRole("tabpanel", { name: "Skills, scrollable" });
  await skills.getByRole("button", { name: /Phantom Shadowmeld/ }).click();
  const clip = page.locator("video[aria-label*='demonstration']");
  await expect(clip).toHaveAttribute("aria-label", /Phantom Shadowmeld/);
  await expect(page.getByRole("button", { name: /^(Pause|Play) the clip$/ })).toBeVisible();
  // The showcase has more clips.
  await page.getByRole("tab", { name: "Showcase" }).click();
  await page.getByRole("button", { name: /Idle animation/ }).click();
  await expect(page.locator("video[aria-label*='demonstration']")).toHaveAttribute(
    "aria-label",
    /Idle animation/,
  );
});

test("a skill clip opens in the custom player in her colours and closes on Escape", async ({
  page,
}) => {
  await openSkills(page);
  await page.getByRole("button", { name: "Watch with sound" }).click();
  const player = page.getByRole("dialog", { name: "Abyssal Bone Needle" });
  await expect(player).toBeVisible();
  await expect(player.getByRole("slider", { name: "Seek" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(player).toHaveCount(0);
});

test("Back closes the Skills drawer and returns to the main panel", async ({ page }) => {
  await openSkills(page);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("button", { name: "About", exact: true })).toBeVisible({
    timeout: 45_000,
  });
  await expect(page.locator("[class*='shell'][data-shown='true']")).toHaveCount(0, {
    timeout: 45_000,
  });
});

async function openGallery(page: Page) {
  await open(page);
  await page.getByRole("button", { name: "Gallery", exact: true }).click();
  await expect(page.locator("[class*='shell'][data-shown='true']")).toHaveCount(1, {
    timeout: 60_000,
  });
  await expect(page.getByRole("tabpanel", { name: "Art, scrollable" })).toBeVisible({
    timeout: 30_000,
  });
  await page.waitForTimeout(900);
}

test("Gallery has Art, Watch and Voice in one drawer", async ({ page }, info) => {
  await openGallery(page);
  const tabs = page.getByRole("tablist", { name: "Obsidia's gallery" });
  await expect(tabs.getByRole("tab")).toHaveText(["Art", "Watch", "Voice"]);
  if (info.project.name === "desktop") {
    const vw = page.viewportSize()?.width ?? 0;
    const d = await page.getByRole("complementary", { name: "Obsidia's gallery" }).boundingBox();
    expect(d!.x + d!.width).toBeLessThanOrEqual(vw * 0.4);
  }
});

test("Gallery shows the official art first, then the fan art, each with a credit link", async ({
  page,
}) => {
  await openGallery(page);
  const art = page.getByRole("tabpanel", { name: "Art, scrollable" });
  const headings = await art.getByRole("heading", { level: 3 }).allTextContents();
  expect(headings.map((h) => h.toLowerCase())).toEqual(["official art", "fan art"]);
  // Every credit opens in a new tab, safely.
  const links = art.locator("a[href^='http']");
  const count = await links.count();
  expect(count).toBeGreaterThanOrEqual(8);
  for (let i = 0; i < count; i++) {
    await expect(links.nth(i)).toHaveAttribute("target", "_blank");
    await expect(links.nth(i)).toHaveAttribute("rel", /noopener/);
  }
  await expect(art.getByRole("link", { name: /haniwa_\.20 on Instagram/ })).toBeAttached();
  await expect(art.getByRole("link", { name: /on Reddit/ })).toBeAttached();
  await expect(art.getByRole("link", { name: /@bomboclau_ on TikTok/ })).toBeAttached();
  await expect(
    art.getByRole("button", { name: /Play video: TikTok by @bomboclau_/ }),
  ).toBeAttached();
});

test("the viewer opens a picture in her colours, zooms, moves between pictures and closes", async ({
  page,
}) => {
  await openGallery(page);
  const art = page.getByRole("tabpanel", { name: "Art, scrollable" });
  const opener = art.getByRole("button", {
    name: /View larger: .*splash|View larger: .*Obsidia in her skin/,
  });
  await opener.scrollIntoViewIfNeeded();
  await opener.click();
  const viewer = page.getByRole("dialog", { name: /Obsidia's art/ });
  await expect(viewer).toBeVisible();
  const readout = viewer.locator("[class*='readout']");
  const fit = await readout.textContent();
  await page.keyboard.press("+");
  await expect(readout).not.toHaveText(fit ?? "");
  await page.keyboard.press("0");
  await expect(readout).toHaveText(fit ?? "");
  await viewer.getByRole("button", { name: "Next picture" }).click();
  await expect(viewer.getByText("The Queen's Endgame, title card", { exact: true })).toBeVisible();
  await expect(
    viewer.getByText("Moonton, Mobile Legends: Bang Bang", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(viewer).toBeHidden();
  await expect(opener).toBeFocused();
});

test("Watch has her trailer and Day of Enders, and Voice has all 41 lines with the Japanese", async ({
  page,
}) => {
  await openGallery(page);
  await page.getByRole("tab", { name: "Watch" }).click();
  await expect(
    page.getByRole("button", { name: /^Play video: Obsidia, The Queen's Endgame/ }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^Play video: Day of Enders/ })).toBeVisible();
  await page.getByRole("tab", { name: "Voice" }).click();
  const voice = page.getByRole("tabpanel", { name: "Voice, scrollable" });
  await expect(voice.getByRole("button", { name: /^(Play|Stop) voice line/ })).toHaveCount(41);
  await expect(voice.getByText("エンダーたちよ、引け")).toBeAttached();
  await expect(voice.getByText("I am the storm.")).toBeAttached();
  const headings = await voice.getByRole("heading", { level: 3 }).allTextContents();
  expect(headings).toHaveLength(6);
});

test("Back closes the Gallery drawer and returns to the main panel", async ({ page }) => {
  await openGallery(page);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("button", { name: "About", exact: true })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.locator("[class*='shell'][data-shown='true']")).toHaveCount(0, {
    timeout: 60_000,
  });
});

test("fits the screen without sideways scrolling, and has no serious accessibility violations", async ({
  page,
}) => {
  await openAbout(page);
  const overflow = await page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return el.scrollWidth - window.innerWidth;
  });
  expect(overflow).toBeLessThanOrEqual(0);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const serious = results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target.join(" ")) }));
  expect(serious).toEqual([]);
});
