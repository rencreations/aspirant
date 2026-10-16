// Videos -> H.264/AAC MP4 + JPG poster + VTT captions under public/video, plus stills under public/img.
import fsp from "node:fs/promises";
import path from "node:path";
import {
  ARGS,
  TMP,
  cleanText,
  ensureDirFor,
  ffmpeg,
  fileSize,
  fmtMB,
  getSharp,
  isFresh,
  log,
  mediaInfo,
  mkdirp,
  pool,
  pub,
  rel,
  saveStage,
  src,
} from "./lib.mjs";

const MAX_BYTES = 38 * 1024 * 1024; // hard limit is 40 MB; keep headroom.

// Source folder -> canonical pair slug (also used by img/ and audio/).
const FA = "media/layla-and-fanny";
const LC = "media/lesley-and-change";
const RA = "media/ruby-and-angela";
const SO = "media/selena-and-obsidia";
const VG = "media/vexana-and-guinevere";

/**
 * w: output width (height follows, even). kbps: maxrate of the video stream. crf: quality target.
 * abr: audio kbps. pw: poster width. srt: English captions to convert.
 */
const VIDEOS = [
  // fanny-layla
  {
    pair: "fanny-layla",
    name: "trailer",
    from: `${FA}/video/trailer/trailer.webm`,
    w: 1280,
    kbps: 900,
    crf: 24,
    srt: `${FA}/video/trailer/en.en.srt`,
  },
  {
    pair: "fanny-layla",
    name: "skin-showcase",
    from: `${FA}/video/skin/skin.webm`,
    w: 960,
    kbps: 600,
    crf: 25,
  },
  {
    pair: "fanny-layla",
    name: "music-video",
    from: `${FA}/video/music-video/music.webm`,
    w: 1280,
    kbps: 700,
    crf: 25,
  },
  {
    pair: "fanny-layla",
    name: "music-bts",
    from: `${FA}/video/music-bts/music-bts.webm`,
    w: 640,
    kbps: 420,
    crf: 27,
    abr: 64,
  },
  {
    pair: "fanny-layla",
    name: "music-producer-talk",
    from: `${FA}/video/music-producer-talk/music-producer-talk.webm`,
    w: 640,
    kbps: 420,
    crf: 27,
    abr: 64,
  },
  {
    pair: "fanny-layla",
    name: "idea-bts",
    from: `${FA}/video/idea-bts/idea.webm`,
    w: 960,
    kbps: 600,
    crf: 25,
  },
  {
    pair: "fanny-layla",
    name: "short-animation",
    from: `${FA}/video/short-animation/short-animation.webm`,
    w: 960,
    kbps: 650,
    crf: 24,
    srt: `${FA}/video/short-animation/english.srt`,
  },
  // lesley-change
  {
    pair: "lesley-change",
    name: "trailer",
    from: `${LC}/trailer.webm`,
    w: 1280,
    kbps: 900,
    crf: 24,
    srt: `${LC}/NA.en.srt`,
  },
  {
    pair: "lesley-change",
    name: "teaser",
    from: `${LC}/teaser.webm`,
    w: 640,
    kbps: 450,
    crf: 26,
    abr: 64,
  },
  {
    pair: "lesley-change",
    name: "skin-showcase",
    from: `${LC}/skin-showcase.webm`,
    w: 640,
    kbps: 450,
    crf: 26,
    abr: 64,
  },
  // ruby-angela
  { pair: "ruby-angela", name: "trailer", from: `${RA}/trailer.webm`, w: 1280, kbps: 850, crf: 24 },
  { pair: "ruby-angela", name: "angela", from: `${RA}/angela.webm`, w: 1280, kbps: 700, crf: 25 },
  { pair: "ruby-angela", name: "ruby", from: `${RA}/ruby.webm`, w: 1280, kbps: 700, crf: 25 },
  { pair: "ruby-angela", name: "qna", from: `${RA}/qna.webm`, w: 640, kbps: 450, crf: 26, abr: 64 },
  {
    pair: "ruby-angela",
    name: "rerun",
    from: `${RA}/rerun.webm`,
    w: 540,
    kbps: 650,
    crf: 25,
    pw: 720,
  },
  {
    pair: "ruby-angela",
    name: "skin-showcase",
    from: `${RA}/skin.webm`,
    w: 640,
    kbps: 450,
    crf: 26,
    abr: 64,
  },
  // selena-obsidia
  {
    pair: "selena-obsidia",
    name: "trailer",
    from: `${SO}/trailer.webm`,
    w: 1280,
    kbps: 950,
    crf: 24,
    srt: `${SO}/ja.en-US-cQlcVsZB8sQ.srt`,
  },
  {
    pair: "selena-obsidia",
    name: "comic-video",
    from: `${SO}/comic.webm`,
    w: 640,
    kbps: 330,
    crf: 29,
    abr: 56,
    fps: 25,
  },
  {
    pair: "selena-obsidia",
    name: "obsidia",
    from: `${SO}/obsidia.webm`,
    w: 960,
    kbps: 600,
    crf: 25,
  },
  { pair: "selena-obsidia", name: "selena", from: `${SO}/selena.webm`, w: 960, kbps: 600, crf: 25 },
  {
    pair: "selena-obsidia",
    name: "selena-short-showcase",
    from: `${SO}/selena-short-showcase.webm`,
    w: 540,
    kbps: 650,
    crf: 25,
    pw: 720,
  },
  {
    pair: "selena-obsidia",
    name: "skin-showcase",
    from: `${SO}/skin-showcase.webm`,
    w: 960,
    kbps: 600,
    crf: 25,
  },
  // guinevere-vexana (source folder: vexana-and-guinevere)
  {
    pair: "guinevere-vexana",
    name: "trailer",
    from: `${VG}/trailer.webm`,
    w: 1280,
    kbps: 900,
    crf: 24,
  },
  {
    pair: "guinevere-vexana",
    name: "relink",
    from: `${VG}/relink.webm`,
    w: 1280,
    kbps: 800,
    crf: 24,
  },
  {
    pair: "guinevere-vexana",
    name: "3d-process",
    from: `${VG}/3d-process.webm`,
    w: 540,
    kbps: 650,
    crf: 25,
    pw: 720,
  },
  {
    pair: "guinevere-vexana",
    name: "comic-video",
    from: `${VG}/comic.webm`,
    w: 540,
    kbps: 600,
    crf: 26,
    pw: 720,
  },
  {
    pair: "guinevere-vexana",
    name: "heart-short-dance",
    from: `${VG}/heart-short-dance.webm`,
    w: 540,
    kbps: 650,
    crf: 25,
    pw: 720,
  },
  {
    pair: "guinevere-vexana",
    name: "interactive-drama",
    from: `${VG}/interactive-drama.webm`,
    w: 960,
    kbps: 600,
    crf: 25,
  },
  {
    pair: "guinevere-vexana",
    name: "short-splash-art-showcase",
    from: `${VG}/short-splash-art-showcase.webm`,
    w: 540,
    kbps: 650,
    crf: 25,
    pw: 720,
  },
  {
    pair: "guinevere-vexana",
    name: "skin-showcase",
    from: `${VG}/skin-showcase.webm`,
    w: 960,
    kbps: 600,
    crf: 25,
  },
  {
    pair: "guinevere-vexana",
    name: "sleeping",
    from: `${VG}/sleeping.webm`,
    w: 540,
    kbps: 600,
    crf: 25,
    pw: 720,
  },
];

export const EXCLUDED = [
  {
    what: `${FA}/video/live-action/live-action.webm and english.srt`,
    why: "Non-canon parody (Seiresk Academy, SHABO, Mr Imran). Excluded per canon rules.",
  },
  { what: `${VG}/live-guin.webm`, why: "Multi-hour livestream recording (220 MB)." },
  { what: `${VG}/live-vexana.webm`, why: "Multi-hour livestream recording (150 MB)." },
  {
    what: "_backup-before-aspirant-edits-2026-10-14, _backup-before-canon-edits-2026-10-14, audio/source",
    why: "Backups and raw sources are never shipped.",
  },
  {
    what: "Subtitle files other than English (ar, es, id, ja, km, ms, my, pt, ru, tr, vi)",
    why: "Site copy is English only.",
  },
];

/** Trailer timestamps (seconds) chosen by eye from contact sheets. Edit after running with --hero-candidates. */
export const HERO_PICKS = {
  "fanny-layla": [16, 58, 64],
  "lesley-change": [25, 82, 129],
  "ruby-angela": [32, 68, 104],
  "selena-obsidia": [40, 83, 104],
  "guinevere-vexana": [18, 51, 137, 170],
};
const HERO_SOURCES = {
  "fanny-layla": `${FA}/video/trailer/trailer.webm`,
  "lesley-change": `${LC}/trailer.webm`,
  "ruby-angela": `${RA}/trailer.webm`,
  "selena-obsidia": `${SO}/trailer.webm`,
  "guinevere-vexana": `${VG}/trailer.webm`,
};
export const STILLS = [
  {
    name: "selena-ender",
    from: `${SO}/trailer.webm`,
    at: 78,
    notes:
      "Trailer frame at 1:18. Shows, as seen: a close-up of a pink-haired character in three-quarter view, one glowing pink eye with a star-shaped pupil, dark angular marks on the cheek, a faint smile, gold ornaments at the neck and a horn-like ornament at the top right, against a dark indigo background with violet streaks. No on-screen text. Who this is and what it means is not stated by the frame.",
  },
  {
    name: "obsidia-ender",
    from: `${SO}/trailer.webm`,
    at: 155,
    notes:
      'Trailer frame at 2:35. Shows, as seen: a pale, long-haired figure arched backwards with the head tipped up, engulfed in bright white and orange flames and sparks, on a dark orange background. Burned-in caption at the top reads "Purify the corruption, and rewrite the law." (the caption is baked into the image, so use it only as a reference or crop it out). Who this is and what it means is not stated by the frame.',
  },
];

async function encode(v, info) {
  const input = src(v.from);
  const out = pub("video", v.pair, `${v.name}.mp4`);
  if (isFresh(out, input)) return false;
  await ensureDirFor(out);
  const tmpOut = path.join(TMP, `enc-${process.pid}-${v.pair}-${v.name}.mp4`);
  await mkdirp(TMP);
  let kbps = v.kbps;
  for (let attempt = 0; attempt < 4; attempt++) {
    const filters = [`scale=${v.w}:-2:flags=lanczos`];
    const targetFps = v.fps ?? 30;
    if (info.fps > targetFps + 1) filters.push(`fps=${targetFps}`);
    const args = [
      "-i",
      input,
      "-map",
      "0:v:0",
      "-map",
      "0:a:0?",
      "-vf",
      filters.join(","),
      "-c:v",
      "libx264",
      "-profile:v",
      "high",
      "-pix_fmt",
      "yuv420p",
      "-preset",
      "medium",
      "-crf",
      String(v.crf),
      "-maxrate",
      `${kbps}k`,
      "-bufsize",
      `${kbps * 2}k`,
      "-threads",
      "4",
      "-c:a",
      "aac",
      "-b:a",
      `${v.abr ?? 96}k`,
      "-ac",
      (v.abr ?? 96) <= 64 ? "1" : "2",
      "-movflags",
      "+faststart",
      tmpOut,
    ];
    await ffmpeg(args);
    const size = await fileSize(tmpOut);
    if (size <= MAX_BYTES) break;
    kbps = Math.round(kbps * (MAX_BYTES / size) * 0.9);
    log("video", `${v.pair}/${v.name} was ${fmtMB(size)}; retrying at maxrate ${kbps}k`);
  }
  await fsp.copyFile(tmpOut, out);
  await fsp.rm(tmpOut);
  return true;
}

async function poster(v, info) {
  const out = pub("video", v.pair, `${v.name}.jpg`);
  const input = src(v.from);
  if (isFresh(out, input)) return false;
  const sharp = await getSharp();
  const width = Math.min(v.pw ?? 1280, info.width);
  const tmp = path.join(TMP, `poster-${v.pair}-${v.name}.png`);
  for (const frac of [0.1, 0.15, 0.22, 0.3, 0.4]) {
    await ffmpeg([
      "-ss",
      String((info.duration * frac).toFixed(2)),
      "-i",
      input,
      "-frames:v",
      "1",
      "-vf",
      `scale=${width}:-2:flags=lanczos`,
      tmp,
    ]);
    const { channels } = await sharp(tmp).greyscale().stats();
    if (channels[0].mean > 28) break;
  }
  await sharp(tmp).jpeg({ quality: 82, mozjpeg: true }).toFile(out);
  await fsp.rm(tmp);
  return true;
}

async function captions(v) {
  if (!v.srt) return null;
  const out = pub("video", v.pair, `${v.name}.vtt`);
  const input = src(v.srt);
  if (isFresh(out, input)) return out;
  await ffmpeg(["-i", input, "-f", "webvtt", out]);
  const text = await fsp.readFile(out, "utf8");
  await fsp.writeFile(out, cleanText(text));
  return out;
}

async function frame(from, at, out, width = 1280) {
  const input = src(from);
  if (isFresh(out, input)) return false;
  const sharp = await getSharp();
  await ensureDirFor(out);
  await mkdirp(TMP);
  const tmp = path.join(TMP, `frame-${path.basename(out)}.png`);
  await ffmpeg([
    "-ss",
    String(at),
    "-i",
    input,
    "-frames:v",
    "1",
    "-vf",
    `scale=${width}:-2:flags=lanczos`,
    tmp,
  ]);
  await sharp(tmp).webp({ quality: 74, effort: 5 }).toFile(out);
  await fsp.rm(tmp);
  return true;
}

/** Contact sheets of candidate frames every ~12% of each trailer into TMP/hero-candidates. */
async function heroCandidates() {
  const sharp = await getSharp();
  const dir = path.join(TMP, "hero-candidates");
  await mkdirp(dir);
  for (const [pair, from] of Object.entries(HERO_SOURCES)) {
    const info = await mediaInfo(src(from));
    const times = [];
    for (let f = 0.04; f < 0.99; f += 0.06) times.push(Math.round(info.duration * f));
    const cells = [];
    for (const t of times) {
      const png = path.join(dir, `${pair}-${t}.png`);
      await ffmpeg([
        "-ss",
        String(t),
        "-i",
        src(from),
        "-frames:v",
        "1",
        "-vf",
        "scale=480:-2",
        png,
      ]);
      cells.push({ t, png });
    }
    const cols = 4;
    const cw = 480,
      ch = 202;
    const rows = Math.ceil(cells.length / cols);
    const comps = [];
    for (let i = 0; i < cells.length; i++) {
      const label = Buffer.from(
        `<svg width="${cw}" height="28"><rect width="${cw}" height="28" fill="rgba(0,0,0,.65)"/><text x="8" y="20" font-size="18" fill="#fff" font-family="Arial">${cells[i].t}s</text></svg>`,
      );
      comps.push({ input: cells[i].png, left: (i % cols) * cw, top: Math.floor(i / cols) * ch });
      comps.push({ input: label, left: (i % cols) * cw, top: Math.floor(i / cols) * ch });
    }
    await sharp({
      create: { width: cols * cw, height: rows * ch, channels: 3, background: "#000" },
    })
      .composite(comps)
      .jpeg({ quality: 80 })
      .toFile(path.join(dir, `sheet-${pair}.jpg`));
    log("video", `candidate sheet: ${path.join(dir, `sheet-${pair}.jpg`)} (${times.join(",")})`);
  }
}

export async function run() {
  if (ARGS.includes("--hero-candidates")) {
    await heroCandidates();
    return;
  }
  const records = [];
  let wrote = 0;
  const concurrency =
    Number((ARGS.find((a) => a.startsWith("--vconcurrency=")) ?? "").split("=")[1]) || 2;
  const infos = await pool(VIDEOS, 4, (v) => mediaInfo(src(v.from)));
  const tasks = VIDEOS.map((v, i) => async () => {
    const info = infos[i];
    const t = Date.now();
    const e = await encode(v, info);
    const p = await poster(v, info);
    const c = await captions(v);
    if (e) wrote++;
    const mp4 = pub("video", v.pair, `${v.name}.mp4`);
    const outInfo = await mediaInfo(mp4);
    records.push({
      id: `video-${v.pair}-${v.name}`,
      kind: "video",
      path: rel(mp4),
      bytes: await fileSize(mp4),
      width: outInfo.width,
      height: outInfo.height,
      durationSec: Math.round(outInfo.duration * 100) / 100,
      pair: v.pair,
      role: v.name,
      source: v.from,
      notes: `${v.w}px wide, CRF ${v.crf} capped at ${v.kbps} kbps${v.srt ? "; captions: " + rel(path.join(pub("video", v.pair), `${v.name}.vtt`)) : ""}`,
    });
    const jpg = pub("video", v.pair, `${v.name}.jpg`);
    records.push({
      id: `video-${v.pair}-${v.name}-poster`,
      kind: "image",
      path: rel(jpg),
      bytes: await fileSize(jpg),
      pair: v.pair,
      role: "poster",
      source: v.from,
      notes: `Frame near 10% of ${v.name}.`,
    });
    if (c) {
      records.push({
        id: `video-${v.pair}-${v.name}-captions`,
        kind: "data",
        path: rel(c),
        bytes: await fileSize(c),
        pair: v.pair,
        role: "captions-en",
        source: v.srt,
        notes: "English captions (WebVTT) converted from the SRT.",
      });
    }
    if (e || p)
      log(
        "video",
        `${v.pair}/${v.name}: ${fmtMB(await fileSize(mp4))} (${((Date.now() - t) / 1000).toFixed(0)}s)`,
      );
  });
  await pool(tasks, concurrency, (t) => t());

  // Ender-form stills and hero stills.
  for (const s of STILLS) {
    const out = pub("img", "stills", `${s.name}.webp`);
    await frame(s.from, s.at, out);
    records.push({
      id: `still-${s.name}`,
      kind: "image",
      path: rel(out),
      bytes: await fileSize(out),
      pair: "selena-obsidia",
      role: "still",
      source: `${s.from} @ ${s.at}s`,
      notes: s.notes,
    });
  }
  for (const [pair, times] of Object.entries(HERO_PICKS)) {
    let n = 1;
    for (const at of times) {
      const out = pub("img", "hero-stills", `${pair}-${String(n).padStart(2, "0")}.webp`);
      await frame(HERO_SOURCES[pair], at, out);
      records.push({
        id: `hero-${pair}-${String(n).padStart(2, "0")}`,
        kind: "image",
        path: rel(out),
        bytes: await fileSize(out),
        pair,
        role: "hero-still",
        source: `${HERO_SOURCES[pair]} @ ${at}s`,
      });
      n++;
    }
  }
  log("video", `${wrote} videos encoded (others up to date)`);
  await saveStage(
    "video",
    records.sort((a, b) => a.id.localeCompare(b.id)),
    {
      skipped: EXCLUDED.map((e) => ({ ...e })),
    },
  );
}
