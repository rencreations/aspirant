/**
 * The collection catalog: turns the asset manifest, the fan art credits, the comic index and
 * the voice lines into typed items with human titles, pair and character tags, durations and
 * credits.
 *
 * Server only. The page builds the catalog once at export time and hands the client a slim
 * `ClientCatalog` (see `toClientCatalog`). Never import this module from a client component:
 * it pulls in the whole manifest.
 */
import comicsJson from "../../../public/data/comics.json";
import fanartJson from "../../../public/data/fanart.json";
import manifestJson from "../../../public/data/manifest.json";

import { characters } from "@/content/characters";
import { getPair, pairs } from "@/content/pairs";
import { SLUGS, type PairId, type Slug } from "@/content/types";
import { CHARACTER_NAMES } from "@/lib/slugs";

import { formatDuration, pad2 } from "./format";
import { CATEGORY_RANK, FILM_TITLES, MUSIC_TITLES, PAIR_ART_TITLES, PAIR_RANK } from "./titles";
import type {
  ArtItem,
  Catalog,
  ClientCatalog,
  ComicItem,
  FanArtItem,
  FilmItem,
  ModelItem,
  SectionId,
  TrackItem,
  VoiceItem,
} from "./types";

// Source shapes ---------------------------------------------------------------------------

export interface ManifestAsset {
  id: string;
  kind: string;
  path: string;
  bytes: number;
  width?: number;
  height?: number;
  durationSec?: number;
  pair?: string;
  slug?: string;
  role?: string;
  credit?: string;
}

export interface ManifestFile {
  assets: readonly ManifestAsset[];
}

export interface FanartRecord {
  id: string;
  character: "fanny" | "layla" | "both";
  site: string;
  artist: string | null;
  title: string | null;
  url: string | null;
  urlConfidence: "high" | "medium" | "none";
  credit: string;
  color: string;
  file: string;
  fileSm: string;
  width: number;
  height: number;
}

export interface FanartFile {
  items: readonly FanartRecord[];
}

export interface ComicsFile {
  comics: Readonly<
    Record<
      string,
      {
        title: string;
        pageCount: number;
        missingPages: readonly number[];
        pages: readonly { file: string; width: number; height: number; page: number }[];
      }
    >
  >;
}

export interface CatalogSources {
  manifest: ManifestFile;
  fanart: FanartFile;
  comics: ComicsFile;
}

// Helpers ---------------------------------------------------------------------------------

const isSlug = (value: string | undefined): value is Slug =>
  value !== undefined && (SLUGS as readonly string[]).includes(value);

const isPairId = (value: string | undefined): value is PairId =>
  value !== undefined && pairs.some((p) => p.id === value);

function pairMembers(pair: PairId): readonly Slug[] {
  return getPair(pair).members;
}

function nameOf(slug: Slug): string {
  return CHARACTER_NAMES[slug];
}

const FILM_ROLES_FOR_ONE: Readonly<Record<string, Slug>> = {
  ruby: "ruby",
  angela: "angela",
  selena: "selena",
  obsidia: "obsidia",
  "selena-short-showcase": "selena",
};

const base = (path: string) => path.replace(/^.*\//, "").replace(/\.[^.]+$/, "");

/** Fan art titles that are only an id or a placeholder get a plain description instead. */
function cleanFanTitle(title: string | null, who: string): string {
  const t = (title ?? "").trim();
  const generic = /^(artstation|facebook|pixiv|reddit|post|untitled)\b/i.test(t);
  if (!t || generic || t.length > 56) return `${who}, fan art`;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// Builders --------------------------------------------------------------------------------

function buildFilms(assets: readonly ManifestAsset[]): FilmItem[] {
  const captionPaths = new Set(assets.filter((a) => a.role === "captions-en").map((a) => a.path));
  const posters = new Set(assets.filter((a) => a.role === "poster").map((a) => a.path));
  const films: FilmItem[] = [];
  for (const a of assets) {
    if (a.kind !== "video" || !isPairId(a.pair) || !a.role) continue;
    const key = `${a.pair}/${a.role}`;
    const entry = FILM_TITLES[key];
    if (!entry) throw new Error(`No title for video ${key}; add it to FILM_TITLES.`);
    const poster = a.path.replace(/\.mp4$/, ".jpg");
    if (!posters.has(poster)) throw new Error(`No poster for ${a.path}.`);
    const vtt = a.path.replace(/\.mp4$/, ".vtt");
    const width = a.width ?? 0;
    const height = a.height ?? 0;
    const one = FILM_ROLES_FOR_ONE[a.role];
    const pairNames = getPair(a.pair).names;
    const durationSec = a.durationSec ?? 0;
    films.push({
      id: a.id,
      kind: "film",
      title: entry.title,
      alt: `${pairNames}: ${entry.title}, ${entry.category.toLowerCase()}. Runs ${formatDuration(durationSec)}.`,
      pair: a.pair,
      characters: one ? [one] : pairMembers(a.pair),
      category: entry.category,
      src: a.path,
      poster,
      captions: captionPaths.has(vtt) ? vtt : null,
      width,
      height,
      vertical: height > width,
      durationSec,
    });
  }
  return films.sort(
    (x, y) =>
      CATEGORY_RANK[x.category] - CATEGORY_RANK[y.category] ||
      PAIR_RANK[x.pair ?? "fanny-layla"] - PAIR_RANK[y.pair ?? "fanny-layla"] ||
      x.title.localeCompare(y.title),
  );
}

function buildMusic(assets: readonly ManifestAsset[]): TrackItem[] {
  const tracks: TrackItem[] = [];
  for (const a of assets) {
    if (a.kind !== "audio" || a.role !== "music") continue;
    const entry = MUSIC_TITLES[base(a.path)];
    if (!entry) throw new Error(`No title for music ${a.path}; add it to MUSIC_TITLES.`);
    const cover = assets.find((c) => c.path === entry.cover);
    if (!cover?.width || !cover.height) throw new Error(`No cover for ${a.path}.`);
    const pair = isPairId(a.pair) ? a.pair : null;
    tracks.push({
      id: a.id,
      kind: "track",
      title: entry.title,
      alt: `Cover for ${entry.title}`,
      pair,
      characters: isSlug(a.slug) ? [a.slug] : pair ? pairMembers(pair) : [],
      src: a.path,
      durationSec: a.durationSec ?? 0,
      role: entry.role,
      credit: entry.credit,
      artist: entry.artist,
      cover: { src: cover.path, width: cover.width, height: cover.height },
    });
  }
  const order = Object.keys(MUSIC_TITLES);
  return tracks.sort((x, y) => order.indexOf(base(x.src)) - order.indexOf(base(y.src)));
}

function buildComics(comics: ComicsFile["comics"]): ComicItem[] {
  const spec: Record<string, { pair: PairId; title: string; alt: string }> = {
    aspirant: {
      pair: "fanny-layla",
      title: "The Aspirant",
      alt: "The Aspirant, a webtoon comic about Layla and Fanny. First page.",
    },
    "guinevere-vexana": {
      pair: "guinevere-vexana",
      title: "Guinevere and Vexana",
      alt: "Guinevere and Vexana, a webtoon comic. First page.",
    },
  };
  return Object.entries(comics).map(([comicId, comic]) => {
    const s = spec[comicId];
    if (!s) throw new Error(`Unknown comic ${comicId}.`);
    return {
      id: `comic-${comicId}`,
      kind: "comic",
      comicId: comicId as ComicItem["comicId"],
      title: s.title,
      alt: s.alt,
      pair: s.pair,
      characters: pairMembers(s.pair),
      pageCount: comic.pageCount,
      missingPages: comic.missingPages,
      pages: comic.pages,
    };
  });
}

function buildArt(assets: readonly ManifestAsset[]): ArtItem[] {
  const byPath = new Map(assets.map((a) => [a.path, a]));
  const items: ArtItem[] = [];
  const make = (
    full: ManifestAsset,
    thumb: ManifestAsset,
    title: string,
    artKind: ArtItem["artKind"],
    slug: Slug | null,
    pair: PairId | null,
    alpha: boolean,
  ) => {
    if (!full.width || !full.height || !thumb.width || !thumb.height) {
      throw new Error(`Missing size for ${full.path}.`);
    }
    items.push({
      id: full.id,
      kind: "art",
      title,
      alt: `${title}, official art`,
      artKind,
      pair,
      characters: slug ? [slug] : pair ? pairMembers(pair) : [],
      src: full.path,
      width: full.width,
      height: full.height,
      thumb: thumb.path,
      thumbWidth: thumb.width,
      thumbHeight: thumb.height,
      alpha,
    });
  };

  for (const slug of SLUGS) {
    const full = byPath.get(`img/char/${slug}/splash.webp`);
    const thumb = byPath.get(`img/char/${slug}/splash-sm.webp`);
    if (full && thumb) {
      make(
        full,
        thumb,
        `${nameOf(slug)}, splash art`,
        "Splash art",
        slug,
        characterPair(slug),
        false,
      );
    }
  }
  for (const a of assets) {
    if (!a.path.startsWith("img/pair/") || a.kind !== "image" || !isPairId(a.pair)) continue;
    const title = PAIR_ART_TITLES[base(a.path)];
    if (!title) throw new Error(`No title for pair art ${a.path}.`);
    make(a, a, title, "Pair art", null, a.pair, false);
  }
  for (const slug of SLUGS) {
    const cut = byPath.get(`img/char/${slug}/cutout.webp`);
    if (cut) make(cut, cut, `${nameOf(slug)}, cutout`, "Cutout", slug, characterPair(slug), true);
  }
  const fannyPose = byPath.get("img/char/fanny/extra-1.webp");
  if (fannyPose) {
    make(fannyPose, fannyPose, "Fanny, flying pose", "Pose", "fanny", "fanny-layla", true);
  }
  const vexanaWall = byPath.get("img/char/vexana/extra-1.webp");
  if (vexanaWall) {
    make(
      vexanaWall,
      vexanaWall,
      "Vexana, mobile wallpaper",
      "Wallpaper",
      "vexana",
      "guinevere-vexana",
      false,
    );
  }
  return items;
}

function characterPair(slug: Slug): PairId {
  const found = pairs.find((p) => p.members.includes(slug));
  if (!found) throw new Error(`No pair for ${slug}.`);
  return found.id;
}

function buildFanArt(
  records: readonly FanartRecord[],
  assets: readonly ManifestAsset[],
): FanArtItem[] {
  const byPath = new Map(assets.map((a) => [a.path, a]));
  return records.map((r) => {
    const small = byPath.get(r.fileSm);
    if (!small?.width || !small.height) throw new Error(`No size for ${r.fileSm}.`);
    const characterList: readonly Slug[] =
      r.character === "both" ? ["fanny", "layla"] : [r.character];
    const who = characterList.map(nameOf).join(" and ");
    const title = cleanFanTitle(r.title, who);
    const trusted = r.url !== null && r.urlConfidence !== "none";
    return {
      id: `fanart-${r.id}`,
      kind: "fanart",
      title,
      alt: `Fan art of ${who}, "${title}". ${r.credit}.`,
      pair: "fanny-layla",
      characters: characterList,
      src: r.file,
      width: r.width,
      height: r.height,
      thumb: r.fileSm,
      thumbWidth: small.width,
      thumbHeight: small.height,
      artist: r.artist,
      credit: r.credit,
      url: trusted ? r.url : null,
      color: r.color,
    };
  });
}

function buildModels(assets: readonly ManifestAsset[]): ModelItem[] {
  const models: ModelItem[] = [];
  for (const a of assets) {
    if (a.kind !== "model" || !isSlug(a.slug) || !isPairId(a.pair)) continue;
    const poster = assets.find((p) => p.path === `img/char/${a.slug}/cutout.webp`);
    if (!poster?.width || !poster.height) throw new Error(`No poster for model ${a.slug}.`);
    const emotes = assets
      .filter((e) => e.role === "emote" && e.slug === a.slug)
      .map((e) => e.path)
      .sort();
    models.push({
      id: a.id,
      kind: "model",
      slug: a.slug,
      title: `${nameOf(a.slug)}, 3D model`,
      alt: `${nameOf(a.slug)}, cutout art shown while the 3D model loads`,
      pair: a.pair,
      characters: [a.slug],
      src: a.path,
      poster: { src: poster.path, width: poster.width, height: poster.height },
      emotes,
    });
  }
  const order: Slug[] = ["layla", "fanny"];
  return models.sort((x, y) => order.indexOf(x.slug) - order.indexOf(y.slug));
}

function buildVoice(assets: readonly ManifestAsset[]): VoiceItem[] {
  const duration = new Map(
    assets.filter((a) => a.role === "voice-line").map((a) => [a.path, a.durationSec ?? 0]),
  );
  const items: VoiceItem[] = [];
  for (const character of characters) {
    for (const line of character.voice) {
      items.push({
        id: `voice-${character.slug}-${pad2(line.n)}`,
        kind: "voice",
        slug: character.slug,
        n: line.n,
        title: `${character.name}, line ${line.n}`,
        alt: `${character.name}, voice line ${line.n}: ${line.en}`,
        pair: character.pair,
        characters: [character.slug],
        jpTitle: line.jpTitle,
        en: line.en,
        file: line.file,
        durationSec: duration.get(line.file) ?? 0,
      });
    }
  }
  return items;
}

/** Build the whole catalog from the sources. Pure: tests feed it the real files. */
export function buildCatalog({ manifest, fanart, comics }: CatalogSources): Catalog {
  const films = buildFilms(manifest.assets);
  const music = buildMusic(manifest.assets);
  const comicItems = buildComics(comics.comics);
  const art = buildArt(manifest.assets);
  const fan = buildFanArt(fanart.items, manifest.assets);
  const models = buildModels(manifest.assets);
  const voice = buildVoice(manifest.assets);

  const sum = (list: readonly { durationSec: number }[]) =>
    list.reduce((total, item) => total + item.durationSec, 0);
  const counts: Record<SectionId, number> = {
    films: films.length,
    music: music.length,
    comics: comicItems.length,
    art: art.length,
    fanart: fan.length,
    models: models.length,
    voice: voice.length,
  };
  const filmSeconds = sum(films);
  const musicSeconds = sum(music);
  const voiceSeconds = sum(voice);
  return {
    films,
    music,
    comics: comicItems,
    art,
    fanart: fan,
    models,
    voice,
    stats: {
      counts,
      filmSeconds,
      musicSeconds,
      voiceSeconds,
      totalSeconds: filmSeconds + musicSeconds + voiceSeconds,
    },
  };
}

/** The catalog built from the committed data files. */
export function loadCatalog(): Catalog {
  return buildCatalog({
    manifest: manifestJson as unknown as ManifestFile,
    fanart: fanartJson as unknown as FanartFile,
    comics: comicsJson as unknown as ComicsFile,
  });
}

/** Strip the voice items down to durations for the client. */
export function toClientCatalog(catalog: Catalog): ClientCatalog {
  const { voice, ...rest } = catalog;
  const voiceDurations = Object.fromEntries(SLUGS.map((slug) => [slug, [] as number[]])) as Record<
    Slug,
    number[]
  >;
  for (const line of voice) voiceDurations[line.slug][line.n - 1] = line.durationSec;
  return { ...rest, voiceDurations };
}
