import type { Route } from "next";

import { videoRoute } from "@/features/library/video/links";
import { withReturn } from "@/lib/return-to";
import { characterRoute, collectionRoute } from "@/lib/site";
import type { CharacterSlug } from "@/lib/slugs";

import libraryIndex from "../../../public/data/library/index.json";

/**
 * The facts of the About page, as data. They come from the official account's captions and the
 * game's own texts (see "Facts the copy may use" in the page's design document). Nothing here is
 * from the site's novel. The sections below the film draw themselves from this file, and a test
 * holds it against the character data and the Films room.
 */

/** The faces the drone can show at an anchor (`data-drone-face`). */
export type DroneFace =
  "normal" | "happy" | "squint" | "scan" | "alert" | "sleepy" | "angry" | "ecg";

// The statement -----------------------------------------------------------------------------------

/** One run of words in a line of the statement. `serif` words are set in the italic serif. */
export interface StatementWord {
  readonly text: string;
  readonly serif?: "accent" | "soft";
}

/** The official line the statement stands on, with its date. */
export const STATEMENT_SOURCE = {
  quote: "MLBB's very first anime-themed skins",
  date: "10 Jan 2022",
} as const;

/** Six lines, as on the reference: a count, then where it comes from, then since when. */
export const STATEMENT_LINES: ReadonlyArray<readonly StatementWord[]> = [
  [{ text: "Ten skins." }],
  [{ text: "Five" }, { text: "phases.", serif: "soft" }],
  [{ text: "One" }, { text: "anime", serif: "accent" }, { text: "series" }],
  [{ text: "from" }, { text: "Mobile Legends,", serif: "soft" }],
  [{ text: "still running" }],
  [{ text: "since" }, { text: "2022.", serif: "accent" }],
];

/** The drone, in the owner's words (16 Nov 2026). */
export const DRONE_CAPTION = {
  label: "The drone",
  line: "The Aspirants official mascot.",
} as const;

// The phases --------------------------------------------------------------------------------------

export interface PhaseSkin {
  readonly slug: CharacterSlug;
  readonly name: string;
  /** The skin's title, as the game writes it. */
  readonly title: string;
  readonly href: Route;
  /** The official splash art, 2048 by 1152. */
  readonly picture: string;
  /**
   * Where the character is in that picture, in percent, for a tall window: the crop is set here.
   * It also keeps the game mark, which is baked into the top left of eight of the ten, outside.
   */
  readonly focus: readonly [x: number, y: number];
  /**
   * A tall window shows the whole height of a wide picture, so `focus` can only move it sideways.
   * To set a face lower in its window the picture is drawn a little larger and moved down: the
   * enlargement (1.12 is twelve percent) and the move, in percent of the window's height. The
   * move may be at most half of what the enlargement adds, or an edge of the picture shows.
   */
  readonly nudge?: readonly [zoom: number, down: number];
}

interface PhaseEp {
  /** "EP 01", as on the cards of the official soundtrack film. */
  readonly ep: string;
  /** The EP's title, when the facts give one. */
  readonly title?: string;
}

export interface Phase {
  /** 1 to 5. */
  readonly n: number;
  /** The owner's and the community's wording: "1.0". */
  readonly numeral: string;
  /** The official wording: "Phase I". */
  readonly label: string;
  /** The day the two skins went on sale. */
  readonly sale: { readonly day: number; readonly month: number; readonly year: number };
  readonly skins: readonly [PhaseSkin, PhaseSkin];
  /** The draw event of the phase. */
  readonly event: string;
  readonly films: readonly string[];
  readonly music: readonly PhaseEp[];
  /** The face the drone wears beside this phase. */
  readonly face: DroneFace;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** "January 2022". */
export function saleMonth(phase: Phase): string {
  return `${MONTHS[phase.sale.month - 1] ?? ""} ${phase.sale.year}`;
}

/** "22 January 2022". */
export function saleDay(phase: Phase): string {
  return `${phase.sale.day} ${saleMonth(phase)}`;
}

/** The years the timeline shows. It runs from the start of the first to the end of the last. */
export const TIMELINE_YEARS = [2022, 2023, 2024, 2025, 2026] as const;

/** Where a phase's sale day is on the timeline: 0 at the start of 2022, 1 at the end of 2026. */
export function timelineAt(phase: Phase): number {
  const first = TIMELINE_YEARS[0];
  const years = phase.sale.year - first + (phase.sale.month - 1 + (phase.sale.day - 1) / 31) / 12;
  return Math.min(1, Math.max(0, years / TIMELINE_YEARS.length));
}

function skin(
  slug: CharacterSlug,
  name: string,
  title: string,
  focus: readonly [number, number],
  nudge?: readonly [number, number],
): PhaseSkin {
  return {
    slug,
    name,
    title,
    href: characterRoute(slug),
    picture: `/img/char/${slug}/splash.webp`,
    focus,
    ...(nudge ? { nudge } : {}),
  };
}

const EVENT = "Aspirants Unite";

export const PHASES: readonly Phase[] = [
  {
    n: 1,
    numeral: "1.0",
    label: "Phase I",
    sale: { day: 22, month: 1, year: 2022 },
    skins: [
      skin("layla", "Layla", "Miss Hikari", [63, 40]),
      skin("fanny", "Fanny", "Blade of Kibou", [58, 34]),
    ],
    event: EVENT,
    films: ["Go For It! Aspirants!"],
    music: [{ ep: "EP 01", title: "We Believe" }],
    face: "happy",
  },
  {
    n: 2,
    numeral: "2.0",
    label: "Phase II",
    sale: { day: 3, month: 12, year: 2022 },
    skins: [
      skin("ruby", "Ruby", "Mecha Maiden", [44, 38]),
      skin("angela", "Angela", "Cyber Cherubin", [62, 34], [1.14, 6]),
    ],
    event: EVENT,
    films: ["A Friend", "A Way Out", "Awakening"],
    music: [{ ep: "EP 02", title: "Angela & Ruby Music" }],
    face: "scan",
  },
  {
    n: 3,
    numeral: "3.0",
    label: "Phase III",
    sale: { day: 4, month: 3, year: 2024 },
    skins: [
      skin("lesley", "Lesley", "Deadeye Spectre", [62, 30]),
      skin("change", "Chang'e", "Tech Tensai", [65, 40]),
    ],
    event: EVENT,
    films: ["Rekindled Light"],
    music: [{ ep: "EP 03", title: "Chang'e & Lesley Music" }],
    face: "squint",
  },
  {
    n: 4,
    numeral: "4.0",
    label: "Phase IV",
    sale: { day: 3, month: 10, year: 2025 },
    skins: [
      skin("guinevere", "Guinevere", "Daybreak Halo", [60, 42]),
      skin("vexana", "Vexana", "Twilight Star", [58, 52]),
    ],
    event: EVENT,
    films: ["Connection Lost", "Re:Link"],
    music: [{ ep: "EP 04", title: "Cross×Credo" }],
    face: "ecg",
  },
  {
    n: 5,
    numeral: "5.0",
    label: "Phase V",
    sale: { day: 9, month: 10, year: 2026 },
    skins: [
      skin("selena", "Selena", "Silverbolt Raiko", [62, 36]),
      skin("obsidia", "Obsidia", "Imperatrix Arashi", [56, 32], [1.3, 14]),
    ],
    event: EVENT,
    films: ["Day of Enders", "The Pawn's Gambit", "The Queen's Endgame"],
    music: [
      { ep: "EP 05", title: "Gray New World" },
      { ep: "EP 06", title: "Lullaby of Oblivion" },
    ],
    face: "alert",
  },
];

// The ledger --------------------------------------------------------------------------------------

export interface LedgerRow {
  readonly id: string;
  /** The figure the row counts up to. */
  readonly figure: number;
  /** What the figure counts. */
  readonly unit: string;
  /** One line, from the facts. */
  readonly line: string;
  /** Where the row leads, and what the link says. */
  readonly href: Route;
  readonly room: string;
}

/** How many official films there are. The Films room holds the same count (tested). */
export const FILM_COUNT = PHASES.reduce((sum, phase) => sum + phase.films.length, 0);

/** How many EPs the official soundtrack has. */
export const EP_COUNT = PHASES.reduce((sum, phase) => sum + phase.music.length, 0);

/**
 * A link of the ledger: the page it opens leads back to this page, at the ledger (`from=about` and
 * `at=ledger`, see `lib/return-to.ts`).
 */
const fromLedger = (href: string): Route => withReturn(href, "about", "ledger");

/**
 * The resources of the series, in the owner's words (16 Nov 2026): the three rooms of the
 * collection that hold what every phase produced. The count of voice lines is the collection's own
 * (the figure its shelf shows), so it follows the room.
 */
export const LEDGER: readonly LedgerRow[] = [
  {
    id: "films",
    figure: FILM_COUNT,
    unit: "Official films",
    line: "Animated films with lore explaining each character and storylines.",
    href: fromLedger(videoRoute("films")),
    room: "Films",
  },
  {
    id: "music",
    figure: 7,
    unit: "Music & Tracks",
    line: "Original soundtrack and music produced for The Aspirants.",
    href: fromLedger(collectionRoute("music")),
    room: "Music",
  },
  {
    id: "voice",
    figure: libraryIndex.counts.voicelines,
    unit: "Voice lines",
    line: "English, 日本語, español, português, русский, اللغة العربية, türkçe and Bahasa Indonesia.",
    href: fromLedger(collectionRoute("voicelines")),
    room: "Voice lines",
  },
];

// TheMLabel ---------------------------------------------------------------------------------------

/** TheMLabel in the official words. The name is one word and keeps its capitals. */
export const LABEL = {
  name: "TheMLabel",
  launched: "16 Sep 2026",
  /** Quoted from the official announcement. */
  definition: "a dedicated gallery for MLBB's signature skin series",
  first: "The Aspirants is the first series to be featured.",
  parts: [
    {
      id: "hall",
      title: "One series, one hall",
      line: "Each series has a gallery of its own, with its own visuals and theme music.",
    },
    { id: "perks", title: "Four perks", line: "" },
    {
      id: "story",
      title: "Skin story",
      line: "Lore, cinematic trailers and character designs, all in one place.",
    },
  ],
  perks: ["Golden skin name", "Animated skin tag", "Collection crest", "Showcase display"],
} as const;

// The notice -------------------------------------------------------------------------------------

/**
 * The house notice (`content/site-copy.ts`), with the non-commercial fact of the legal texts. It
 * stands at the very foot of the page.
 */
export const NOTICE =
  "A fan project, and a non-commercial one. Not affiliated with or endorsed by Moonton. Mobile Legends: Bang Bang and its characters belong to their owners.";

// Pictures ----------------------------------------------------------------------------------------

/**
 * Every picture the sections show, in page order, for the loading list to warm.
 * @public
 */
export const ABOUT_PICTURES: readonly string[] = PHASES.flatMap((phase) =>
  phase.skins.map((s) => s.picture),
);
