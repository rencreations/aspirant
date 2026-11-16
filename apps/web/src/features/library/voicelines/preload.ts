import { libUrl } from "@/lib/library";
import { chunkItem, imageItem, mediaItem, type PreloadItem } from "@/lib/preload";
import { isCharacterSlug } from "@/lib/slugs";

import { splashFor } from "../animation/splash";
import { ROSTER_ORDER } from "../arts/cosplay/model";
import { fetchLibraryJson, libraryDataItem, libraryDataPath } from "../data";
import { heroFilmUrl } from "./hero-media";
import type { VoiceIndex } from "./types";

const indexFile = () => fetchLibraryJson<VoiceIndex>(libraryDataPath("voicelines"));

/** The still of the film: its first frame, shown while the film loads and if it can never play. */
function heroStillItem(): PreloadItem {
  return {
    id: "library-voicelines-hero-still",
    label: "Loading the film",
    weight: 1,
    run: async (report, context) => {
      const file = await indexFile();
      if (!file.hero) return;
      await imageItem(libUrl(file.hero.poster), "Loading the film").run(report, context);
    },
  };
}

/**
 * The film behind the title. It plays by itself on the first screen, so it is waited for, whole
 * (about 4 MB, or 2 on a narrow display): the size that fits the display, held in memory and saved
 * in the browser, so the next visit does not download it again.
 */
function heroFilmItem(): PreloadItem {
  return {
    id: "library-voicelines-hero-film",
    label: "Loading the film",
    weight: 8,
    memo: false,
    run: async (report, context) => {
      const file = await indexFile();
      const film = file.hero ? heroFilmUrl(file.hero) : null;
      if (!film) return;
      await mediaItem(film.url, "Loading the film", { type: "video/mp4", bytes: film.bytes }).run(
        report,
        context,
      );
    },
  };
}

/**
 * What the first screen of the room needs: its data, its code, the film behind the title (and its
 * still) and the ten splash pictures of the roster (the files of the Animation room, so most are in
 * the cache already). The sound files are fetched when a line is played (a few kilobytes each).
 */
export function items(): PreloadItem[] {
  return [
    libraryDataItem("voicelines"),
    chunkItem("library-voicelines", "Opening the voicelines room", () => import("./page"), 2),
    heroStillItem(),
    heroFilmItem(),
    ...ROSTER_ORDER.map((slug) => imageItem(splashFor(slug).src, "Loading the Aspirants", 1)),
  ];
}

/** What the page of one Aspirant needs: her file (every language), its code and her splash art. */
export function characterItems(character: string): PreloadItem[] {
  if (!isCharacterSlug(character)) return [];
  return [
    libraryDataItem(`voicelines-${character}`),
    chunkItem(
      "library-voicelines-character",
      "Opening the voice lines",
      () => import("./character-page"),
      2,
    ),
    imageItem(splashFor(character).src, "Loading her art", 2),
  ];
}
