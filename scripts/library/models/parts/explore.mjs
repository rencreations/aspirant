// The candidate parts of a static source, for deciding how to cut it (see README).
//
//   node explore.mjs <source> <out.png> [--only <regexp>] [--min <tris>] [--max <n>] [--whole]
import { openPage } from "./chrome.mjs";

const [file, out] = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? fallback : process.argv[i + 1];
};
const { page, close } = await openPage({ width: 1900, height: 600 });
try {
  await page.evaluate(
    ([file, opts]) => window.explore(file, opts),
    [
      file,
      {
        only: arg("only"),
        minTris: Number(arg("min", 1)),
        max: Number(arg("max", 80)),
        islands: !process.argv.includes("--whole"),
        within: arg("within") ? arg("within").split(",").map(Number) : undefined,
      },
    ],
  );
  await page.screenshot({ path: out, fullPage: true });
} finally {
  await close();
}
