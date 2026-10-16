// Character art, shared pair art and fan art -> WebP under public/img.
import fs from "node:fs";
import path from "node:path";
import {
  CONCURRENCY,
  writeJson,
  fileSize,
  getSharp,
  isFresh,
  ensureDirFor,
  log,
  pool,
  pub,
  rel,
  saveStage,
  src,
  srcRel,
} from "./lib.mjs";

const SPLASH_W = 2048;
const SPLASH_SM_W = 800;
const CUTOUT_MAX_H = 1800;

const L = "media/layla-and-fanny/art/official";
const VG = "media/vexana-and-guinevere";

/** One entry per character. `cutout` and `extras` are optional. */
export const CHARS = {
  fanny: {
    pair: "fanny-layla",
    splash: `${L}/fanny-splash-art.jpg`,
    cutout: `${L}/fanny-splash-art-transparent.png`,
    extras: [
      { src: `${L}/fanny-flying-pose-transparent.png`, alpha: true, role: "extra-flying-pose" },
    ],
  },
  layla: {
    pair: "fanny-layla",
    splash: `${L}/layla-splash-art.jpg`,
    cutout: `${L}/layla-splash-art-transparent-with-ground.png`,
    cutoutNote:
      "Source is the transparent splash art that still includes the ground; cropped to the alpha bounding box.",
  },
  ruby: { pair: "ruby-angela", splash: "media/ruby-and-angela/ruby-splash-art.jpg" },
  angela: { pair: "ruby-angela", splash: "media/ruby-and-angela/angela-splash-art.jpg" },
  lesley: { pair: "lesley-change", splash: "media/lesley-and-change/lesley-splash-art.jpg" },
  change: { pair: "lesley-change", splash: "media/lesley-and-change/change-splash-art.jpg" },
  guinevere: {
    pair: "guinevere-vexana",
    splash: `${VG}/guinevere-splash-art.jpg`,
    cutout: `${VG}/guin-fighting-stance-transparent.png`,
  },
  vexana: {
    pair: "guinevere-vexana",
    splash: `${VG}/vexana-splash-art.jpg`,
    cutout: `${VG}/vexana-fighting-stance-transparent.png`,
    extras: [
      { src: `${VG}/vexana-mobile-wallpaper.jpg`, alpha: false, role: "extra-mobile-wallpaper" },
    ],
  },
  selena: {
    pair: "selena-obsidia",
    splash: "media/selena-and-obsidia/selena-splash-art.png",
    cutout: "media/selena-and-obsidia/selena-transparent.png",
  },
  obsidia: {
    pair: "selena-obsidia",
    splash: "media/selena-and-obsidia/obsidia-splash-art.png",
    cutout: "media/selena-and-obsidia/obsidia-transparent.png",
  },
};

export const PAIR_ART = {
  "fanny-layla": [
    { src: `${L}/fighting-together-splash-art.jpg`, name: "fighting-together-splash-art" },
    { src: `${L}/fanny-and-layla.webp`, name: "fanny-and-layla" },
  ],
  "guinevere-vexana": [
    { src: `${VG}/both-splash-art.jpg`, name: "both-splash-art" },
    { src: `${VG}/fighting-moment.jpg`, name: "fighting-moment" },
    { src: `${VG}/fighting-stance.jpg`, name: "fighting-stance" },
  ],
};

export const WEBP = { quality: 82, effort: 5, smartSubsample: true };
export const WEBP_ALPHA = { quality: 84, alphaQuality: 92, effort: 5, smartSubsample: true };

/** Bounding box of pixels with alpha above `thr`. */
export async function alphaBBox(file, thr = 8) {
  const sharp = await getSharp();
  const { data, info } = await sharp(file, { limitInputPixels: false })
    .ensureAlpha()
    .extractChannel(3)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  let minX = w,
    minY = h,
    maxX = -1,
    maxY = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      if (data[row + x] > thr) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error(`fully transparent: ${file}`);
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

async function outInfo(out) {
  const sharp = await getSharp();
  const m = await sharp(out).metadata();
  return { width: m.width, height: m.height, bytes: await fileSize(out) };
}

async function writeResized(input, out, { width, fit = "inside", height, webp = WEBP }) {
  if (isFresh(out, input)) return 0;
  const sharp = await getSharp();
  await ensureDirFor(out);
  await sharp(input, { limitInputPixels: false })
    .rotate()
    .resize({ width, height: height ?? undefined, fit, withoutEnlargement: true })
    .webp(webp)
    .toFile(out);
  return 1;
}

export async function writeCutout(input, out, maxH = CUTOUT_MAX_H) {
  if (isFresh(out, input)) return 0;
  const sharp = await getSharp();
  await ensureDirFor(out);
  const box = await alphaBBox(input);
  await sharp(input, { limitInputPixels: false })
    .ensureAlpha()
    .extract(box)
    .resize({ height: maxH, withoutEnlargement: true })
    .webp(WEBP_ALPHA)
    .toFile(out);
  return 1;
}

/**
 * Dominant accent colour for UI theming: the most populated hue bucket weighted by saturation and brightness, so a
 * white or black backdrop does not win. Falls back to the mean colour for near-grey images.
 */
async function dominantHex(file) {
  const sharp = await getSharp();
  const { data } = await sharp(file)
    .resize(64, 64, { fit: "inside" })
    .flatten({ background: "#808080" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const bins = Array.from({ length: 24 }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
  let mr = 0,
    mg = 0,
    mb = 0,
    n = 0;
  for (let i = 0; i < data.length; i += 3) {
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];
    mr += r;
    mg += g;
    mb += b;
    n++;
    const max = Math.max(r, g, b),
      min = Math.min(r, g, b);
    const v = max / 255,
      sat = max === 0 ? 0 : (max - min) / max;
    if (sat < 0.25 || v < 0.25) continue;
    let h;
    const d = max - min;
    if (max === r) h = ((g - b) / d + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    const bin = bins[Math.floor((h / 6) * 24) % 24];
    const w = sat * sat * v;
    bin.w += w;
    bin.r += r * w;
    bin.g += g * w;
    bin.b += b * w;
  }
  const best = bins.reduce((a, c) => (c.w > a.w ? c : a), bins[0]);
  const rgb =
    best.w > 1 ? [best.r / best.w, best.g / best.w, best.b / best.w] : [mr / n, mg / n, mb / n];
  return "#" + rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------- fan art

const SITE_NAMES = {
  deviantart: "DeviantArt",
  pixiv: "Pixiv",
  artstation: "ArtStation",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  reddit: "Reddit",
  x: "X",
};

const titleFromSlug = (s) =>
  s.replace(/---/g, " - ").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();

/** Best-effort parse of the URL that was flattened into a file name. */
export function parseFanartName(file) {
  const base = path.basename(file).replace(/\.(jpe?g|png|webp)$/i, "");
  let m;
  if ((m = base.match(/^httpswww\.deviantart\.com(.+?)art([A-Za-z0-9(].*)-(\d+)$/))) {
    const [, artist, slug, id] = m;
    return {
      site: "deviantart",
      artist,
      title: titleFromSlug(slug),
      url: `https://www.deviantart.com/${artist}/art/${slug}-${id}`,
      urlConfidence: "high",
    };
  }
  if ((m = base.match(/^httpswww\.pixiv\.netenartworks(\d+)$/))) {
    return {
      site: "pixiv",
      artist: null,
      title: `Pixiv artwork ${m[1]}`,
      url: `https://www.pixiv.net/en/artworks/${m[1]}`,
      urlConfidence: "high",
    };
  }
  if ((m = base.match(/^httpswww\.artstation\.comartwork(\w+)$/))) {
    return {
      site: "artstation",
      artist: null,
      title: `ArtStation artwork ${m[1]}`,
      url: `https://www.artstation.com/artwork/${m[1]}`,
      urlConfidence: "high",
    };
  }
  if ((m = base.match(/^httpswww\.facebook\.comgroups(.+?)posts(\d+)$/))) {
    return {
      site: "facebook",
      artist: null,
      group: m[1],
      title: `Facebook post in the group ${m[1]}`,
      url: `https://www.facebook.com/groups/${m[1]}/posts/${m[2]}`,
      urlConfidence: "medium",
    };
  }
  if ((m = base.match(/^httpswww\.facebook\.comphotofbid=(\d+)(&set=[\w.]+)?$/))) {
    return {
      site: "facebook",
      artist: null,
      title: `Facebook photo ${m[1]}`,
      url: `https://www.facebook.com/photo?fbid=${m[1]}${m[2] ?? ""}`,
      urlConfidence: "medium",
    };
  }
  if ((m = base.match(/^httpswww\.linkedin\.compostsjoshua-tan-2aa2b8246_(.+)$/))) {
    return {
      site: "linkedin",
      artist: "Joshua Tan",
      title: "Aspirants Fanny fanart",
      url: `https://www.linkedin.com/posts/joshua-tan-2aa2b8246_${m[1]}`,
      urlConfidence: "high",
    };
  }
  if (
    (m = base.match(
      /^httpswww\.reddit\.comr(MobileLegendsGame)comments([a-z0-9]{6,7}?)(fanny_.*|my_.*)$/,
    ))
  ) {
    return {
      site: "reddit",
      artist: null,
      subreddit: m[1],
      title: titleFromSlug(m[3]).replace(/^./, (c) => c.toUpperCase()),
      url: `https://www.reddit.com/r/${m[1]}/comments/${m[2]}/${m[3]}/`,
      urlConfidence: "medium",
    };
  }
  if ((m = base.match(/^httpsx\.com(\w+)status(\d+)$/))) {
    return {
      site: "x",
      artist: `@${m[1]}`,
      title: `Post ${m[2]}`,
      url: `https://x.com/${m[1]}/status/${m[2]}`,
      urlConfidence: "high",
    };
  }
  return { site: "unknown", artist: base, title: base, url: null, urlConfidence: "none" };
}

function creditFor(p) {
  const site = SITE_NAMES[p.site];
  if (p.site === "deviantart") return `${p.artist} on ${site}`;
  if (p.site === "reddit") return `Unknown artist, via ${site} r/${p.subreddit}`;
  if (p.site === "facebook")
    return p.group
      ? `Unknown artist, via the Facebook group ${p.group}`
      : "Unknown artist, via Facebook";
  if (p.site === "pixiv" || p.site === "artstation") return `Unknown artist, via ${site}`;
  if (p.artist) return `${p.artist} on ${site ?? "the web"}`;
  return "Unknown artist";
}

const FANART_DIR = "media/layla-and-fanny/art/fanart";

function listFanart() {
  const root = src(FANART_DIR);
  const out = [];
  for (const folder of fs.readdirSync(root).sort()) {
    const dir = path.join(root, folder);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir).sort()) {
      if (/\.(jpe?g|png|webp)$/i.test(f)) out.push({ folder, file: path.join(dir, f) });
    }
  }
  return out;
}

export async function run() {
  const records = [];
  const skipped = [];
  const tasks = [];
  let wrote = 0;
  const tally = async (p) => {
    const n = await p;
    wrote += n;
  };

  // ---- characters
  for (const [slug, c] of Object.entries(CHARS)) {
    const dir = pub("img", "char", slug);
    const base = { kind: "image", slug, pair: c.pair };
    tasks.push(async () => {
      const splashSrc = src(c.splash);
      const full = path.join(dir, "splash.webp");
      const sm = path.join(dir, "splash-sm.webp");
      await tally(writeResized(splashSrc, full, { width: SPLASH_W }));
      await tally(
        writeResized(splashSrc, sm, { width: SPLASH_SM_W, webp: { ...WEBP, quality: 78 } }),
      );
      records.push({
        ...base,
        id: `char-${slug}-splash`,
        role: "splash",
        path: rel(full),
        source: srcRel(splashSrc),
        ...(await outInfo(full)),
      });
      records.push({
        ...base,
        id: `char-${slug}-splash-sm`,
        role: "splash-sm",
        path: rel(sm),
        source: srcRel(splashSrc),
        ...(await outInfo(sm)),
      });
      if (c.cutout) {
        const out = path.join(dir, "cutout.webp");
        await tally(writeCutout(src(c.cutout), out));
        records.push({
          ...base,
          id: `char-${slug}-cutout`,
          role: "cutout",
          path: rel(out),
          source: srcRel(src(c.cutout)),
          notes: c.cutoutNote ?? "Transparent WebP cropped to the alpha bounding box.",
          ...(await outInfo(out)),
        });
      } else {
        skipped.push({
          what: `img/char/${slug}/cutout.webp`,
          why: "No transparent cut-out exists in the source folder.",
        });
      }
      let i = 1;
      for (const ex of c.extras ?? []) {
        const out = path.join(dir, `extra-${i}.webp`);
        if (ex.alpha) await tally(writeCutout(src(ex.src), out));
        else await tally(writeResized(src(ex.src), out, { width: 2400 }));
        records.push({
          ...base,
          id: `char-${slug}-extra-${i}`,
          role: ex.role,
          path: rel(out),
          source: srcRel(src(ex.src)),
          ...(await outInfo(out)),
        });
        i++;
      }
    });
  }

  // ---- pair art
  for (const [pair, items] of Object.entries(PAIR_ART)) {
    for (const it of items) {
      tasks.push(async () => {
        const out = pub("img", "pair", pair, `${it.name}.webp`);
        await tally(writeResized(src(it.src), out, { width: SPLASH_W }));
        records.push({
          kind: "image",
          id: `pair-${pair}-${it.name}`,
          pair,
          role: it.name,
          path: rel(out),
          source: srcRel(src(it.src)),
          ...(await outInfo(out)),
        });
      });
    }
  }
  for (const p of ["ruby-angela", "lesley-change", "selena-obsidia"]) {
    skipped.push({
      what: `img/pair/${p}/`,
      why: "No shared art for this pair exists in the source folder.",
    });
  }

  // ---- fan art
  const fanart = [];
  const counters = new Map();
  for (const it of listFanart()) {
    const p = parseFanartName(it.file);
    const slugBase =
      p.site === "deviantart"
        ? p.artist
        : p.site === "unknown"
          ? path.basename(it.file).replace(/\.\w+$/, "")
          : p.site;
    const key = `${it.folder}-${slugBase.toLowerCase().replace(/[^a-z0-9]+/g, "")}`;
    const n = (counters.get(key) ?? 0) + 1;
    counters.set(key, n);
    const id = `${key}-${n}`;
    tasks.push(async () => {
      const full = pub("img", "fanart", `${id}.webp`);
      const sm = pub("img", "fanart", `${id}-sm.webp`);
      await tally(writeResized(it.file, full, { width: 1800, height: 1800 }));
      await tally(
        writeResized(it.file, sm, { width: 720, height: 720, webp: { ...WEBP, quality: 76 } }),
      );
      const info = await outInfo(full);
      const color = await dominantHex(full);
      const entry = {
        id,
        character: it.folder,
        site: p.site,
        artist: p.artist,
        title: p.title,
        url: p.url ?? null,
        urlConfidence: p.urlConfidence,
        credit: creditFor(p),
        color,
        file: rel(full),
        fileSm: rel(sm),
        width: info.width,
        height: info.height,
        originalFile: path.basename(it.file),
      };
      fanart.push(entry);
      const common = {
        kind: "image",
        pair: "fanny-layla",
        slug: it.folder === "both" ? undefined : it.folder,
        credit: entry.credit,
        source: srcRel(it.file),
        color,
      };
      records.push({
        ...common,
        id: `fanart-${id}`,
        role: "fanart",
        path: rel(full),
        ...info,
        notes: p.url ? `Original: ${p.url}` : undefined,
      });
      records.push({
        ...common,
        id: `fanart-${id}-sm`,
        role: "fanart-sm",
        path: rel(sm),
        ...(await outInfo(sm)),
      });
    });
  }

  log("images", `${tasks.length} jobs, concurrency ${CONCURRENCY}`);
  await pool(tasks, CONCURRENCY, (t) => t());
  fanart.sort((a, b) => a.id.localeCompare(b.id));
  await writeJson(pub("data", "fanart.json"), {
    note: "Every fan art piece with credit and original link. urlConfidence: high = standard URL pattern for the site; medium = reconstructed from a flattened file name, may need a manual check; none = no link known. color is the dominant accent colour for UI theming.",
    items: fanart,
  });
  records.push({
    id: "data-fanart",
    kind: "data",
    path: "data/fanart.json",
    role: "fanart-index",
    source: FANART_DIR,
    notes: "Credit, link, character and accent colour for each fan art piece.",
  });
  log("images", `${wrote} files written (others up to date); ${fanart.length} fan art pieces`);
  await saveStage(
    "images",
    records.sort((a, b) => a.id.localeCompare(b.id)),
    { skipped, fanart },
  );
}
