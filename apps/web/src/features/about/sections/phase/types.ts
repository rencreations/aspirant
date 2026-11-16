import type { Route } from "next";

import type { PlayerVideo } from "@/components/video-player/player-overlay";

/**
 * What a phase of the About page shows beside its two skins: its videos, its music, its comic, the
 * interactive drama and its art. The records are made on the server from the collection's own data
 * files (`phase-media.ts`), so every address here is whole (a file of the collection is an
 * absolute address, a file of the site a public path) and nothing here is fetched by the page.
 */

/** One official video of a phase, as the deck lists and plays it. */
export interface PhaseVideo {
  readonly id: string;
  readonly title: string;
  /** The small label: "Trailer", "Teaser", "Skin showcase". */
  readonly kind: string;
  /** Pinned videos stand first in the list and carry a mark. */
  readonly pinned: boolean;
  /** Seconds. */
  readonly duration: number;
  /** The picture's shape, width over height (2.37 for a film, 0.56 for a vertical short). */
  readonly ratio: number;
  /** A small picture for the list and a large one for the window. */
  readonly thumb: string;
  readonly poster: string;
  /** One line about it, when the collection has one. */
  readonly note?: string;
  /** The live-action parody: made outside the story, and labelled so. */
  readonly nonCanon?: boolean;
  /** What the site's player needs to play it, with sound. */
  readonly player: PlayerVideo;
  /** Its own place in the collection, with the way back to this page. */
  readonly href: Route;
}

interface TrackCredit {
  readonly role: string;
  readonly name: string;
}

/** One track of the official soundtrack. */
export interface PhaseTrack {
  readonly id: string;
  /** "EP 01". */
  readonly ep: string;
  readonly title: string;
  readonly credits: readonly TrackCredit[];
  /** "01/2022", as the soundtrack's own card gives it. */
  readonly released: string;
  /** Seconds. */
  readonly duration: number;
  /** The audio file. */
  readonly audio: string;
  /** The cover in two sizes and its colour. */
  readonly cover: { readonly small: string; readonly large: string; readonly colour: string };
  /** The face of its disc, as the Music room draws it: a square picture made for the record. */
  readonly disc?: string;
  /** Where else it can be heard. */
  readonly links: ReadonlyArray<{ readonly label: string; readonly href: string }>;
  /** The track in the Music room, with the way back to this page. */
  readonly href: Route;
}

/** An official webtoon. */
export interface PhaseComic {
  readonly slug: string;
  readonly title: string;
  readonly pages: number;
  readonly cover: {
    readonly small: string;
    readonly large: string;
    readonly w: number;
    readonly h: number;
    readonly colour: string;
  };
  /** A few panels cut from its own pages, for the layout. */
  readonly panels: readonly PhaseArt[];
  /** The comic's page in the collection, with the way back to this page. */
  readonly href: Route;
  /** The comic as a voiced film, when there is one. */
  readonly film?: PhaseVideo;
}

/** One picture of official art. */
export interface PhaseArt {
  readonly id: string;
  readonly alt: string;
  /** The picture as shown, and a small one. */
  readonly src: string;
  readonly thumb: string;
  readonly w: number;
  readonly h: number;
}

/** The interactive drama of the fourth phase. */
export interface PhaseDrama {
  readonly title: string;
  readonly chapters: number;
  readonly endings: number;
  /** Pictures of its episodes, in order. */
  readonly stills: readonly PhaseArt[];
  /** The drama's page, with the way back to this page. */
  readonly href: Route;
}

/** Everything a phase adds to its two skins. */
export interface PhaseMedia {
  readonly videos: readonly PhaseVideo[];
  readonly tracks: readonly PhaseTrack[];
  /** The first phase's song has a music video. */
  readonly musicVideo?: PhaseVideo;
  readonly comic?: PhaseComic;
  readonly drama?: PhaseDrama;
  readonly arts: readonly PhaseArt[];
}
