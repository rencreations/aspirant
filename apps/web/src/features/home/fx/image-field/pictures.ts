/**
 * Which picture each card shows. A card has a portrait (the hero and the ring) and a wide picture
 * (the wall). The wide picture is the one of the wall slot the card lands on, so the wall's own
 * order (no two neighbours share an Aspirant or a pair) holds exactly whatever slot a card takes.
 * A card with a one-character portrait lands on the slot that shows the same character when there
 * is one, so its subject keeps its place through the flight.
 */
import { slotOf, type FormationSet } from "./formations";
import { poolOf, type FieldSetDef } from "./sets";

export interface CardPictures {
  /** Index into `portraits`. */
  portrait: number;
  /** Index into `walls`. */
  wide: number;
}

/** The number of cards of a set: one for each slot of the wall. */
export function cardCountOf(def: FieldSetDef): number {
  return def.walls.length;
}

/** The character each card stands for (its portrait's id when it is a single one), or null. */
export function cardKeys(def: FieldSetDef, n: number): Array<string | null> {
  return Array.from({ length: n }, (_, i) => {
    const pic = def.portraits[i % def.portraits.length];
    return pic?.chars.length === 1 ? pic.chars[0]! : null;
  });
}

/** The character of each picture of the pool (a one-character picture), else null. */
export function poolKeys(def: FieldSetDef): Array<string | null> {
  return poolOf(def).map((pic) => (pic.chars.length === 1 ? pic.chars[0]! : null));
}

/** The pictures of every cell, once the cards have their wall slots: the picture of the slot it stands in. */
export function assignPictures(def: FieldSetDef, set: FormationSet): CardPictures[] {
  return Array.from({ length: set.total }, (_, i) => ({
    portrait: i % def.portraits.length,
    wide: set.slotPic[slotOf(set, i)]!,
  }));
}
