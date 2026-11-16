import type { Route } from "next";

import type { PlayerVideo } from "@/components/video-player/player-overlay";
import { libUrl } from "@/lib/library";

import comicFile from "../../../public/data/library/comic.json";
import musicFile from "../../../public/data/library/music.json";
import filmsFile from "../../../public/data/library/video-films.json";
import othersFile from "../../../public/data/library/video-others.json";

import type {
  PhaseArt,
  PhaseComic,
  PhaseDrama,
  PhaseMedia,
  PhaseTrack,
  PhaseVideo,
} from "./sections/phase/types";

/**
 * What each phase shows beside its two skins, made from the collection's own data files. This
 * module reads those files whole, so it is used on the server only (`sections/phases.tsx` calls
 * `phaseMedia` while the page is built) and only the few records a phase needs travel to the page.
 *
 * Nothing is copied for the About page: a video, a track or a cover is the collection's own file,
 * named here by its id. The lists and their order are the owner's (15 Nov 2026, second round).
 */

/**
 * How a link from this page says where the visitor came from, so the page it opens leads back
 * here (`lib/return-to.ts`). A link of a phase also says which phase (`placed`, below).
 */
const FROM = "from=about";

/** The same link with the phase it is pressed in (`at=phase-4`): the way back opens the page there. */
function at<T extends { readonly href: Route }>(record: T, phase: number): T {
  return { ...record, href: `${record.href}&at=phase-${phase}` as Route };
}

/** A phase's records, every link of them saying that it leaves from that phase. */
function placed(media: PhaseMedia, phase: number): PhaseMedia {
  const { musicVideo, comic, drama } = media;
  return {
    ...media,
    videos: media.videos.map((v) => at(v, phase)),
    tracks: media.tracks.map((t) => at(t, phase)),
    ...(musicVideo ? { musicVideo: at(musicVideo, phase) } : {}),
    ...(comic
      ? { comic: { ...at(comic, phase), ...(comic.film ? { film: at(comic.film, phase) } : {}) } }
      : {}),
    ...(drama ? { drama: at(drama, phase) } : {}),
  };
}

interface FilmRecord {
  id: string;
  title: string;
  kind: string;
  canon: string;
  desc?: string;
  thumb: string;
  video: {
    src: string;
    poster: string;
    w: number;
    h: number;
    dur: number;
    captions?: string;
    /** A film the site itself holds: a public path. */
    local?: string;
  };
}

const FILMS = new Map<string, FilmRecord>(
  [...filmsFile.items, ...othersFile.items].map((item) => [item.id, item as FilmRecord]),
);

/** The small label of each kind of video. */
const KIND: Readonly<Record<string, string>> = {
  "cinematic-trailer": "Cinematic trailer",
  "animated-trailer": "Animated trailer",
  "character-trailer": "Character trailer",
  animation: "Animated film",
  trailer: "Trailer",
  teaser: "Teaser",
  lore: "Story film",
  short: "Short",
  showcase: "Skin showcase",
  music: "Music video",
  "behind-the-scenes": "Behind the scenes",
  interview: "Interview",
  event: "Event",
  livestream: "Livestream",
  parody: "Parody",
};

/** The two rooms of the collection's video: the ten films and every other video. */
const FILM_ROOM = new Set(filmsFile.items.map((item) => item.id));

function video(id: string, pinned = false): PhaseVideo {
  const record = FILMS.get(id);
  if (!record) throw new Error(`The collection has no video called ${id}.`);
  const v = record.video;
  const src = v.src ? libUrl(v.src) : (v.local ?? "");
  if (!src) throw new Error(`The video ${id} has no file.`);
  const player: PlayerVideo = {
    title: record.title,
    poster: libUrl(v.poster),
    sources: [{ label: `${Math.min(v.w, v.h) >= 1080 ? 1080 : v.h}p`, height: v.h, src }],
    ...(v.captions ? { captions: libUrl(v.captions) } : {}),
  };
  const room = FILM_ROOM.has(id) ? "films" : "others";
  return {
    id,
    title: record.title,
    kind: KIND[record.kind] ?? "Video",
    pinned,
    duration: v.dur,
    ratio: v.w / v.h,
    thumb: libUrl(record.thumb),
    poster: libUrl(v.poster),
    ...(record.desc ? { note: record.desc } : {}),
    ...(record.canon !== "official" ? { nonCanon: true } : {}),
    player,
    href: `/collection/video/${room}?i=${encodeURIComponent(id)}&${FROM}` as Route,
  };
}

const LINK_NAMES: Readonly<Record<string, string>> = {
  spotify: "Spotify",
  apple: "Apple Music",
  youtube: "YouTube",
};

interface TrackRecord {
  id: string;
  ep: string;
  title: string;
  credits: Array<{ role: string; name: string }>;
  released: string;
  src: string;
  dur: number;
  /** Its own cover in the collection, or (for a track that was given none) a picture of the site. */
  cover: { p?: string; f?: string; c?: string; site?: string };
  links?: Record<string, string>;
  /** The face of the disc in the Music room. */
  disc?: string;
}

/** The colour that stands in for a cover that names none. */
const COVER_COLOUR = "#8f97a8";

function coverOf(record: TrackRecord): PhaseTrack["cover"] {
  const { p, f, c, site } = record.cover;
  if (p && f) return { small: libUrl(p), large: libUrl(f), colour: c ?? COVER_COLOUR };
  if (!site) throw new Error(`The track ${record.id} has no cover.`);
  // The site's small splash pictures have a large one beside them.
  const small = `/${site}`;
  return { small, large: small.replace("/splash-sm.webp", "/splash.webp"), colour: COVER_COLOUR };
}

function track(id: string): PhaseTrack {
  const record = (musicFile.items as TrackRecord[]).find((item) => item.id === id);
  if (!record) throw new Error(`The collection has no track called ${id}.`);
  const links = Object.entries(record.links ?? {})
    .filter(([key, href]) => key in LINK_NAMES && typeof href === "string" && href.length > 0)
    .map(([key, href]) => ({ label: LINK_NAMES[key] ?? key, href }));
  return {
    id,
    ep: record.ep,
    title: record.title,
    credits: record.credits,
    released: record.released,
    duration: record.dur,
    audio: libUrl(record.src),
    cover: coverOf(record),
    ...(record.disc ? { disc: libUrl(record.disc) } : {}),
    links,
    href: `/collection/music?i=${encodeURIComponent(id)}&${FROM}` as Route,
  };
}

type PanelName = keyof typeof comicFile.stage.panels;

function panel(name: PanelName, alt: string): PhaseArt {
  const p = comicFile.stage.panels[name];
  return { id: name, alt, src: libUrl(p.f), thumb: libUrl(p.p), w: p.w, h: p.h };
}

function comic(
  id: string,
  panels: ReadonlyArray<readonly [PanelName, string]>,
  film?: PhaseVideo,
): PhaseComic {
  const record = comicFile.items.find((item) => item.id === id);
  if (!record) throw new Error(`The collection has no comic called ${id}.`);
  return {
    slug: record.slug,
    title: record.title,
    pages: record.total,
    cover: {
      small: libUrl(record.cover.p),
      large: libUrl(record.cover.f),
      w: record.cover.w,
      h: record.cover.h,
      colour: record.cover.c,
    },
    panels: panels.map(([name, alt]) => panel(name, alt)),
    href: `/collection/comic/${record.slug}?${FROM}` as Route,
    ...(film ? { film } : {}),
  };
}

/** A splash picture the site holds for every Aspirant: 2048 by 1152. */
function splash(slug: string, name: string, title: string): PhaseArt {
  return {
    id: `splash-${slug}`,
    alt: `The official splash art of ${name}, ${title}`,
    src: `/img/char/${slug}/splash.webp`,
    thumb: `/img/char/${slug}/splash-sm.webp`,
    w: 2048,
    h: 1152,
  };
}

function pairArt(path: string, alt: string, w = 2048, h = 1152): PhaseArt {
  return { id: path, alt, src: path, thumb: path, w, h };
}

/** The episodes of the interactive drama whose pictures the section shows, in order. */
const DRAMA_STILLS = ["1", "2a", "3a", "4b", "5c", "6c"] as const;

const DRAMA: PhaseDrama = {
  title: "The interactive drama",
  chapters: 6,
  endings: 3,
  stills: DRAMA_STILLS.map((id) => ({
    id: `drama-${id}`,
    alt: "A scene of the official interactive drama",
    src: `/video/vexana/drama/${id}-poster.webp`,
    thumb: `/video/vexana/drama/${id}-thumb.webp`,
    w: 1280,
    h: 720,
  })),
  href: `/story/interactive-drama?${FROM}` as Route,
};

const LF = "film-layla-and-fanny-video-official";
const RA = "film-ruby-and-angela-video";
const LC = "film-lesley-and-change-video-official";
const VG = "film-vexana-and-guinevere-video";
const SO = "film-selena-and-obsidia-video";

/** The video the first screen of the page plays: how the series started. */
export function startVideo(): PhaseVideo {
  return video(`${LF}-other-idea-bts-idea`);
}

/** Everything the five phases add to their skins, in the order of release. */
export function phaseMedia(): readonly PhaseMedia[] {
  const phases: readonly PhaseMedia[] = [
    {
      videos: [
        video(`${LF}-lore-trailer-trailer`, true),
        video(`${LF}-lore-teaser-001-2753027083653666852`),
        video(`${LF}-other-skin-showcase-skin`),
        video(`${LF}-other-event-overview-001-2749282352243681631`),
        video(`${LF}-other-short-animation-short-animation-final`),
        video(`${LF}-other-live-action-live-action`),
        video(`${LF}-other-music-producer-talk-music-producer-talk`),
        video(`${LF}-other-va-bts-video`),
      ],
      tracks: [track("music-we-believe")],
      musicVideo: video(`${LF}-other-music-video-music`),
      comic: comic("comic-the-aspirant", [
        ["as-first", "The first panel of The Aspirant: the planet"],
        ["as-layla-sword", "Layla with her blade, a panel of The Aspirant"],
        ["as-fanny-face", "Fanny, a panel of The Aspirant"],
        ["as-duel", "Fanny above and Layla below, a panel of The Aspirant"],
        ["as-both", "Layla and Fanny at the end of The Aspirant"],
      ]),
      arts: [
        pairArt(
          "/img/about/arts/the-aspirants-key-art.webp",
          "The key art of The Aspirants: Fanny and Layla",
          1200,
          675,
        ),
        pairArt(
          "/img/pair/fanny-layla/fanny-and-layla.webp",
          "Official art of Fanny and Layla under a blue sky",
          1000,
          563,
        ),
        splash("fanny", "Fanny", "Blade of Kibou"),
        splash("layla", "Layla", "Miss Hikari"),
      ],
    },
    {
      videos: [
        video(`${RA}-trailer-trailer-final`, true),
        video(`${RA}-ruby-ruby-final`, true),
        video(`${RA}-angela-angela-final`, true),
        video(`${RA}-qna-qna-final`),
        video(`${RA}-revamp-revamp-final`),
        video(`${RA}-skin-showcase-skin-final`),
      ],
      tracks: [track("music-angela-ruby")],
      arts: [splash("angela", "Angela", "Cyber Cherubin"), splash("ruby", "Ruby", "Mecha Maiden")],
    },
    {
      videos: [
        video(`${LC}-trailer-o3ryhixwofw`, true),
        video(`${LC}-teaser-001-3307542160288522496`),
        video(`${LC}-short-trailer-001-3655463914612092690`),
        video(`${LC}-skin-showcase-final`),
      ],
      tracks: [track("music-change-lesley-display")],
      arts: [
        splash("change", "Chang'e", "Tech Tensai"),
        splash("lesley", "Lesley", "Deadeye Spectre"),
      ],
    },
    {
      videos: [
        video(`${VG}-connection-lost-final-video`, true),
        video(`${VG}-relink-final-video2`, true),
        video(`${VG}-3d-process-3d-process`),
        video(`${VG}-skin-showcase-skin-showcase`),
        video(`${VG}-splash-art-showcase-short-splash-art-showcase`),
        video(`${VG}-heart-short-dance-heart-short-dance`),
        video(`${VG}-livestream-challenge-live-guin`),
        video(`${VG}-livestream-challenge-live-vexana`),
        video(`${VG}-sleeping-sleeping`),
      ],
      tracks: [track("music-cross-credo-guinevere"), track("music-cross-credo-vexana")],
      drama: DRAMA,
      comic: comic(
        "comic-guinevere-vexana",
        [
          ["gv-first", "The first panel of Guinevere and Vexana"],
          ["gv-vexana", "Vexana, a panel of Guinevere and Vexana"],
          ["gv-close", "Guinevere and Vexana close together, a panel of the comic"],
          ["gv-gold", "A golden panel of Guinevere and Vexana"],
          ["gv-meadow", "The meadow, a panel of Guinevere and Vexana"],
        ],
        video(`${VG}-comic-comic-jp`),
      ),
      arts: [
        splash("guinevere", "Guinevere", "Daybreak Halo"),
        splash("vexana", "Vexana", "Twilight Star"),
        pairArt(
          "/img/pair/guinevere-vexana/both-splash-art.webp",
          "Official art of Guinevere and Vexana, the two sides of one picture",
        ),
        pairArt(
          "/img/pair/guinevere-vexana/fighting-moment.webp",
          "Official art of Vexana and Guinevere charging side by side",
        ),
        pairArt(
          "/img/pair/guinevere-vexana/fighting-stance.webp",
          "Official art of Vexana and Guinevere in their fighting stances",
        ),
      ],
    },
    {
      videos: [
        video(`${SO}-trailer-001-3994447231709070185`, true),
        video(`${SO}-selena-video`, true),
        video(`${SO}-obsidia-001-3997406762701005025`, true),
        video(`${SO}-skin-showcase-001-3999520529387107465`),
      ],
      tracks: [track("music-lullaby-of-oblivion"), track("music-gray-new-world")],
      arts: [
        splash("obsidia", "Obsidia", "Imperatrix Arashi"),
        splash("selena", "Selena", "Silverbolt Raiko"),
      ],
    },
  ];
  return phases.map((media, index) => placed(media, index + 1));
}
