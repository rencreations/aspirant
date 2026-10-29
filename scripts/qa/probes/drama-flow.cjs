// Plays the interactive drama (section 06 of Vexana's and Guinevere's pages) with a saved game
// in progress: the level select with the keys, Play from here, the answers, Continue after a
// reload. Prints what is on screen after each step. The e2e spec `e2e/drama.spec.ts` holds the
// assertions; this is for looking.
//
//   node scripts/qa/probes/drama-flow.cjs
const { BASE, launch, context } = require("./lib.cjs");

const SAVE = {
  version: 1,
  unlocked: ["2A", "3A", "4A", "5A", "6A", "2B", "3B"],
  crossed: ["1:0", "2A:0", "3A:0", "4A:0", "5A:0", "1:1", "2B:0"],
  endings: ["6A"],
  run: {
    node: "3B",
    at: 12.5,
    route: [
      { from: "1", choice: 1 },
      { from: "2B", choice: 0 },
    ],
    finished: false,
  },
};

const state = (page) =>
  page.evaluate(() => {
    const g = document.querySelector("#drama");
    return {
      film: [...g.querySelectorAll("video")]
        .filter((v) => v.currentSrc)
        .map((v) => [Number(v.currentTime.toFixed(1)), v.paused]),
      answers: g.querySelectorAll('[aria-label="Choose your answer"] button').length,
      ending: Boolean(g.querySelector('[aria-label="After the ending"]')),
      levels: Boolean(g.querySelector('[aria-label="Level select"]')),
      title: Boolean(g.querySelector('[aria-label="Main menu"]')),
      focus: (
        document.activeElement?.getAttribute("aria-label") ||
        document.activeElement?.innerText ||
        ""
      ).slice(0, 30),
    };
  });

(async () => {
  const browser = await launch();
  const ctx = await context(browser, { viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript((save) => {
    if (!localStorage.getItem("aspirants:drama:v1")) {
      localStorage.setItem("aspirants:drama:v1", JSON.stringify(save));
    }
  }, SAVE);
  const page = await ctx.newPage();
  const say = async (label) => console.log(label.padEnd(24), JSON.stringify(await state(page)));
  await page.goto(BASE + "/character/vexana/", { waitUntil: "load" });
  await page.waitForSelector("#drama", { state: "attached" });
  await page.evaluate(() => document.getElementById("drama").scrollIntoView({ block: "center" }));
  await page.waitForTimeout(1200);
  const drama = page.locator("#drama");
  await drama.getByRole("button", { name: /level select/i }).click();
  await page.waitForTimeout(500);
  await say("level select open");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(2500);
  await say("played from a card");
  for (let i = 0; i < 14; i += 1) {
    await page.keyboard.press("Space");
    await page.waitForTimeout(250);
  }
  await say("at the answers");
  await page.reload({ waitUntil: "load" });
  await page.evaluate(() => document.getElementById("drama").scrollIntoView({ block: "center" }));
  await page.waitForTimeout(1500);
  await drama.getByRole("button", { name: /continue/i }).click();
  await page.waitForTimeout(3500);
  await say("continue after reload");
  await browser.close();
})();
