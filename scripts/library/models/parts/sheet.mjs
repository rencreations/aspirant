// Contact sheets: draws model files in real Chrome with the site's own three and saves one page.
//
//   node sheet.mjs <job.json>
//
// A job is { "out": "<png>", "title": "...", "rows": [ { "label", "file", "views": ["front",
// "threeq", "side", "back"], "refs": ["<png>"], "focus": { "center": [x, y, z], "size": s },
// "hide": ["<regexp on a mesh or material name>"], "morph": "<target>" } ] }.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openPage } from "./chrome.mjs";

export async function makeSheet(job, opened) {
  const { page, close } = opened ?? (await openPage());
  const results = [];
  try {
    await page.evaluate(() => (document.getElementById("rows").innerHTML = ""));
    await page.evaluate((t) => (document.getElementById("title").textContent = t), job.title ?? "");
    for (const row of job.rows) {
      const info = await page.evaluate((r) => window.renderRow(r), row);
      results.push({ label: row.label, ...info });
      console.log(
        `${row.label}: size ${info.size.join(" x ")}, centre ${info.center.join(", ")}, min ${info.min.join(", ")}`,
      );
      if (job.verbose) for (const m of info.meshes) console.log("   ", m);
    }
    fs.mkdirSync(path.dirname(job.out), { recursive: true });
    await page.screenshot({ path: job.out, fullPage: true });
  } finally {
    if (!opened) await close();
  }
  return results;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await makeSheet(JSON.parse(fs.readFileSync(process.argv[2], "utf8")));
}
