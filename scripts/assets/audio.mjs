// Voice lines and music -> AAC (.m4a) under public/audio.
import fs from "node:fs";
import path from "node:path";
import {
  CONCURRENCY,
  ensureDirFor,
  exec,
  ffmpeg,
  fileSize,
  isFresh,
  log,
  mediaInfo,
  pad2,
  pool,
  pub,
  rel,
  saveStage,
  src,
  srcRel,
  writeJson,
} from "./lib.mjs";

const VOICE_SLUGS = [
  "angela",
  "change",
  "fanny",
  "guinevere",
  "layla",
  "lesley",
  "obsidia",
  "ruby",
  "selena",
  "vexana",
];
const PAIR_OF = {
  fanny: "fanny-layla",
  layla: "fanny-layla",
  ruby: "ruby-angela",
  angela: "ruby-angela",
  lesley: "lesley-change",
  change: "lesley-change",
  guinevere: "guinevere-vexana",
  vexana: "guinevere-vexana",
  selena: "selena-obsidia",
  obsidia: "selena-obsidia",
};

const TARGET_RMS_DB = -18; // gated RMS of every line after normalising
const PEAK_CEIL = 0.92;
const SR = 24000;

// Trim leading and trailing silence (keeping a short natural pad), mono, 24 kHz, float samples.
const TRIM = [
  "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.06:detection=peak",
  "areverse",
  "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.12:detection=peak",
  "areverse",
  "aformat=sample_fmts=flt:channel_layouts=mono",
  `aresample=${SR}`,
].join(",");

async function measure(input) {
  const { stdout } = await exec(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      input,
      "-af",
      TRIM,
      "-f",
      "f32le",
      "-ac",
      "1",
      "-ar",
      String(SR),
      "pipe:1",
    ],
    { binary: true },
  );
  const buf = stdout;
  const f = new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 4));
  const win = Math.round(SR * 0.05);
  let peak = 0,
    sum = 0,
    n = 0;
  for (let i = 0; i < f.length; i++) peak = Math.max(peak, Math.abs(f[i]));
  for (let s = 0; s + win <= f.length; s += win) {
    let ms = 0;
    for (let i = s; i < s + win; i++) ms += f[i] * f[i];
    ms /= win;
    if (10 * Math.log10(ms + 1e-12) > -45) {
      sum += ms;
      n++;
    }
  }
  const rmsDb = n ? 10 * Math.log10(sum / n) : -30;
  return { peak, rmsDb, duration: f.length / SR };
}

async function encodeVoice(input, out) {
  const m = await measure(input);
  let gainDb = TARGET_RMS_DB - m.rmsDb;
  const maxByPeak = 20 * Math.log10(PEAK_CEIL / Math.max(m.peak, 1e-4));
  gainDb = Math.max(-12, Math.min(18, Math.min(gainDb, maxByPeak)));
  const fadeOut = Math.min(0.04, m.duration / 4);
  const chain = [
    TRIM,
    `volume=${gainDb.toFixed(2)}dB`,
    "alimiter=limit=0.95:level=disabled",
    "afade=t=in:d=0.005",
    `afade=t=out:st=${Math.max(0, m.duration - fadeOut).toFixed(3)}:d=${fadeOut.toFixed(3)}`,
  ].join(",");
  await ensureDirFor(out);
  await ffmpeg([
    "-i",
    input,
    "-af",
    chain,
    "-c:a",
    "aac",
    "-b:a",
    "32k",
    "-ar",
    String(SR),
    "-ac",
    "1",
    "-movflags",
    "+faststart",
    out,
  ]);
  return { gainDb, rmsDb: m.rmsDb };
}

const MUSIC = [
  {
    name: "we-believe",
    from: "media/layla-and-fanny/music/we-believe.m4a",
    pair: "fanny-layla",
    notes: "Layla and Fanny song, 48 kHz stereo original re-encoded to AAC 96 kbps.",
  },
  {
    name: "obsidia-aspirant",
    from: "audio/obsidia/long/obsidia-aspirant.mp3",
    pair: "selena-obsidia",
    slug: "obsidia",
    notes:
      "Stereo MP3 in audio/obsidia/long (36 s). Sung or spoken piece, not a voice-line compilation.",
  },
  {
    name: "obsidia-solo",
    from: "audio/obsidia/long/obsidia-solo.mp3",
    pair: "selena-obsidia",
    slug: "obsidia",
    notes:
      "Stereo MP3 in audio/obsidia/long (80 s). Sung or spoken piece, not a voice-line compilation.",
  },
];

export async function run() {
  const records = [];
  const skipped = [];
  const notes = [];
  let wrote = 0;

  // ---- voice lines
  const jobs = [];
  const index = {};
  for (const slug of VOICE_SLUGS) {
    const dir = src("audio", slug);
    const lines = fs
      .readdirSync(dir)
      .map((f) => ({ f, m: f.match(/^(\d{2})_.*\.flac$/) }))
      .filter((x) => x.m)
      .map((x) => ({ n: parseInt(x.m[1], 10), file: path.join(dir, x.f) }))
      .sort((a, b) => a.n - b.n);
    index[slug] = [];
    for (const l of lines) jobs.push({ slug, ...l });
    // Sanity: numbering is contiguous.
    const missing = [];
    for (let i = 1; i <= lines[lines.length - 1].n; i++)
      if (!lines.some((l) => l.n === i)) missing.push(i);
    if (missing.length)
      notes.push({ about: `voice/${slug}`, note: `Source has no line(s) ${missing.join(", ")}.` });
  }
  log("audio", `${jobs.length} voice lines, concurrency ${Math.max(CONCURRENCY, 4)}`);
  await pool(jobs, Math.max(CONCURRENCY, 4), async (j) => {
    const out = pub("audio", "voice", j.slug, `${pad2(j.n)}.m4a`);
    if (!isFresh(out, j.file)) {
      await encodeVoice(j.file, out);
      wrote++;
    }
    const info = await mediaInfo(out);
    const durationSec = Math.round(info.duration * 100) / 100;
    index[j.slug].push({ n: j.n, file: `${pad2(j.n)}.m4a`, durationSec });
    records.push({
      id: `voice-${j.slug}-${pad2(j.n)}`,
      kind: "audio",
      path: rel(out),
      bytes: await fileSize(out),
      durationSec,
      pair: PAIR_OF[j.slug],
      slug: j.slug,
      role: "voice-line",
      source: srcRel(j.file),
    });
  });
  for (const slug of VOICE_SLUGS) {
    index[slug].sort((a, b) => a.n - b.n);
    const out = pub("audio", "voice", slug, "index.json");
    await writeJson(out, index[slug]);
    records.push({
      id: `voice-${slug}-index`,
      kind: "data",
      path: rel(out),
      bytes: await fileSize(out),
      pair: PAIR_OF[slug],
      slug,
      role: "voice-index",
      source: `audio/${slug}/*.flac`,
      notes: "[{n, file, durationSec}], file relative to this folder.",
    });
  }

  // ---- music
  for (const m of MUSIC) {
    const input = src(m.from);
    const out = pub("audio", "music", `${m.name}.m4a`);
    if (!isFresh(out, input)) {
      await ensureDirFor(out);
      await ffmpeg([
        "-i",
        input,
        "-vn",
        "-c:a",
        "aac",
        "-b:a",
        "96k",
        "-ar",
        "44100",
        "-ac",
        "2",
        "-movflags",
        "+faststart",
        out,
      ]);
      wrote++;
    }
    const info = await mediaInfo(out);
    records.push({
      id: `music-${m.name}`,
      kind: "audio",
      path: rel(out),
      bytes: await fileSize(out),
      durationSec: Math.round(info.duration * 100) / 100,
      pair: m.pair,
      slug: m.slug,
      role: "music",
      source: m.from,
      notes: m.notes,
    });
  }

  // ---- what the per-character compilations are
  skipped.push({
    what: "audio/{slug}/{slug}.m4a for angela, change, fanny, guinevere, layla, lesley, ruby, selena, vexana",
    why: "Voice-line compilations, not music: mono 44.1 kHz AAC at about 264 kbps, with a gap of 1 to 2 s between short bursts of speech (36 silence gaps over the 143 s layla.m4a, which holds the same 28 lines). Not shipped as themes; the individual lines are shipped under audio/voice instead.",
  });
  skipped.push({
    what: "audio/obsidia/long/obsidia.m4a",
    why: "Same signature as the per-character compilations (mono, 264 kbps, 61 discrete speech bursts over 275 s; spectrogram shows isolated voice lines with no music bed). Not shipped as obsidia-long.",
  });
  skipped.push({ what: "audio/source/*.mp4", why: "Raw source recordings; never shipped." });

  log("audio", `${wrote} files written (others up to date)`);
  await saveStage(
    "audio",
    records.sort((a, b) => a.id.localeCompare(b.id)),
    { skipped, notes },
  );
}
