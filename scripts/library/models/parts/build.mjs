// The parts pipeline: cuts the character and item views of the 3D Models room out of the sources
// and writes one GLB per view into the R2 mirror. See README.md.
//
//   node build.mjs                 every view
//   node build.mjs --only a,b      some views
//
// Each view is cut in real Chrome with the site's own three (page/recipes.js), written by three's
// GLTFExporter (so the rigged files keep their bone frames exactly), then put through the size pass
// here: the original pictures put back, WebP, welded, quantised, meshopt.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTTextureWebP, KHRMeshQuantization } from "@gltf-transform/extensions";
import { dedup, meshopt, prune, quantize, reorder, weld } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import sharp from "sharp";
import { openPage } from "./chrome.mjs";

export const MIRROR = "D:\\ren\\aspirant-r2\\library\\v1\\models\\v1";
export const WORK = process.env.PARTS_WORK ?? "D:\\ren\\aspirant-work\\models-room\\parts";

/** The views this pipeline makes, and whether each is an item (pictures at most 1024) or a character (2048). */
export const VIEWS = {
  fanny: "character",
  "fanny-blade": "item",
  "fanny-thruster": "item",
  layla: "character",
  "layla-gun": "item",
  ruby: "character",
  "ruby-scythe": "item",
  angela: "character",
  lesley: "character",
  "lesley-sniper": "item",
  "lesley-mecha": "item",
  change: "character",
  "change-moon": "item",
  guinevere: "character",
  "guinevere-weapon": "item",
  vexana: "character",
  "vexana-staff": "item",
  "eternal-guard": "character",
  "eternal-guard-sword": "item",
  "aspirant-drone": "item",
};

const fail = (message) => {
  throw new Error(`models parts: ${message}`);
};

export function makeIO() {
  return new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });
}

/** The file on disk behind a /disk/ address of the page. */
function diskPath(src) {
  const i = src.indexOf("/disk/");
  if (i < 0) fail(`not a file address: ${src}`);
  return path.normalize(decodeURIComponent(src.slice(i + 6)));
}

/** Mean absolute difference of two RGB pictures of the same size (0 to 255). */
async function rgbDifference(a, b) {
  const [x, y] = await Promise.all(
    [a, b].map((s) => s.removeAlpha().raw().toBuffer({ resolveWithObject: true })),
  );
  if (x.info.width !== y.info.width || x.info.height !== y.info.height) return 255;
  let sum = 0;
  for (let i = 0; i < x.data.length; i++) sum += Math.abs(x.data[i] - y.data[i]);
  return sum / x.data.length;
}

/**
 * The size pass. Pictures: the exporter's copy (drawn through a canvas) is replaced by the original
 * file, turned upside down as the exporter stores it, its alpha dropped where every material that
 * uses it is opaque, WebP at most `maxTexture`. Geometry: welded, quantised, meshopt.
 */
export async function sizePass(raw, blobs, { maxTexture }) {
  await MeshoptEncoder.ready;
  const io = makeIO();
  const doc = await io.readBinary(new Uint8Array(raw));
  const root = doc.getRoot();
  const users = new Map();
  for (const mat of root.listMaterials()) {
    const src = mat.getExtras()?.src;
    const tex = mat.getBaseColorTexture();
    if (tex) {
      const u = users.get(tex) ?? { srcs: new Set(), opaque: true, materials: [] };
      if (src) u.srcs.add(src);
      u.materials.push(mat.getName());
      if (mat.getAlphaMode() !== "OPAQUE") u.opaque = false;
      users.set(tex, u);
    }
    mat.setExtras({});
  }
  const pictures = [];
  for (const [tex, { srcs, opaque, materials }] of users) {
    if (srcs.size !== 1) fail(`texture ${tex.getName()} has ${srcs.size} sources`);
    const src = [...srcs][0];
    const bytes = src.startsWith("blob:")
      ? Buffer.from(blobs[src] ?? fail(`no bytes for ${src}`), "base64")
      : fs.readFileSync(diskPath(src));
    const original = sharp(bytes, { failOn: "none" });
    const meta = await original.metadata();
    // Guard: the exporter's copy must be the original upside down (only where nothing is clear).
    const stats = await sharp(bytes).stats();
    const clear = stats.channels.length === 4 && stats.channels[3].min < 255;
    if (!clear) {
      const diff = await rgbDifference(sharp(Buffer.from(tex.getImage())), sharp(bytes).flip());
      if (diff > 4)
        fail(
          `picture ${path.basename(src)} does not match the exporter's copy (difference ${diff.toFixed(1)})`,
        );
    }
    let image = sharp(bytes, { failOn: "none" }).flip();
    if (opaque) image = image.removeAlpha();
    const longest = Math.max(meta.width, meta.height);
    if (longest > maxTexture)
      image = image.resize(
        Math.round((meta.width * maxTexture) / longest),
        Math.round((meta.height * maxTexture) / longest),
        { kernel: "lanczos3" },
      );
    const out = await image
      .webp({ quality: 92, alphaQuality: 100, effort: 6, smartSubsample: true })
      .toBuffer();
    tex.setImage(new Uint8Array(out)).setMimeType("image/webp").setURI("");
    // A picture from an FBX has no file name: it is named after its material.
    tex.setName(
      src.startsWith("blob:")
        ? materials[0]
        : path.basename(diskPath(src)).replace(/\.[a-z]+$/i, ""),
    );
    pictures.push({
      name: tex.getName(),
      size: `${meta.width}x${meta.height}`,
      opaque,
      bytes: out.byteLength,
    });
  }
  doc.createExtension(EXTTextureWebP).setRequired(true);
  doc.createExtension(KHRMeshQuantization).setRequired(true);
  await doc.transform(
    weld(),
    dedup({ keepUniqueNames: true }),
    prune({ keepLeaves: true, keepExtras: true }),
    reorder({ encoder: MeshoptEncoder }),
    quantize({
      quantizePosition: 14,
      quantizeNormal: 10,
      quantizeTexcoord: 12,
      quantizeColor: 8,
      quantizeWeight: 8,
      quantizeGeneric: 12,
    }),
    meshopt({ encoder: MeshoptEncoder, level: "high" }),
  );
  root.getAsset().generator = "aspirant models parts";
  return { bytes: await io.writeBinary(doc), pictures };
}

async function main() {
  const i = process.argv.indexOf("--only");
  const ids = i >= 0 ? process.argv[i + 1].split(",") : Object.keys(VIEWS);
  for (const id of ids) if (!VIEWS[id]) fail(`unknown view ${id}`);
  fs.mkdirSync(MIRROR, { recursive: true });
  fs.mkdirSync(path.join(WORK, "raw"), { recursive: true });
  const { page, close } = await openPage();
  const summary = [];
  try {
    for (const id of ids) {
      const { glb, blobs, report } = await page.evaluate((v) => window.build(v), id);
      const raw = Buffer.from(glb, "base64");
      fs.writeFileSync(path.join(WORK, "raw", `${id}.glb`), raw);
      const { bytes, pictures } = await sizePass(raw, blobs, {
        maxTexture: VIEWS[id] === "item" ? 1024 : 2048,
      });
      const out = path.join(MIRROR, `${id}.glb`);
      fs.writeFileSync(out, bytes);
      const line = {
        id,
        kb: Math.round(bytes.byteLength / 1024),
        raw_kb: Math.round(raw.byteLength / 1024),
        ...report,
        pictures: pictures.map(
          (p) => `${p.name} ${p.size}${p.opaque ? "" : " alpha"} ${Math.round(p.bytes / 1024)}kB`,
        ),
      };
      summary.push(line);
      console.log(JSON.stringify(line));
    }
  } finally {
    await close();
  }
  const file = path.join(WORK, "build-report.json");
  const old = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : [];
  const merged = Object.keys(VIEWS)
    .map((id) => summary.find((l) => l.id === id) ?? old.find((l) => l.id === id))
    .filter(Boolean);
  fs.writeFileSync(file, JSON.stringify(merged, null, 1));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
