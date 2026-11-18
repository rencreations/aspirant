// Checks the voice gain through a copy of the real audio graph, in real Chrome, offline.
//
//   node scripts/library/voicelines/verify_gain.cjs [--sample 30]
//
// It picks the ten quietest and the ten loudest lines of the room (by the loudness measured by loudness.py), plus a
// seeded sample, plays each one through
//
//   source -> gain (voiceLevel(1, g)) -> voiceBus (VOICE_BUS_GAIN) -> analyser -> master -> compressor -> destination
//
// in an OfflineAudioContext (the numbers of the bus and the compressor are read from apps/web/src/lib/audio.ts and
// voice-gain.ts, so the copy cannot drift), once without the gain and once with it, writes the result to a WAV
// and measures it with ffmpeg ebur128. The pass criterion is the spread after the gain (about 2 LU or less). The
// absolute level lands below the -18 LUFS target because the compressor's soft knee takes a little off the peaks.
//
// Files go to D:\ren\aspirant-work\home\D\verify-gain (never to C:). The mirror is read only.
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { createRequire } = require("node:module");

const ROOT = path.resolve(__dirname, "../../..");
const web = createRequire(path.join(ROOT, "apps/web/package.json"));
const { chromium } = web("@playwright/test");

const MIRROR = process.env.ASPIRANT_R2_MIRROR || "D:\\ren\\aspirant-r2";
const LIB = path.join(MIRROR, "library", "v1");
const OUT = process.env.OUT || "D:\\ren\\aspirant-work\\home\\D\\verify-gain";
fs.mkdirSync(OUT, { recursive: true });

const sampleArg = process.argv.indexOf("--sample");
const SAMPLE = sampleArg > 0 ? Number(process.argv[sampleArg + 1]) : 30;

/** The numbers of the real graph. */
function graphNumbers() {
  const audio = fs.readFileSync(path.join(ROOT, "apps/web/src/lib/audio.ts"), "utf8");
  const gain = fs.readFileSync(path.join(ROOT, "apps/web/src/lib/voice-gain.ts"), "utf8");
  const grab = (src, re, what) => {
    const m = re.exec(src);
    if (!m) throw new Error(`cannot read ${what}`);
    return Number(m[1]);
  };
  return {
    bus: grab(gain, /VOICE_BUS_GAIN\s*=\s*([\d.]+)/, "VOICE_BUS_GAIN"),
    threshold: grab(audio, /comp\.threshold\.value\s*=\s*(-?[\d.]+)/, "compressor threshold"),
    ratio: grab(audio, /comp\.ratio\.value\s*=\s*([\d.]+)/, "compressor ratio"),
    minDb: grab(gain, /MIN_GAIN_DB\s*=\s*(-?[\d.]+)/, "MIN_GAIN_DB"),
    maxDb: grab(gain, /MAX_GAIN_DB\s*=\s*(-?[\d.]+)/, "MAX_GAIN_DB"),
  };
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Every line of the room with its gain and its measured loudness. */
function lines() {
  const loud = JSON.parse(fs.readFileSync(path.join(__dirname, "loudness.json"), "utf8"));
  const out = [];
  for (const slug of [
    "fanny",
    "layla",
    "ruby",
    "angela",
    "lesley",
    "change",
    "guinevere",
    "vexana",
    "obsidia",
    "selena",
  ]) {
    const data = JSON.parse(
      fs.readFileSync(
        path.join(ROOT, "apps/web/public/data/library", `voicelines-${slug}.json`),
        "utf8",
      ),
    );
    for (const [lang, rows] of Object.entries(data.langs)) {
      for (const r of rows) {
        if (r.d === undefined) continue;
        const nn = String(r.n).padStart(2, "0");
        const key =
          lang === "jp" ? `voicelines/${slug}/${nn}.m4a` : `voicelines/${slug}/${lang}/${nn}.m4a`;
        out.push({ slug, lang, n: r.n, key, g: r.g, i: loud[key].i });
      }
    }
  }
  return out;
}

function pick(all) {
  const byLoud = [...all].sort((a, b) => a.i - b.i);
  const quiet = byLoud.slice(0, 10);
  const loudest = byLoud.slice(-10);
  const rand = mulberry32(20261118);
  const rest = all.filter((l) => !quiet.includes(l) && !loudest.includes(l));
  const sample = [];
  while (sample.length < SAMPLE && rest.length)
    sample.push(rest.splice(Math.floor(rand() * rest.length), 1)[0]);
  return [
    ...quiet.map((l) => ({ ...l, set: "quietest" })),
    ...loudest.map((l) => ({ ...l, set: "loudest" })),
    ...sample.map((l) => ({ ...l, set: "sample" })),
  ];
}

function serve() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end("<!doctype html><title>gain</title>");
      return;
    }
    const file = path.join(LIB, decodeURIComponent(url.pathname.replace(/^\/m\//, "")));
    if (!file.startsWith(LIB) || !fs.existsSync(file)) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { "content-type": "audio/mp4" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

function writeWav(file, left, right, rate) {
  const n = left.length;
  const buf = Buffer.alloc(44 + n * 8);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 8, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(3, 20); // IEEE float
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 8, 28);
  buf.writeUInt16LE(8, 32);
  buf.writeUInt16LE(32, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 8, 40);
  for (let i = 0; i < n; i++) {
    buf.writeFloatLE(left[i], 44 + i * 8);
    buf.writeFloatLE(right[i], 48 + i * 8);
  }
  fs.writeFileSync(file, buf);
}

function lufs(file) {
  const r = spawnSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-nostats",
      "-nostdin",
      "-i",
      file,
      "-af",
      "ebur128=peak=true",
      "-f",
      "null",
      "-",
    ],
    {
      encoding: "utf8",
    },
  );
  const tail = r.stderr.slice(r.stderr.lastIndexOf("Summary:"));
  const i = /I:\s+(-?[\d.]+)\s+LUFS/.exec(tail);
  const p = /Peak:\s+(-?[\d.]+)\s+dBFS/.exec(tail);
  return { i: i ? Number(i[1]) : NaN, tp: p ? Number(p[1]) : NaN };
}

const stats = (xs) => {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
  return {
    mean: m,
    sd,
    min: Math.min(...xs),
    max: Math.max(...xs),
    spread: Math.max(...xs) - Math.min(...xs),
  };
};

(async () => {
  const numbers = graphNumbers();
  const chosen = pick(lines());
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage();
  await page.goto(base);

  // Runs in the page: the graph of audio.ts, rendered offline.
  const render = async ({ url, level, numbers }) => {
    const data = await (await fetch(url)).arrayBuffer();
    const probe = new OfflineAudioContext(2, 1, 44100);
    const decoded = await probe.decodeAudioData(data);
    const tail = Math.ceil(decoded.sampleRate * 0.6);
    const ctx = new OfflineAudioContext(2, decoded.length + tail, decoded.sampleRate);
    const master = ctx.createGain();
    master.gain.value = 1;
    if (numbers.bypass) master.connect(ctx.destination);
    else {
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = numbers.threshold;
      comp.ratio.value = numbers.ratio;
      master.connect(comp).connect(ctx.destination);
    }
    const analyser = ctx.createAnalyser();
    const bus = ctx.createGain();
    bus.gain.value = numbers.bus;
    bus.connect(analyser).connect(master);
    const gain = ctx.createGain();
    gain.gain.value = level;
    const src = ctx.createBufferSource();
    src.buffer = decoded;
    src.connect(gain).connect(bus);
    src.start();
    const out = await ctx.startRendering();
    const pack = (arr) => {
      let s = "";
      const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
      for (let i = 0; i < bytes.length; i += 0x8000)
        s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return btoa(s);
    };
    return { rate: out.sampleRate, l: pack(out.getChannelData(0)), r: pack(out.getChannelData(1)) };
  };

  const rows = [];
  for (const [k, c] of chosen.entries()) {
    const url = `${base}/m/${c.key}`;
    const row = { ...c };
    for (const mode of ["raw", "leveled", "leveledNoComp"]) {
      const db = mode === "raw" ? 0 : Math.min(numbers.maxDb, Math.max(numbers.minDb, c.g));
      const res = await page.evaluate(render, {
        url,
        level: 10 ** (db / 20),
        numbers: { ...numbers, bypass: mode === "leveledNoComp" },
      });
      const l = new Float32Array(Buffer.from(res.l, "base64").buffer.slice(0));
      const r = new Float32Array(Buffer.from(res.r, "base64").buffer.slice(0));
      const wav = path.join(
        OUT,
        `${String(k).padStart(2, "0")}-${c.set}-${c.slug}-${c.lang}-${c.n}-${mode}.wav`,
      );
      writeWav(wav, l, r, res.rate);
      row[mode] = lufs(wav);
      fs.unlinkSync(wav);
    }
    rows.push(row);
    process.stdout.write(`${k + 1}/${chosen.length} `);
  }
  console.log("");
  await browser.close();
  server.close();

  const fmt = (x) => x.toFixed(1).padStart(6);
  console.log(
    `graph numbers: bus ${numbers.bus}, compressor threshold ${numbers.threshold} dB, ratio ${numbers.ratio}`,
  );
  console.log(
    "set        clip                    in file   g     raw out   leveled out  leveled peak  no compressor",
  );
  for (const r of rows) {
    console.log(
      `${r.set.padEnd(9)}  ${`${r.slug} ${r.lang} ${String(r.n).padStart(2, "0")}`.padEnd(22)} ${fmt(r.i)}  ${fmt(r.g)}  ${fmt(r.raw.i)}    ${fmt(r.leveled.i)}       ${fmt(r.leveled.tp)}       ${fmt(r.leveledNoComp.i)} (peak ${fmt(r.leveledNoComp.tp)})`,
    );
  }
  for (const [name, subset] of [
    ["all", rows],
    ["quietest 10", rows.filter((r) => r.set === "quietest")],
    ["loudest 10", rows.filter((r) => r.set === "loudest")],
    ["sample", rows.filter((r) => r.set === "sample")],
  ]) {
    const raw = stats(subset.map((r) => r.raw.i));
    const lev = stats(subset.map((r) => r.leveled.i));
    console.log(
      `${name.padEnd(12)} raw: mean ${fmt(raw.mean)} sd ${raw.sd.toFixed(2)} spread ${raw.spread.toFixed(1)} LU   leveled: mean ${fmt(lev.mean)} sd ${lev.sd.toFixed(2)} spread ${lev.spread.toFixed(1)} LU (${lev.min.toFixed(1)} to ${lev.max.toFixed(1)})`,
    );
  }
  const all = stats(rows.map((r) => r.leveled.i));
  const maxPeak = Math.max(...rows.map((r) => r.leveled.tp));
  console.log(`worst true peak after the graph: ${maxPeak.toFixed(1)} dBFS`);
  if (all.spread > 2.5) {
    console.log("FAIL: the spread after the gain is above 2.5 LU");
    process.exit(1);
  }
})();
