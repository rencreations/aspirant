// Writes the wall's extra pictures from the pool (`apps/web/public/data/home/wall.json`, made by pool.py):
//   apps/web/src/features/home/fx/image-field/tiles-data.ts   the field's tiles (640 wide files under public/)
//   apps/web/src/features/home/preview/tile-pictures.ts       the same pictures as the preview window shows them
// The tiles are the first COUNT pictures of the pool's cyclic order that are not one of the eighteen splash
// arts of the wall (those are `picks-data.ts`). Run: node scripts/home/media/wall-tiles.cjs [COUNT]
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..", "..");
const web = path.join(root, "apps", "web");
const COUNT = Number(process.argv[2] || 100);

const pool = JSON.parse(
  fs.readFileSync(path.join(web, "public", "data", "home", "wall.json"), "utf8"),
);
const picks = fs.readFileSync(
  path.join(web, "src/features/home/fx/image-field/picks-data.ts"),
  "utf8",
);
const wallIds = new Set([...picks.matchAll(/id: "(arts-splash-[^"]+)"/g)].map((m) => m[1]));
const byId = new Map(pool.items.map((p) => [p.id, p]));

const tiles = pool.order
  .filter((id) => !wallIds.has(id))
  .slice(0, COUNT)
  .map((id) => byId.get(id));

const q = (s) => JSON.stringify(s);
const num = (n) => (Math.round(n * 1000) / 1000).toString();

let a = `/**
 * Extra official pictures for the wall (and only the wall): ${tiles.length} stills of the collection's game and
 * scene art, cut to 640 wide with no corner mark (\`public/img/home/wall/\`, \`public/data/home/wall.json\`, made by
 * \`scripts/home/media/pool.py\`), in the pool's cyclic order. Together with the eighteen splash arts of
 * \`picks-data.ts\` the wall has ${tiles.length + wallIds.size} different pictures, more than it has cells, so none
 * repeats at a usual size and \`arrange.ts\` keeps look-alikes (\`group\`) and one Aspirant apart.
 * Each is an official still of the collection (\`canon: "official"\`). A press on one opens it in the preview
 * window (\`preview/tile-pictures.ts\`). WRITTEN by \`scripts/home/media/wall-tiles.cjs\`: change the pool or
 * the count there and run it, never edit this file by hand.
 */
import type { WidePic } from "./sets";

const WHOLE = { x: 0, y: 0, w: 1, h: 1 } as const;

export const WALL_TILES: readonly WidePic[] = [
`;
for (const p of tiles) {
  a += `  {
    id: ${q(p.id)},
    chars: [${p.chars.map(q).join(", ")}],
    key: ${q(p.lib.p)},
    file: ${q(p.file)},
    group: ${q(p.group)},
    w: ${p.w},
    h: ${p.h},
    bytes: ${p.bytes},
    clean: WHOLE,
    focus: { x: ${num(p.focus.x)}, y: ${num(p.focus.y)} },
  },
`;
}
a += "];\n";
fs.writeFileSync(path.join(web, "src/features/home/fx/image-field/tiles-data.ts"), a);

let b = `/**
 * The wall-only pictures (\`fx/image-field/tiles-data.ts\`) as the preview window shows them: the whole
 * still, full size. WRITTEN with the tiles by \`scripts/home/media/wall-tiles.cjs\` from the pool; the
 * full size file's byte count is an estimate (the pool lists only the cut files' sizes).
 */
import type { PreviewPicture } from "./pictures";

export const TILE_PICTURES: readonly PreviewPicture[] = [
`;
for (const p of tiles) {
  b += `  {
    id: ${q(p.id)},
    title: ${q(p.title)},
    alt: ${q(p.alt)},
    chars: [${p.chars.map(q).join(", ")}],
    p: ${q(p.lib.p)},
    f: ${q(p.lib.f)},
    w: ${p.lib.w},
    h: ${p.lib.h},
    bytes: ${Math.round(p.lib.w * p.lib.h * 0.075)},
  },
`;
}
b += "];\n";
fs.writeFileSync(path.join(web, "src/features/home/preview/tile-pictures.ts"), b);
console.log(
  "tiles",
  tiles.length,
  "bytes",
  tiles.reduce((x, p) => x + p.bytes, 0),
  "wall ids",
  wallIds.size,
);
