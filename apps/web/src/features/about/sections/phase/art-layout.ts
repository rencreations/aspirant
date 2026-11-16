/**
 * How the wall of a phase is composed. It follows the number of pictures, never a uniform grid:
 * two hang as a pair at two heights, four as a stepped collage, five around a large one. Any
 * other count falls back to something calm. Pure, so it is tested without a page.
 */

type ArtLayout = "solo" | "pair" | "collage" | "mosaic" | "rows";

export function artLayout(count: number): ArtLayout {
  if (count <= 1) return "solo";
  if (count === 2) return "pair";
  if (count === 4) return "collage";
  if (count === 5) return "mosaic";
  return "rows";
}

/**
 * The picture that hangs largest, or -1 when none does. In a wall of five it is the middle one:
 * the two before it stand beside it and the two after it under it.
 */
export function heroIndex(count: number): number {
  const layout = artLayout(count);
  if (layout === "solo") return 0;
  if (layout === "collage") return 0;
  if (layout === "mosaic") return 2;
  return -1;
}

/**
 * The name under a picture, from its description: "The official splash art of Fanny, Blade of
 * Kibou" is shown as "Fanny, Blade of Kibou". A description that does not start with one of the
 * known openings is shown whole. Nothing is added to what the description says.
 */
export function artName(alt: string): string {
  const openings = [
    "The official splash art of ",
    "Official art of ",
    "The key art of The Aspirants: ",
  ] as const;
  for (const opening of openings) {
    if (alt.startsWith(opening) && alt.length > opening.length) {
      const rest = alt.slice(opening.length);
      return rest.charAt(0).toUpperCase() + rest.slice(1);
    }
  }
  return alt;
}
