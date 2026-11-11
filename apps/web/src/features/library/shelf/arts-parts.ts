import { artsRoute } from "../arts/core/routes";

/** The three rooms inside the Arts cover. */
type ArtsPartId = "official" | "fanart" | "cosplay";

/** One part of the Arts cover: a room of the Arts collection. */
export interface ArtsPart {
  room: ArtsPartId;
  /** The small mono line on the cover, above the name (says it is part of Arts). */
  index: string;
  name: string;
  /** One line under the part on the shelf. */
  line: string;
  /** Field colour of the part's picture. */
  colour: string;
  /** Key of the 1024 square picture (made by `scripts/library/covers.py`). */
  cover: string;
  href: ReturnType<typeof artsRoute>;
}

/**
 * The three rooms inside the Arts cover, in the order they open: Official is the inside of the front
 * panel (on the left, or on top on a phone), Fanart the middle panel, Cosplay the one that swings out
 * from behind. The colours and keys are read by `scripts/library/covers.py` (keep the
 * `colour: "#rrggbb"` form). All three are one hue as light as the cover is dark: the room is told
 * apart by its tone and by the name the shelf draws over it.
 */
export const ARTS_PARTS: readonly [ArtsPart, ArtsPart, ArtsPart] = [
  {
    room: "official",
    index: "01.1  ARTS",
    name: "Official",
    line: "Splash art, scenes, comic panels, game, design and more.",
    colour: "#e0245e",
    cover: "covers/arts-official.webp",
    href: artsRoute("splash"),
  },
  {
    room: "fanart",
    index: "01.2  ARTS",
    name: "Fanart",
    line: "Made by readers and players, each piece credited.",
    colour: "#4a0f2b",
    cover: "covers/arts-fanart.webp",
    href: artsRoute("fanart"),
  },
  {
    room: "cosplay",
    index: "01.3  ARTS",
    name: "Cosplay",
    line: "The ten Aspirants, a page for each.",
    colour: "#ffc2d4",
    cover: "covers/arts-cosplay.webp",
    href: artsRoute("cosplay"),
  },
];

/** The shelf slot that opens in three. */
export const ARTS_SLUG = "arts";

/** The words after the count under each part. */
export const ARTS_UNITS = ["pictures", "pieces", "posts"] as const;

/**
 * The count under each part, from the `rooms` of the library index (`arts/official`, `arts/fanart`,
 * `arts/cosplay`). A room the index does not know, or that is empty, shows no count rather than a
 * wrong one.
 */
export function artsPartCounts(
  rooms?: Partial<Record<string, number>>,
): [number | undefined, number | undefined, number | undefined] {
  const n = (key: string) => {
    const v = rooms?.[key];
    return typeof v === "number" && v > 0 ? v : undefined;
  };
  return [n("arts/official"), n("arts/fanart"), n("arts/cosplay")];
}
