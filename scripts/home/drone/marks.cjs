// The icons of the home page's dialogue bubble: one small atlas of six drawings with a clear ground.
//
//   node scripts/home/drone/marks.cjs [--out DIR]
//
// Writes apps/web/public/img/home/marks.webp (3 by 2 cells of 192 px) and marks.json (the cells).
// The shapes of the heart, the sparkle, the bang and the question mark are the page's own comic marks
// (apps/web/src/features/about/companions/fx.ts); the drawing is flat colour with the drone's ink
// line (#1f2735). The bubble itself is drawn by the page: these are the icons that stand in it.
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");

const REPO = path.resolve(__dirname, "../../..");
const root = createRequire(path.join(REPO, "package.json"));
const sharp = root("sharp");

const INK = "#1f2735";
const PINK = "#f0409a";
const GOLD = "#f2b01e";
const CYAN = "#23d0d8";
const CREAM = "#ffe6cc";
const CELL = 192;
const LINE = 7;

const outline = (extra = "") =>
  `stroke="${INK}" stroke-width="${LINE}" stroke-linejoin="round" stroke-linecap="round" ${extra}`;
const at = (x, y, s, turn = 0) => `translate(${x} ${y}) rotate(${turn}) scale(${s})`;

/** An outlined shape drawn in a small box and scaled up: the line is kept at LINE units. */
const shape = (d, color, x, y, scale, extra = "") =>
  `<path d="${d}" fill="${color}" stroke="${INK}" stroke-width="${(LINE / scale).toFixed(3)}" stroke-linejoin="round" stroke-linecap="round" transform="${at(x, y, scale)}" ${extra}/>`;

const HEART = "M0 13C-16 2-14-12-6-12-2-12 0-9 0-6 0-9 2-12 6-12 14-12 16 2 0 13z";
const SPARK = "M0-16C1.6-4 4-1.6 16 0 4 1.6 1.6 4 0 16-1.6 4-4 1.6-16 0-4-1.6-1.6-4 0-16z";

/** Each drawing is in a box of 192 units with its middle at (96, 96). */
const ICONS = {
  heart: `
    ${shape(HEART, PINK, 96, 98, 4.6)}
    <path d="M66 74 Q74 62 88 66" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity="0.85"/>`,
  sparkle: `
    ${shape(SPARK, GOLD, 92, 102, 4.3)}
    ${shape(SPARK, GOLD, 152, 46, 1.9)}
    ${shape(SPARK, GOLD, 40, 148, 1.5)}`,
  // Two cupped hands holding up a heart: thanks. The bowl is the pair of hands (the seam is where
  // they meet), a cuff at each wrist, the heart rising out of them.
  thanks: `
    ${shape(HEART, PINK, 96, 84, 3.1)}
    <path d="M78 64 Q84 56 94 58" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity="0.85"/>
    <path d="M22 104 C28 148 62 164 96 164 C130 164 164 148 170 104 C152 124 126 134 96 134 C66 134 40 124 22 104 Z" fill="${CREAM}" ${outline()}/>
    <path d="M96 136 V162" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round" opacity="0.7"/>
    <rect x="8" y="88" width="30" height="22" rx="6" fill="${PINK}" ${outline()} transform="rotate(-32 23 99)"/>
    <rect x="154" y="88" width="30" height="22" rx="6" fill="${PINK}" ${outline()} transform="rotate(32 169 99)"/>
    <path d="M50 56 L38 44 M142 56 L154 44 M96 34 V20" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>`,
  smile: `
    <circle cx="96" cy="96" r="66" fill="${GOLD}" ${outline()}/>
    <ellipse cx="72" cy="84" rx="8" ry="12" fill="${INK}"/><ellipse cx="120" cy="84" rx="8" ry="12" fill="${INK}"/>
    <path d="M66 112 Q96 144 126 112" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>
    <path d="M56 62 Q66 48 80 46" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity="0.8"/>`,
  bang: `
    ${shape("M-3.4-17h7.4l-2 21h-3.6z", PINK, 96, 100, 4.4)}
    ${shape("M-3.5 0a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0z", PINK, 96, 150, 4.6)}`,
  question: `
    <g transform="${at(96, 96, 4.1)}" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="M-8-8.5C-8-14-4-17 0.5-17 5.5-17 9-13.8 9-9.2 9-5.6 6.8-3.8 4.6-2.2 2.9-1 2.2 0 2.2 2.6V4" stroke="${INK}" stroke-width="${(7 + (2 * LINE) / 4.1).toFixed(2)}"/>
      <path d="M-8-8.5C-8-14-4-17 0.5-17 5.5-17 9-13.8 9-9.2 9-5.6 6.8-3.8 4.6-2.2 2.9-1 2.2 0 2.2 2.6V4" stroke="${CYAN}" stroke-width="5"/>
    </g>
    ${shape("M-3.4 0a3.4 3.4 0 1 0 6.8 0a3.4 3.4 0 1 0 -6.8 0z", CYAN, 98, 150, 4.6)}`,
};

function option(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

async function main() {
  const out = path.resolve(option("out", path.join(REPO, "apps/web/public/img/home")));
  fs.mkdirSync(out, { recursive: true });
  const names = Object.keys(ICONS);
  const cols = 3;
  const rows = Math.ceil(names.length / cols);
  const scale = 2;
  const body = names
    .map(
      (name, i) =>
        `<g transform="translate(${(i % cols) * CELL} ${Math.floor(i / cols) * CELL})">${ICONS[name]}</g>`,
    )
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * CELL * scale}" height="${rows * CELL * scale}" viewBox="0 0 ${cols * CELL} ${rows * CELL}">${body}</svg>`;
  const png = await sharp(Buffer.from(svg))
    .resize(cols * CELL, rows * CELL, { kernel: "lanczos3" })
    .png()
    .toBuffer();
  await sharp(png)
    .webp({ quality: 92, alphaQuality: 100, effort: 6 })
    .toFile(path.join(out, "marks.webp"));
  const json = {
    file: "marks.webp",
    width: cols * CELL,
    height: rows * CELL,
    cell: CELL,
    bytes: fs.statSync(path.join(out, "marks.webp")).size,
    ink: INK,
    note: "icons only, a clear ground; the bubble is drawn by the page. u and v are from the top left.",
    icons: Object.fromEntries(
      names.map((name, i) => {
        const x = (i % cols) * CELL;
        const y = Math.floor(i / cols) * CELL;
        return [
          name,
          {
            x,
            y,
            width: CELL,
            height: CELL,
            u: x / (cols * CELL),
            v: y / (rows * CELL),
            du: 1 / cols,
            dv: 1 / rows,
          },
        ];
      }),
    ),
  };
  fs.writeFileSync(path.join(out, "marks.json"), `${JSON.stringify(json, null, 2)}\n`);
  console.log(json.bytes, "bytes", names.join(","));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
