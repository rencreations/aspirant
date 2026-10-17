/**
 * Our own titles for the archive. The sources only give file names, so each title is read
 * off the file name and the folder (the pair) and says nothing more. No lore is added.
 */
import type { PairId } from "@/content/types";

import type { FilmCategory } from "./types";

interface FilmTitle {
  title: string;
  category: FilmCategory;
}

/**
 * Video titles, keyed `pair/role` (the role is the file name without its extension).
 * "We Believe" is named because the music video runs exactly as long as the song.
 */
export const FILM_TITLES: Readonly<Record<string, FilmTitle>> = {
  "fanny-layla/trailer": { title: "Trailer", category: "Trailer" },
  "fanny-layla/skin-showcase": { title: "Skin showcase", category: "Skin showcase" },
  "fanny-layla/music-video": { title: "We Believe, music video", category: "Music video" },
  "fanny-layla/music-bts": {
    title: "We Believe, behind the scenes",
    category: "Behind the scenes",
  },
  "fanny-layla/music-producer-talk": {
    title: "We Believe, producer talk",
    category: "Behind the scenes",
  },
  "fanny-layla/idea-bts": { title: "The idea, behind the scenes", category: "Behind the scenes" },
  "fanny-layla/short-animation": { title: "Short animation", category: "Short" },

  "ruby-angela/trailer": { title: "Trailer", category: "Trailer" },
  "ruby-angela/skin-showcase": { title: "Skin showcase", category: "Skin showcase" },
  "ruby-angela/ruby": { title: "Ruby", category: "Character video" },
  "ruby-angela/angela": { title: "Angela", category: "Character video" },
  "ruby-angela/qna": { title: "Questions and answers", category: "Q and A" },
  "ruby-angela/rerun": { title: "Rerun", category: "Short" },

  "lesley-change/trailer": { title: "Trailer", category: "Trailer" },
  "lesley-change/teaser": { title: "Teaser", category: "Teaser" },
  "lesley-change/skin-showcase": { title: "Skin showcase", category: "Skin showcase" },

  "guinevere-vexana/trailer": { title: "Trailer", category: "Trailer" },
  "guinevere-vexana/skin-showcase": { title: "Skin showcase", category: "Skin showcase" },
  "guinevere-vexana/relink": { title: "Relink", category: "Short" },
  "guinevere-vexana/3d-process": { title: "The 3D process", category: "Behind the scenes" },
  "guinevere-vexana/comic-video": { title: "Comic video", category: "Comic video" },
  "guinevere-vexana/heart-short-dance": { title: "Heart, short dance", category: "Short" },
  "guinevere-vexana/interactive-drama": { title: "Interactive drama", category: "Short" },
  "guinevere-vexana/short-splash-art-showcase": {
    title: "Splash art showcase, short",
    category: "Short",
  },
  "guinevere-vexana/sleeping": { title: "Sleeping", category: "Short" },

  "selena-obsidia/trailer": { title: "Trailer", category: "Trailer" },
  "selena-obsidia/skin-showcase": { title: "Skin showcase", category: "Skin showcase" },
  "selena-obsidia/selena": { title: "Selena", category: "Character video" },
  "selena-obsidia/obsidia": { title: "Obsidia", category: "Character video" },
  "selena-obsidia/selena-short-showcase": { title: "Selena, short showcase", category: "Short" },
  "selena-obsidia/comic-video": { title: "Comic video", category: "Comic video" },
};

/** Sort order of the categories in the films grid. */
export const CATEGORY_RANK: Readonly<Record<FilmCategory, number>> = {
  Trailer: 0,
  "Music video": 1,
  Teaser: 2,
  "Character video": 3,
  "Skin showcase": 4,
  "Behind the scenes": 5,
  "Q and A": 6,
  "Comic video": 7,
  Short: 8,
};

/** Order the pairs follow everywhere: the character queue. */
export const PAIR_RANK: Readonly<Record<PairId, number>> = {
  "fanny-layla": 0,
  "ruby-angela": 1,
  "lesley-change": 2,
  "guinevere-vexana": 3,
  "selena-obsidia": 4,
};

/** Music tracks keyed by file name. Credits come from the character bible. */
export const MUSIC_TITLES: Readonly<
  Record<
    string,
    { title: string; role: string; credit: string; artist: string | null; cover: string }
  >
> = {
  "we-believe": {
    title: "We Believe",
    role: "The Aspirants' theme",
    credit: "Sung by Aino Nanjo. Composed by Yasuharu Takanashi.",
    artist: "Aino Nanjo",
    cover: "img/pair/fanny-layla/fanny-and-layla.webp",
  },
  "obsidia-aspirant": {
    title: "Obsidia: Aspirant",
    role: "Obsidia track",
    credit: "Credit not specified.",
    artist: null,
    cover: "img/char/obsidia/splash-sm.webp",
  },
  "obsidia-solo": {
    title: "Obsidia: Solo",
    role: "Obsidia track",
    credit: "Credit not specified.",
    artist: null,
    cover: "img/char/obsidia/splash-sm.webp",
  },
};

/** Titles for the art that is not a plain character splash or cutout. */
export const PAIR_ART_TITLES: Readonly<Record<string, string>> = {
  "fighting-together-splash-art": "Fanny and Layla, fighting together",
  "fanny-and-layla": "Fanny and Layla",
  "both-splash-art": "Guinevere and Vexana, splash art",
  "fighting-moment": "Guinevere and Vexana, fighting moment",
  "fighting-stance": "Guinevere and Vexana, fighting stance",
};
