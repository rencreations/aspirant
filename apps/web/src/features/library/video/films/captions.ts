/**
 * English captions of a film. The library serves them from another origin, and a `<track>` from
 * another origin would need the film itself fetched with CORS. So the WebVTT text is fetched here,
 * read into cues, and put on the film as a hidden text track built in script. The browser keeps the
 * timing (`cuechange`) and the room draws the line in its own style.
 */

export interface Cue {
  start: number;
  end: number;
  text: string;
}

/** `00:01:02.500` or `01:02.500` in seconds. */
function seconds(stamp: string): number {
  const parts = stamp.trim().replace(",", ".").split(":").map(Number);
  if (parts.some((p) => !Number.isFinite(p))) return Number.NaN;
  return Math.round(parts.reduce((total, p) => total * 60 + p, 0) * 1000) / 1000;
}

/** The cues of a WebVTT file. Tags (`<i>`) are dropped; settings after the times are ignored. */
export function parseVtt(text: string): Cue[] {
  const cues: Cue[] = [];
  const blocks = text.replace(/\r\n?/g, "\n").split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l.trim() !== "");
    const at = lines.findIndex((l) => l.includes("-->"));
    if (at === -1) continue;
    const [from = "", rest = ""] = lines[at]!.split("-->");
    const start = seconds(from);
    const end = seconds(rest.trim().split(/\s+/)[0] ?? "");
    const words = lines
      .slice(at + 1)
      .join("\n")
      .replace(/<[^>]+>/g, "")
      .trim();
    if (Number.isFinite(start) && Number.isFinite(end) && end > start && words) {
      cues.push({ start, end, text: words });
    }
  }
  return cues;
}

const loaded = new Map<string, Promise<Cue[]>>();

/** Fetch and read a caption file once per visit. A file that cannot be read gives no cues. */
export function loadCues(url: string): Promise<Cue[]> {
  let p = loaded.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(parseVtt);
    p.catch(() => loaded.delete(url));
    loaded.set(url, p);
  }
  return p;
}

const tracks = new WeakMap<HTMLVideoElement, TextTrack>();

/**
 * The hidden caption track of a film, made once per video element. Returns null when the browser
 * cannot make one (the room then shows no captions).
 */
export function captionTrack(video: HTMLVideoElement, cues: readonly Cue[]): TextTrack | null {
  const known = tracks.get(video);
  if (known) return known;
  if (typeof video.addTextTrack !== "function" || typeof VTTCue === "undefined") return null;
  const track = video.addTextTrack("subtitles", "English", "en");
  track.mode = "hidden";
  for (const cue of cues) track.addCue(new VTTCue(cue.start, cue.end, cue.text));
  tracks.set(video, track);
  return track;
}

/** The words on screen now on a track. */
export function activeText(track: TextTrack): string {
  const active = track.activeCues;
  if (!active || active.length === 0) return "";
  const out: string[] = [];
  for (const cue of Array.from(active) as VTTCue[]) {
    if (cue.text) out.push(cue.text);
  }
  return out.join("\n");
}
