import type { Route } from "next";

import { characterRoute, collectionRoute, routes } from "@/lib/site";
import type { CharacterSlug } from "@/lib/slugs";

/**
 * All the copy and the links of the home page, as data. The sections' views draw from this file and
 * a test holds it (no dashes, real routes, the ten Aspirants once each). Every word is the owner's
 * (request of 18 Nov 2026) or what the site's own data says. Where the request leaves a label open,
 * the call is written in `docs/design/home/kernel.md`.
 */

/** The page title is kept: the new description is the only change to the metadata. */
export const HOME_TITLE = "The Aspirants: Someone is always waiting.";

export const HOME_DESCRIPTION =
  "An original anime inspired skin series for Mobile Legends: Bang Bang, the first featured series of TheMLabel. Meet the ten Aspirants, watch the films, hear the music and read the story. A fan made archive, not affiliated with Moonton.";

/** The route of a comic of the collection (`public/data/library/comic.json`). */
function comicRoute(slug: string): Route {
  return `${collectionRoute("comic")}/${slug}` as Route;
}

const HOME_ROUTES = {
  about: routes.about,
  story: routes.story,
  collection: routes.collection,
  films: collectionRoute("video/films"),
  animation: collectionRoute("animation"),
  voicelines: collectionRoute("voicelines"),
  music: collectionRoute("music"),
  comics: collectionRoute("comic"),
  fanart: collectionRoute("arts/fanart"),
  artwork: collectionRoute("arts"),
} as const satisfies Record<string, Route>;

// 1 hero -------------------------------------------------------------------------------------------

export const HERO = {
  /** The accessible name of the logo, and the page's one h1. */
  name: "The Aspirants",
  cue: "Scroll to explore",
} as const;

// 2 aspirants --------------------------------------------------------------------------------------

export const ASPIRANTS = {
  title: "The Aspirants",
  /** "[the game's mark] original anime inspired skin series." */
  line: "original anime inspired skin series.",
  game: "Mobile Legends: Bang Bang",
  /** "A part of [TheMLabel's mark] as the first featured series." */
  partOf: "A part of",
  label: "TheMLabel",
  partOfEnd: "as the first featured series.",
  button: { label: "About Aspirant", href: HOME_ROUTES.about },
} as const;

// 4 strip ------------------------------------------------------------------------------------------

export const STRIP = {
  topLeft: "The Aspirants",
  topRight: "Trailer video for the new Selena & Obsidia Aspirant skin.",
  topRightTag: "Video",
  middleLeft: "Selena",
  middleRight: "Obsidia",
  bottomLeft: { rest: ["Aspirant 5.0", "Trailer"], hover: ["Our", "Collections"] },
  /** The button of the strip. Its hover changes the bottom left words, not the tag above it. */
  button: { label: "See All", href: HOME_ROUTES.collection },
  /** What the frame shows after it has grown (the press opens the site's player). */
  play: { label: "Play Films", duration: "3:00" },
  expand: {
    lead: "Official animations for",
    title: "The Aspirants",
    body: "10 official animated films produced in the last 4 years.",
    button: { label: "See Collections", href: HOME_ROUTES.films },
  },
} as const;

// 5 bolt -------------------------------------------------------------------------------------------

/** The five pairs, in the order the text wheel turns. */
export const PAIRS = [
  "Layla & Fanny",
  "Ruby & Angela",
  "Lesley & Chang'e",
  "Guinevere & Vexana",
  "Selena & Obsidia",
] as const;

export const BOLT = { heading: "The five pairs", pairs: PAIRS } as const;

// 6 fall -------------------------------------------------------------------------------------------

/** The two lines of the fall, shown one after another: the number on the left, the word on the right. */
export const FALL = {
  heading: "In numbers",
  lines: [
    { left: "5", right: "Phases" },
    { left: "10", right: "Characters" },
  ],
} as const;

// 7 hand -------------------------------------------------------------------------------------------

export const HAND = {
  title: "2022 - Present",
  body: "Many collections from these 4+ years",
  hint: "Try to hover",
} as const;

// 8 list -------------------------------------------------------------------------------------------

/** The ten frames of the list, in the owner's order. The last one is Selena in 3D. */
export const LIST_ORDER = [
  "obsidia",
  "fanny",
  "guinevere",
  "angela",
  "lesley",
  "layla",
  "ruby",
  "vexana",
  "change",
  "selena",
] as const satisfies readonly CharacterSlug[];

export const LIST = {
  title: "Characters",
  order: LIST_ORDER,
  /** The label of a frame's link in the plain page. */
  open: "Open the page of",
} as const;

export function listHref(slug: CharacterSlug): Route {
  return characterRoute(slug);
}

// 9 selena -----------------------------------------------------------------------------------------

export const SELENA = {
  title: "Immersive Interaction",
  body: "Each model and animations are made with love that's written through interactive media.",
  button: { label: "See All Animations", href: HOME_ROUTES.animation },
} as const;

// 10 voices ----------------------------------------------------------------------------------------

/**
 * The curated voice line of each Aspirant, by its number in her list. Selena's Japanese list has its
 * own order, so she has two numbers. The same number is the line in every other language.
 */
export const VOICE_PICKS: ReadonlyArray<{ slug: CharacterSlug; line: number; japanese?: number }> =
  [
    { slug: "fanny", line: 18 },
    { slug: "ruby", line: 5 },
    { slug: "lesley", line: 2 },
    { slug: "guinevere", line: 39 },
    { slug: "selena", line: 43, japanese: 42 },
    { slug: "layla", line: 7 },
    { slug: "angela", line: 23 },
    { slug: "change", line: 12 },
    { slug: "vexana", line: 41 },
    { slug: "obsidia", line: 18 },
  ];

export const VOICES = {
  title: "Voicelines",
  button: { label: "See all voicelines", href: HOME_ROUTES.voicelines },
} as const;

// 11 music -----------------------------------------------------------------------------------------

export const MUSIC = {
  title: "Music",
  button: { label: "See all music", href: HOME_ROUTES.music },
} as const;

// 12 funny -----------------------------------------------------------------------------------------

export const FUNNY = {
  title: "What's going on?",
  body: "Understand all The Aspirants story for all characters in one novel",
  button: { label: "Read The Story", href: HOME_ROUTES.story },
} as const;

// 13 chase -----------------------------------------------------------------------------------------

export const CHASE = {
  title: "COMIC",
  left: { label: "The Aspirants", href: comicRoute("the-aspirant") },
  right: { label: "Vexana & Guinevere", href: comicRoute("guinevere-and-vexana") },
  button: { label: "See all comics", href: HOME_ROUTES.comics },
} as const;

// 14 bend ------------------------------------------------------------------------------------------

export const BEND = {
  title: "Fan art",
  fanart: { label: "See all fanart", href: HOME_ROUTES.fanart },
  artworkTitle: "Artwork",
  artwork: { label: "See all artwork", href: HOME_ROUTES.artwork },
} as const;

// 15 archive ---------------------------------------------------------------------------------------

export const ARCHIVE = {
  title: "The archive",
  button: { label: "Open the collection", href: HOME_ROUTES.collection },
} as const;

// 16 footer ----------------------------------------------------------------------------------------

export const FOOTER = {
  eyebrow: "Next destination",
  title: "About",
  line: "Scroll more to see the about page",
  /** The visible word of the button. Its accessible name is "Continue to About". */
  button: "Continue",
  buttonName: "Continue to About",
  hint: "Keep scrolling or press N",
} as const;
