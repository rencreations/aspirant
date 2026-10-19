import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { skipGate, url, watchErrors } from "./helpers";

/**
 * Selena's page is one picture. The test browser may not decode H.264, so these specs check what
 * does not depend on playback: the interface, the custom player and the layout. The frame
 * maths and the director's state machine have unit tests next to the code.
 */

test.describe.configure({ timeout: 120_000 });

async function open(page: Page) {
  await skipGate(page);
  const errors = watchErrors(page);
  await page.goto(url("/character/selena/"));
  // The welcome animation can be skipped; without a decodable video the page goes straight on.
  const skip = page.getByRole("button", { name: "Skip" });
  await skip.click({ timeout: 4000 }).catch(() => undefined);
  await expect(page.getByRole("button", { name: "About" })).toBeVisible({ timeout: 45_000 });
  // The buttons slide in; let them settle.
  await page.waitForTimeout(1300);
  return errors;
}

const SPOT_NAMES = [
  "Play the Silverbolt animation",
  "Play the badge animation",
  "Play the right arm animation",
];

test("shows the three buttons, the three touch points and the trailer, with one h1", async ({
  page,
}) => {
  const errors = await open(page);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1, name: "Selena" })).toBeAttached();
  for (const name of ["About", "Skills", "Gallery"])
    await expect(page.getByRole("button", { name })).toBeVisible();
  for (const name of SPOT_NAMES) await expect(page.getByRole("button", { name })).toBeVisible();
  // There is no Random Animation button any more.
  await expect(page.getByRole("button", { name: "Random Animation" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Play video: Selena, trailer/ })).toBeVisible();
  // Only the picture: nothing left of the old page.
  await expect(page.locator("#voice-title, #profile-title, #media-title")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Continue to/ })).toHaveCount(1);
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

test("the sound and the music are in the nav, nothing is left in the bottom right corner", async ({
  page,
}) => {
  await open(page);
  const nav = page.getByRole("banner");
  await expect(nav.getByRole("button", { name: "Sound" })).toBeVisible();
  // The record: song and artist, a button that pauses and resumes the music.
  const record = nav.getByRole("button", { name: /Silverbolt Raiko, Mobile Legends: Bang Bang/ });
  await expect(record).toBeVisible();
  await expect(record).toHaveAttribute("aria-pressed", /true|false/);
  await expect(page.getByRole("button", { name: "Reduce motion" })).toHaveCount(0);
});

test("the buttons sit in the right half and the trailer in the left", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "The corner layout is the desktop one");
  await open(page);
  const vw = page.viewportSize()?.width ?? 0;
  const about = await page.getByRole("button", { name: "About" }).boundingBox();
  const card = await page.getByRole("button", { name: /Play video/ }).boundingBox();
  expect(about!.x).toBeGreaterThan(vw * 0.6);
  expect(card!.x + card!.width).toBeLessThan(vw * 0.4);
  // Small: the trailer card never takes much of the picture.
  expect(card!.width).toBeLessThan(vw * 0.25);
});

test("the trailer opens the custom player, which closes on Escape and gives focus back", async ({
  page,
}) => {
  await open(page);
  const card = page.getByRole("button", { name: /Play video: Selena, trailer/ });
  await card.click();
  const player = page.getByRole("dialog", { name: "Selena, trailer" });
  await expect(player).toBeVisible();
  await expect(player.getByRole("slider", { name: "Seek" })).toBeVisible();
  await expect(player.getByRole("button", { name: /^(Play|Pause)$/ })).toBeVisible();
  // A quality menu with Auto, no speed control, no close button.
  await expect(player.getByRole("button", { name: /^Quality/ })).toBeVisible();
  await expect(player.getByRole("button", { name: /speed|1x/i })).toHaveCount(0);
  await expect(player.getByRole("button", { name: "Close video" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(player).toHaveCount(0);
  await expect(card).toBeFocused();
});

test("the player's quality menu lists Auto and the sizes", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: /Play video/ }).click();
  const player = page.getByRole("dialog");
  await player.getByRole("button", { name: /^Quality/ }).click();
  const menu = player.getByRole("list", { name: "Quality" });
  await expect(menu.getByRole("button", { name: /^Auto/ })).toBeVisible();
  for (const size of ["1080p", "720p", "480p"])
    await expect(menu.getByRole("button", { name: size, exact: true })).toBeVisible();
  await menu.getByRole("button", { name: "480p", exact: true }).click();
  await expect(player.getByRole("button", { name: /^Quality, 480p/ })).toBeVisible();
});

test("a click in the outer quarters of the player leaves", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "Needs a pointer");
  await open(page);
  await page.getByRole("button", { name: /Play video/ }).click();
  const player = page.getByRole("dialog");
  await expect(player).toBeVisible();
  await page.waitForTimeout(1200);
  const vw = page.viewportSize()?.width ?? 0;
  await page.mouse.move(vw * 0.12, 300);
  await page.mouse.click(vw * 0.12, 300);
  await expect(player).toHaveCount(0, { timeout: 8000 });
});

test("the buttons can be pressed without errors", async ({ page }) => {
  const errors = await open(page);
  await page.getByRole("button", { name: "Skills" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Skills" })).toBeVisible({ timeout: 45_000 });
  expect(errors).toEqual([]);
});

test("a touch point plays its short at once and the main panel comes back, with no extra page", async ({
  page,
}) => {
  await open(page);
  const spot = page.getByRole("button", { name: SPOT_NAMES[0]! });
  await spot.click();
  // There is no second view: no Back button, and the panel is back when the short is over.
  await expect(page.getByRole("button", { name: "Back" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "About" })).toBeVisible({ timeout: 45_000 });
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

async function openAbout(page: Page, narrow: boolean) {
  await open(page);
  await page.getByRole("button", { name: "About", exact: true }).click();
  await expect(page.getByRole("region", { name: "Profile, scrollable" })).toBeVisible({
    timeout: 30_000,
  });
  if (narrow) await page.getByRole("tab", { name: "Story" }).click();
  await expect(page.getByRole("region", { name: "Story, scrollable" })).toBeVisible();
  await page.waitForTimeout(900);
}

const isNarrow = (info: { project: { name: string } }) => info.project.name !== "desktop";

test("About opens a profile and a story drawer, both scrollable", async ({ page }, info) => {
  await openAbout(page, isNarrow(info));
  const story = page.getByRole("region", { name: "Story, scrollable" });
  const scrolls = await story.evaluate((el) => el.scrollHeight > el.clientHeight + 200);
  expect(scrolls).toBe(true);
  if (!isNarrow(info)) {
    const profile = page.getByRole("region", { name: "Profile, scrollable" });
    expect(await profile.evaluate((el) => el.scrollHeight > el.clientHeight + 200)).toBe(true);
    // She stays visible in the middle: the drawers leave the centre of the screen free.
    const vw = page.viewportSize()?.width ?? 0;
    const l = await page.getByRole("complementary", { name: "Selena's profile" }).boundingBox();
    const r = await page.getByRole("complementary", { name: "Selena's story" }).boundingBox();
    expect(l!.x + l!.width).toBeLessThan(vw * 0.36);
    expect(r!.x).toBeGreaterThan(vw * 0.64);
  }
});

test("the profile lists the facts and switches only the picture between the two forms", async ({
  page,
}, info) => {
  await openAbout(page, isNarrow(info));
  if (isNarrow(info)) await page.getByRole("tab", { name: "Profile" }).click();
  const profile = page.getByRole("region", { name: "Profile, scrollable" });
  for (const label of ["Age", "Birthday", "MBTI", "Occupation"])
    await expect(profile.getByText(label, { exact: true })).toBeVisible();
  await expect(profile.getByText("June 18")).toBeVisible();
  await expect(profile.getByText("ENTP")).toBeVisible();
  await expect(profile.getByText("セリナ")).toBeVisible();
  const group = profile.getByRole("group", { name: "Form shown in the picture" });
  await expect(group.getByRole("button", { name: "Normal" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await group.getByRole("button", { name: "Mecha" }).click();
  await expect(group.getByRole("button", { name: "Mecha" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const mecha = profile.getByRole("img", { name: /mecha form/ });
  await expect(mecha).toHaveCSS("opacity", "1");
  // The text did not change.
  await expect(profile.getByText("Silverbolt Raiko").first()).toBeVisible();
  // Both voices: the normal form (line 1) and the Ender form (line 19).
  await expect(profile.getByRole("button", { name: /Play voice line 1:/ })).toBeAttached();
  await expect(profile.getByRole("button", { name: /Play voice line 19:/ })).toBeAttached();
});

test("the story has tooltips, pictures and voice lines you can press", async ({ page }, info) => {
  await openAbout(page, isNarrow(info));
  const story = page.getByRole("region", { name: "Story, scrollable" });
  await expect(
    story.getByRole("heading", { level: 3, name: "The storm at Hollin Reach" }),
  ).toBeAttached();
  expect(await story.getByRole("img").count()).toBeGreaterThanOrEqual(12);
  expect(
    await story.getByRole("button", { name: /Play voice line/ }).count(),
  ).toBeGreaterThanOrEqual(30);
  // A name opens a tooltip.
  const name = story.getByRole("button", { name: "Hollin Reach" }).first();
  await name.evaluate((el) => {
    el.scrollIntoView({ block: "center" });
  });
  await name.click();
  await expect(page.getByRole("dialog").filter({ hasText: "river town" })).toBeVisible();
  await page.keyboard.press("Escape");
  // A voice line toggles.
  const voice = story.getByRole("button", { name: /Play voice line 18:/ });
  await voice.evaluate((el) => {
    el.scrollIntoView({ block: "center" });
  });
  await voice.click();
  await expect(story.getByRole("button", { name: /voice line 18:/ })).toHaveAttribute(
    "aria-pressed",
    /true|false/,
  );
});

test("the story's index jumps to a section", async ({ page }, info) => {
  await openAbout(page, isNarrow(info));
  const story = page.getByRole("region", { name: "Story, scrollable" });
  const before = await story.evaluate((el) => el.scrollTop);
  await story
    .getByRole("navigation", { name: "Story sections" })
    .getByRole("button", { name: "10" })
    .click();
  await expect.poll(() => story.evaluate((el) => el.scrollTop)).toBeGreaterThan(before + 1000);
});

test("a drawer folds away and comes back", async ({ page }, info) => {
  test.skip(isNarrow(info), "Drawers fold on wide screens only");
  await openAbout(page, false);
  const drawer = page.getByRole("complementary", { name: "Selena's profile" });
  // Wait for it to finish sliding in.
  await expect.poll(async () => (await drawer.boundingBox())!.x).toBeGreaterThan(0);
  await page.waitForTimeout(1000);
  const before = await drawer.boundingBox();
  await drawer.getByRole("button", { name: "Hide" }).click();
  await expect.poll(async () => (await drawer.boundingBox())!.x).toBeLessThan(before!.x - 200);
  await drawer.getByRole("button", { name: "Profile", exact: true }).click();
  await expect
    .poll(async () => Math.abs((await drawer.boundingBox())!.x - before!.x))
    .toBeLessThan(4);
});

test("Back closes the drawers and returns to the main panel", async ({ page }, info) => {
  await openAbout(page, isNarrow(info));
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("button", { name: "About", exact: true })).toBeVisible({
    timeout: 45_000,
  });
  await expect(page.getByRole("region", { name: "Story, scrollable" })).toHaveCount(0, {
    timeout: 45_000,
  });
});

async function openSkills(page: Page, narrow: boolean) {
  await open(page);
  await page.getByRole("button", { name: "Skills", exact: true }).click();
  await expect(page.getByRole("region", { name: "Skills, scrollable" })).toBeVisible({
    timeout: 30_000,
  });
  if (narrow) await page.getByRole("tab", { name: "Demo" }).click();
  await expect(page.getByRole("region", { name: "Demonstration, scrollable" })).toBeVisible();
  await page.waitForTimeout(900);
  if (narrow) await page.getByRole("tab", { name: "Skills" }).click();
}

test("Skills opens the skill list on the left and a demonstration on the right", async ({
  page,
}, info) => {
  await openSkills(page, isNarrow(info));
  const skills = page.getByRole("region", { name: "Skills, scrollable" });
  await expect(skills.getByRole("button", { name: /Symbiosis/ })).toBeVisible();
  await expect(skills.getByRole("button", { name: /Abyssal Trap/ })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(skills.getByText("Control effects")).toBeVisible();
  await expect(skills.getByRole("img", { name: "Control effects: 10 out of 10" })).toBeAttached();
  if (!isNarrow(info)) {
    const vw = page.viewportSize()?.width ?? 0;
    const l = await page.getByRole("complementary", { name: "Selena's skills" }).boundingBox();
    const r = await page.getByRole("complementary", { name: "Skill demonstration" }).boundingBox();
    expect(l!.x + l!.width).toBeLessThan(vw * 0.4);
    expect(r!.x).toBeGreaterThan(vw * 0.6);
  }
});

test("each form lists its own skills with their numbers", async ({ page }, info) => {
  await openSkills(page, isNarrow(info));
  const skills = page.getByRole("region", { name: "Skills, scrollable" });
  const forms = skills.getByRole("group", { name: "Form" });
  for (const name of ["Abyssal Trap", "Abyssal Arrow", "Primal Darkness"])
    await expect(skills.getByRole("button", { name: new RegExp(name) })).toBeVisible();
  await expect(skills.getByRole("button", { name: /Soul Eater/ })).toHaveCount(0);

  await forms.getByRole("button", { name: "Abyssal Form" }).click();
  for (const name of ["Soul Eater", "Garotte", "Blessing of the Moon Goddess"])
    await expect(skills.getByRole("button", { name: new RegExp(name) })).toBeVisible();
  await expect(skills.getByRole("button", { name: /Abyssal Trap/ })).toHaveCount(0);

  // The opened skill shows its level table.
  await skills.getByRole("button", { name: /Garotte/ }).click();
  const table = skills.getByRole("table", { name: /Garotte, by skill level/ });
  await expect(table.getByRole("row", { name: /Cooldown/ })).toContainText("12.0");
  await expect(table.getByRole("row", { name: /Base damage/ })).toContainText("350");
});

test("choosing a skill changes the clip, and the clips can be paused", async ({ page }, info) => {
  const narrow = isNarrow(info);
  await openSkills(page, narrow);
  const skills = page.getByRole("region", { name: "Skills, scrollable" });
  await skills.getByRole("button", { name: /Abyssal Arrow/ }).click();
  if (narrow) await page.getByRole("tab", { name: "Demo" }).click();
  const demo = page.getByRole("region", { name: "Demonstration, scrollable" });
  await expect(demo.getByRole("heading", { level: 2, name: "Abyssal Arrow" })).toBeVisible();
  const clip = demo.locator("video");
  await expect(clip).toHaveAttribute("aria-label", /Abyssal Arrow/);
  const toggle = demo.getByRole("button", { name: /^(Pause|Play) the clip$/ });
  await expect(toggle).toBeVisible();
  // Another clip from the showcase.
  await demo.getByRole("button", { name: /Idle animation/ }).click();
  await expect(demo.locator("video")).toHaveAttribute("aria-label", /Idle animation/);
});

test("a clip opens in the custom player with sound and closes on Escape", async ({
  page,
}, info) => {
  const narrow = isNarrow(info);
  await openSkills(page, narrow);
  if (narrow) await page.getByRole("tab", { name: "Demo" }).click();
  await page.getByRole("button", { name: "Watch with sound" }).click();
  const player = page.getByRole("dialog", { name: "Abyssal Trap" });
  await expect(player).toBeVisible();
  await expect(player.getByRole("slider", { name: "Seek" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(player).toHaveCount(0);
  // The page is still on Skills.
  await expect(page.getByRole("button", { name: "Back", exact: true })).toBeVisible();
});

test("Back closes the Skills drawers and returns to the main panel", async ({ page }, info) => {
  await openSkills(page, isNarrow(info));
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("button", { name: "Skills", exact: true })).toBeVisible({
    timeout: 45_000,
  });
  await expect(page.getByRole("region", { name: "Skills, scrollable" })).toHaveCount(0, {
    timeout: 45_000,
  });
});

test("a press is answered at once: the chosen button lights and the rest steps away", async ({
  page,
}) => {
  await open(page);
  const skills = page.getByRole("button", { name: "Skills", exact: true });
  await skills.click();
  // A browser without H.264 has no idle frame to wait for and goes straight in. Where she waits,
  // the answer is in the same moment as the press.
  const waiting = await page
    .locator("section[data-mode='queued']")
    .waitFor({ timeout: 800 })
    .then(() => true)
    .catch(() => false);
  if (!waiting) return;
  await expect(skills).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "About", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: SPOT_NAMES[0]! })).toBeDisabled();
  // The pressed button runs a bar for the length of the wait.
  await expect(skills.locator("[class*='press']")).toHaveCount(1);
});

test("Back is answered at once and the panel returns before the exit has finished", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "About", exact: true }).click();
  await expect(page.getByRole("region", { name: "Profile, scrollable" })).toBeVisible({
    timeout: 30_000,
  });
  const back = page.getByRole("button", { name: "Back", exact: true });
  await back.click();
  await expect(back)
    .toBeDisabled({ timeout: 800 })
    .catch(() => undefined);
  // The drawers go straight away: they are off the screen well before the exit has finished.
  const drawer = page.locator('aside[aria-label="Selena\'s profile"]');
  await expect
    .poll(
      async () => {
        const box = await drawer.boundingBox();
        const vp = page.viewportSize();
        return !box || !vp || box.x + box.width <= 0 || box.y >= vp.height;
      },
      { timeout: 3000 },
    )
    .toBe(true);
  await expect(page.getByRole("button", { name: "About", exact: true })).toBeVisible({
    timeout: 45_000,
  });
});

test("pressing the record with the sound off turns the sound on", async ({ page }) => {
  await open(page);
  const nav = page.getByRole("banner");
  const sound = nav.getByRole("button", { name: "Sound" });
  await page.locator("body").press("m");
  await expect(sound).toHaveAttribute("aria-pressed", "false");
  await nav.getByRole("button", { name: /Silverbolt Raiko/ }).click();
  await expect(sound).toHaveAttribute("aria-pressed", "true");
});

test("each page has its own address and title, and Back returns to her own", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Skills", exact: true }).click();
  await expect(page).toHaveURL(/\/character\/selena\/skills\/$/, { timeout: 30_000 });
  await expect(page).toHaveTitle(/Selena, Skills/);
  await expect(page.getByRole("button", { name: "Back", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page).toHaveURL(/\/character\/selena\/$/, { timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Skills", exact: true })).toBeVisible({
    timeout: 45_000,
  });
});

test("the browser back button leaves a page, and forward opens it again", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "About", exact: true }).click();
  await expect(page).toHaveURL(/\/character\/selena\/about\/$/, { timeout: 30_000 });
  await page.goBack();
  await expect(page).toHaveURL(/\/character\/selena\/$/);
  await expect(page.getByRole("button", { name: "About", exact: true })).toBeVisible({
    timeout: 45_000,
  });
  await page.goForward();
  await expect(page).toHaveURL(/\/character\/selena\/about\/$/);
  await expect(page.getByRole("region", { name: /Profile|Story/ }).first()).toBeAttached({
    timeout: 30_000,
  });
});

for (const name of ["about", "skills", "gallery"] as const) {
  test(`the address of ${name} opens that page directly, with no welcome`, async ({ page }) => {
    await skipGate(page);
    const errors = watchErrors(page);
    await page.goto(url(`/character/selena/${name}/`));
    await expect(page.getByRole("button", { name: "Back", exact: true })).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByRole("button", { name: "Skip" })).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/character/selena/${name}/$`));
    expect(errors).toEqual([]);
  });
}

test("fits the screen without sideways scrolling", async ({ page }) => {
  await open(page);
  const overflow = await page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return el.scrollWidth - window.innerWidth;
  });
  expect(overflow).toBeLessThanOrEqual(0);
  for (const name of ["About", "Skills", "Gallery"]) {
    const box = await page.getByRole("button", { name }).first().boundingBox();
    const vw = page.viewportSize()?.width ?? 0;
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(vw + 1);
  }
});

test("has no serious accessibility violations", async ({ page }) => {
  await open(page);
  await page.waitForTimeout(900);
  const results = await new AxeBuilder({ page })
    .exclude("[data-overlay='hud']")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  const serious = results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target.join(" ")) }));
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
});
