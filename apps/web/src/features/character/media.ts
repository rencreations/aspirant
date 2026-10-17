/**
 * Build-time media lists for the character pages. Reads the asset pipeline's JSON (the
 * manifest, the fan art list and the voice indexes) during the static build.
 *
 * Server only: import this from `app/` pages and pass the slim results to client islands,
 * so none of the JSON ships to the browser.
 */
import fanartData from "../../../public/data/fanart.json";
import manifest from "../../../public/data/manifest.json";
import angelaVoice from "../../../public/audio/voice/angela/index.json";
import changeVoice from "../../../public/audio/voice/change/index.json";
import fannyVoice from "../../../public/audio/voice/fanny/index.json";
import guinevereVoice from "../../../public/audio/voice/guinevere/index.json";
import laylaVoice from "../../../public/audio/voice/layla/index.json";
import lesleyVoice from "../../../public/audio/voice/lesley/index.json";
import obsidiaVoice from "../../../public/audio/voice/obsidia/index.json";
import rubyVoice from "../../../public/audio/voice/ruby/index.json";
import selenaVoice from "../../../public/audio/voice/selena/index.json";
import vexanaVoice from "../../../public/audio/voice/vexana/index.json";
import type { PairId, Slug } from "@/content/types";

interface VoiceIndexRow {
  readonly n: number;
  readonly file: string;
  readonly durationSec: number;
}

const VOICE_INDEX: Readonly<Record<Slug, readonly VoiceIndexRow[]>> = {
  fanny: fannyVoice,
  layla: laylaVoice,
  ruby: rubyVoice,
  angela: angelaVoice,
  lesley: lesleyVoice,
  change: changeVoice,
  guinevere: guinevereVoice,
  vexana: vexanaVoice,
  obsidia: obsidiaVoice,
  selena: selenaVoice,
};

/** Voice line number to duration in seconds, from `audio/voice/{slug}/index.json`. */
export function voiceDurations(slug: Slug): Record<number, number> {
  return Object.fromEntries(VOICE_INDEX[slug].map((row) => [row.n, row.durationSec]));
}

/** One fan art piece, ready for a frame and the lightbox. Paths are public paths. */
export interface FanArtItem {
  readonly id: string;
  readonly title: string;
  readonly credit: string;
  /** Link to the original, or null when none is known. */
  readonly url: string | null;
  readonly src: string;
  readonly srcSm: string;
  readonly width: number;
  readonly height: number;
  /** Who it shows: "fanny", "layla" or "both". */
  readonly who: string;
}

interface FanArtRow {
  readonly id: string;
  readonly character: string;
  readonly title: string;
  readonly credit: string;
  readonly url: string | null;
  readonly file: string;
  readonly fileSm: string;
  readonly width: number;
  readonly height: number;
}

/** Fan art of this character (pieces of her and of the pair). Only Fanny and Layla have any. */
export function fanArtFor(slug: Slug): FanArtItem[] {
  const rows = (fanartData as { items: readonly FanArtRow[] }).items;
  return rows
    .filter((row) => row.character === slug || (row.character === "both" && isFannyOrLayla(slug)))
    .sort((a, b) => Number(a.character === "both") - Number(b.character === "both"))
    .map((row) => ({
      id: row.id,
      title: row.title,
      credit: row.credit,
      url: row.url,
      src: `/${row.file}`,
      srcSm: `/${row.fileSm}`,
      width: row.width,
      height: row.height,
      who: row.character,
    }));
}

function isFannyOrLayla(slug: Slug): boolean {
  return slug === "fanny" || slug === "layla";
}

/** One video of a pair. Paths are public paths. */
export interface VideoItem {
  readonly id: string;
  readonly title: string;
  readonly src: string;
  readonly poster: string;
  /** English captions or lyrics (WebVTT), when the source had a subtitle file. */
  readonly captions: string | null;
  readonly width: number;
  readonly height: number;
  readonly durationSec: number;
}

/** Literal labels for the pipeline's video names. Our copy. */
const VIDEO_TITLES: Readonly<Record<string, string>> = {
  trailer: "Trailer",
  teaser: "Teaser",
  "skin-showcase": "Skin showcase",
  "music-video": "Music video",
  "music-bts": "Music, behind the scenes",
  "music-producer-talk": "Talk with the producer",
  "idea-bts": "The idea, behind the scenes",
  "short-animation": "Short animation",
  qna: "Questions and answers",
  rerun: "Rerun",
  "3d-process": "3D process",
  "comic-video": "Comic video",
  "heart-short-dance": "Heart dance, short",
  "interactive-drama": "Interactive drama",
  relink: "Relink",
  "short-splash-art-showcase": "Splash art showcase, short",
  sleeping: "Sleeping, short",
  "selena-short-showcase": "Selena showcase, short",
  ruby: "Ruby",
  angela: "Angela",
  selena: "Selena",
  obsidia: "Obsidia",
};

interface ManifestRow {
  readonly kind: string;
  readonly path: string;
  readonly width?: number;
  readonly height?: number;
  readonly durationSec?: number;
  readonly pair?: string;
}

/**
 * Every video of a pair: the character's own film first, then the trailer, then the rest in
 * the pipeline's order.
 */
export function videosFor(pair: PairId, slug: Slug): VideoItem[] {
  const rows = (manifest as { assets: readonly ManifestRow[] }).assets;
  const paths = new Set(rows.map((row) => row.path));
  const videos = rows
    .filter((row) => row.kind === "video" && row.path.startsWith(`video/${pair}/`))
    .map((row): VideoItem => {
      const name = row.path.slice(`video/${pair}/`.length).replace(/\.mp4$/, "");
      const base = `video/${pair}/${name}`;
      return {
        id: name,
        title: VIDEO_TITLES[name] ?? name.replace(/-/g, " "),
        src: `/${base}.mp4`,
        poster: `/${base}.jpg`,
        captions: paths.has(`${base}.vtt`) ? `/${base}.vtt` : null,
        width: row.width ?? 1280,
        height: row.height ?? 720,
        durationSec: row.durationSec ?? 0,
      };
    });
  const rank = (v: VideoItem) => (v.id === slug ? 0 : v.id === "trailer" ? 1 : 2);
  return videos
    .map((video, index) => ({ video, index }))
    .sort((a, b) => rank(a.video) - rank(b.video) || a.index - b.index)
    .map(({ video }) => video);
}
