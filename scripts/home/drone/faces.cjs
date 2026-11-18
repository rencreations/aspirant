// The faces of the normal drone for the home page, drawn as two more atlases like its own.
//
// The shipped drone (apps/web/public/models/about/drone.glb, shared with /about, never changed) has
// a face atlas of nine drawings in a 3 by 3 grid that the screen's shader picks a cell from. All
// nine are used. The home needs more, so this draws two pages of nine in the same grid, the same
// ground (#0a121a), the same cyan (#23d0d8) and the same chunky, rounded strokes. The page swaps
// the face texture of the drone's screen for one of them and the shader is not touched: the cell
// is picked with `uCell` exactly as for the first atlas.
//
//   node scripts/home/drone/faces.cjs [--out DIR] [--size 1024]
//
// Writes into apps/web/public/img/home/: drone-faces.webp (page A), drone-faces-2.webp (page B) and
// drone-faces.json (every face: its page, its place, its `uCell`). The drawings are SVG, rendered
// by sharp, laid out upright and then flipped top to bottom, because the drone's own atlas is
// stored upside down (the FBX had v up and the build flipped the picture): what is drawn upright
// here shows upright on the drone. README.md has the numbers and the check.
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");

const REPO = path.resolve(__dirname, "../../..");
const root = createRequire(path.join(REPO, "package.json"));
const sharp = root("sharp");

const GROUND = "#0a121a";
const CYAN = "#23d0d8";
const C = CYAN;

/** Where the eyes of the plain face sit in a cell of 100 units, upright: measured on the shipped atlas. */
const EYE = { left: 36, right: 64, y: 44 };

const stroke = (w, extra = "") =>
  `fill="none" stroke="${C}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}`;
const fill = (extra = "") => `fill="${C}" ${extra}`;

/** The paths of the page's own comic marks (apps/web/src/features/about/companions/fx.ts), 40 units wide. */
const MARK = {
  heart: "M0 13C-16 2-14-12-6-12-2-12 0-9 0-6 0-9 2-12 6-12 14-12 16 2 0 13z",
  spark: "M0-16C1.6-4 4-1.6 16 0 4 1.6 1.6 4 0 16-1.6 4-4 1.6-16 0-4-1.6-1.6-4 0-16z",
  drop: "M0-14C6-5 8 1 8 5.5a8 8 0 0 1-16 0C-8 1-6-5 0-14z",
  ask: "M-8-8.5C-8-14-4-17 0.5-17 5.5-17 9-13.8 9-9.2 9-5.6 6.8-3.8 4.6-2.2 2.9-1 2.2 0 2.2 2.6V4",
};

const at = (x, y, scale = 1, turn = 0) => `translate(${x} ${y}) rotate(${turn}) scale(${scale})`;
const oval = (cx, cy, rx, ry, turn = 0) =>
  `<ellipse ${fill(`transform="rotate(${turn} ${cx} ${cy})"`)} cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/>`;
const heart = (x, y, s, turn = 0) =>
  `<path ${fill(`transform="${at(x, y, s, turn)}"`)} d="${MARK.heart}"/>`;
const spark = (x, y, s, turn = 0) =>
  `<path ${fill(`transform="${at(x, y, s, turn)}"`)} d="${MARK.spark}"/>`;
const drop = (x, y, s) => `<path ${fill(`transform="${at(x, y, s)}"`)} d="${MARK.drop}"/>`;

/** An arithmetic spiral from the middle out, `turns` turns, `reach` units, `dir` +1 or -1. */
function spiral(cx, cy, reach, turns, dir) {
  const points = [];
  const steps = 90;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = dir * t * turns * Math.PI * 2 + (dir > 0 ? 0 : Math.PI);
    const r = reach * t;
    points.push(`${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return `<path ${stroke(3.6)} d="M${points.join(" L")}"/>`;
}

/** An eighth note, its head at the bottom. */
function note(x, y, s = 1) {
  return `<g transform="${at(x, y, s)}">
    <ellipse ${fill()} cx="-4" cy="13" rx="7.5" ry="5.6" transform="rotate(-22 -4 13)"/>
    <path ${stroke(4.4)} d="M2.6 11 V-14"/>
    <path ${fill()} d="M2.6 -16 C10 -12 15 -8 14 0 C11 -6 7 -7 2.6 -7 Z"/>
  </g>`;
}

/** What the home needs and the shipped nine do not. Upright, in a cell of 100 by 100 units. */
const PAGE_A = {
  shocked: `
    <g ${stroke(4.4)}><circle cx="${EYE.left}" cy="42" r="13.5"/><circle cx="${EYE.right}" cy="42" r="13.5"/></g>
    <circle ${fill()} cx="${EYE.left}" cy="42" r="4.6"/><circle ${fill()} cx="${EYE.right}" cy="42" r="4.6"/>
    <ellipse ${stroke(3.6)} cx="50" cy="72" rx="4.6" ry="6"/>`,
  confused: `
    ${oval(EYE.left, 42, 8.6, 19, -6)}
    ${oval(EYE.right + 1, 48, 5.8, 11.5)}
    <path ${stroke(3.6)} d="M55 26 L74 29"/>
    <path ${stroke(3.6)} d="M33 74 q4.2 -5.4 8.4 0 t8.4 0 t8.4 0 t8.4 0"/>`,
  thanks: `
    <path ${stroke(6.2)} d="M26 49 Q36 31 46 49"/><path ${stroke(6.2)} d="M54 49 Q64 31 74 49"/>
    <path ${stroke(3.8)} d="M41 66 Q50 76 59 66"/>
    ${heart(26, 66, 0.32, -10)}${heart(74, 66, 0.32, 10)}`,
  sweat: `
    ${oval(EYE.left, 50, 7, 14.5)}${oval(EYE.right, 50, 7, 14.5)}
    <path ${stroke(3.6)} d="M24 33 L44 26"/><path ${stroke(3.6)} d="M56 26 L76 33"/>
    ${drop(82, 22, 0.62)}`,
  exclaim: `
    <path ${fill()} d="M44 14 Q44 11 50 11 Q56 11 56 14 L53.6 56 Q53.4 59 50 59 Q46.6 59 46.4 56 Z"/>
    <circle ${fill()} cx="50" cy="76" r="6.6"/>`,
  question: `
    <g transform="${at(50, 44, 1.75)}"><path ${stroke(4.2)} d="${MARK.ask}"/></g>
    <circle ${fill()} cx="54" cy="77" r="5.8"/>`,
  sparkle: `
    ${spark(EYE.left, 43, 0.82)}${spark(EYE.right, 43, 0.82)}
    ${spark(22, 24, 0.26)}${spark(79, 26, 0.2)}${spark(76, 66, 0.24)}`,
  sad: `
    ${oval(EYE.left, 49, 7.4, 15, 14)}${oval(EYE.right, 49, 7.4, 15, -14)}
    <path ${stroke(3.6)} d="M23 33 L43 26"/><path ${stroke(3.6)} d="M57 26 L77 33"/>
    <path ${stroke(3.6)} d="M40 76 Q50 67 60 76"/>
    ${drop(30, 70, 0.4)}`,
  dizzy: `${spiral(EYE.left - 2, 44, 17, 2.4, 1)}${spiral(EYE.right + 2, 44, 17, 2.4, -1)}`,
};

const PAGE_B = {
  proud: `
    <path ${fill()} d="M24 42 H46 A11 11 0 0 1 24 42 Z"/><path ${fill()} d="M54 42 H76 A11 11 0 0 1 54 42 Z"/>
    <path ${stroke(3.8)} d="M38 66 Q50 80 62 66"/>
    ${spark(82, 22, 0.34, 10)}`,
  cry: `
    <path ${stroke(6.2)} d="M26 38 Q36 56 46 38"/><path ${stroke(6.2)} d="M54 38 Q64 56 74 38"/>
    ${drop(30, 58, 0.36)}${drop(30, 73, 0.3)}${drop(70, 58, 0.36)}${drop(70, 73, 0.3)}`,
  heart: `${heart(EYE.left, 44, 0.9)}${heart(EYE.right, 44, 0.9)}`,
  smug: `
    <path ${fill()} d="M24 46 H46 A11 11 0 0 1 24 46 Z"/><path ${fill()} d="M54 46 H76 A11 11 0 0 1 54 46 Z"/>
    <path ${stroke(3.8)} d="M52 25 L76 31"/>
    <path ${stroke(3.8)} d="M40 72 Q56 74 64 64"/>`,
  wink: `
    <path ${stroke(6.2)} d="M26 49 Q36 31 46 49"/>
    ${oval(EYE.right, 44, 7.6, 18)}
    ${spark(84, 22, 0.28, 8)}`,
  dots: `<circle ${fill()} cx="29" cy="48" r="6.8"/><circle ${fill()} cx="50" cy="48" r="6.8"/><circle ${fill()} cx="71" cy="48" r="6.8"/>`,
  music: `${note(EYE.left - 2, 44, 1)}${note(EYE.right - 2, 44, 1)}`,
  determined: `
    <rect ${fill(`transform="rotate(15 36 44)"`)} x="23" y="38" width="26" height="12.5" rx="6"/>
    <rect ${fill(`transform="rotate(-15 64 44)"`)} x="51" y="38" width="26" height="12.5" rx="6"/>
    <path ${stroke(3.6)} d="M42 70 H58"/>`,
  laugh: `
    <path ${stroke(6.2)} d="M26 40 Q36 22 46 40"/><path ${stroke(6.2)} d="M54 40 Q64 22 74 40"/>
    <path ${fill()} d="M30 58 H70 Q68 84 50 84 Q32 84 30 58 Z"/>`,
};

/** Faces with no open eyes: a blink would only squash the drawing, so the page lets them be. */
const NO_BLINK = new Set(["exclaim", "question", "dots", "thanks", "cry", "laugh", "music"]);

const PAGES = [
  { file: "drone-faces.webp", name: "A", faces: PAGE_A },
  { file: "drone-faces-2.webp", name: "B", faces: PAGE_B },
];

/** The shipped atlas shows its plain face from the cell at column 1, row 2 (counted in the stored picture). */
const HOME_CELL = { col: 1, row: 2 };

function pageSvg(faces, size) {
  const cell = size / 3;
  const cells = Object.values(faces)
    .map((body, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      return `<g transform="translate(${col * cell} ${row * cell}) scale(${cell / 100})">${body}</g>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="${GROUND}"/>${cells}</svg>`;
}

function option(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

async function main() {
  const out = path.resolve(option("out", path.join(REPO, "apps/web/public/img/home")));
  const size = Number(option("size", "1024"));
  fs.mkdirSync(out, { recursive: true });
  const json = {
    cellsPerSide: 3,
    size,
    ground: GROUND,
    ink: CYAN,
    flip: "stored upside down, like the shipped atlas",
    faces: {},
    pages: {},
  };
  for (const page of PAGES) {
    if (Object.keys(page.faces).length > 9)
      throw new Error(`page ${page.name} has more than nine faces`);
    // Rendered large and brought down for clean edges (librsvg draws at the density it is given).
    const png = await sharp(Buffer.from(pageSvg(page.faces, size * 2)))
      .resize(size, size, { kernel: "lanczos3" })
      .flip()
      .removeAlpha()
      .png()
      .toBuffer();
    await sharp(png).webp({ lossless: true, effort: 6 }).toFile(path.join(out, page.file));
    json.pages[page.name] = { file: page.file, bytes: fs.statSync(path.join(out, page.file)).size };
    Object.keys(page.faces).forEach((name, i) => {
      const col = i % 3;
      const row = 2 - Math.floor(i / 3); // the stored row: the picture is flipped
      const cell = size / 3;
      json.faces[name] = {
        page: page.name,
        file: page.file,
        blinks: !NO_BLINK.has(name),
        col,
        row,
        // `uCell` for the drone's shader: cells from the plain one's place (column 1, row 2).
        uCell: [col - HOME_CELL.col, row - HOME_CELL.row],
        rect: {
          x: Math.round(col * cell),
          y: Math.round(row * cell),
          width: Math.round(cell),
          height: Math.round(cell),
        },
      };
    });
  }
  fs.writeFileSync(path.join(out, "drone-faces.json"), `${JSON.stringify(json, null, 2)}\n`);
  console.log(JSON.stringify(json.pages), Object.keys(json.faces).length, "faces");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
