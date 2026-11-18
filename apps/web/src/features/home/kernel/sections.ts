/**
 * The registry: the sixteen sections in scroll order. Mechanical on purpose. A section is a folder
 * under `sections/` with its own length, lead, tail, ground, loading list and runtime; this file only
 * puts them in order. It imports no runtime and no three.js: each section loads its own scene code
 * when it comes near (`mount` in the section's `index.ts`).
 */
import { section as archive } from "../sections/archive";
import { section as aspirants } from "../sections/aspirants";
import { section as bend } from "../sections/bend";
import { section as bolt } from "../sections/bolt";
import { section as chase } from "../sections/chase";
import { section as fall } from "../sections/fall";
import { section as footer } from "../sections/footer";
import { section as funny } from "../sections/funny";
import { section as hand } from "../sections/hand";
import { section as hero } from "../sections/hero";
import { section as list } from "../sections/list";
import { section as music } from "../sections/music";
import { section as rows } from "../sections/rows";
import { section as selena } from "../sections/selena";
import { section as strip } from "../sections/strip";
import { section as voices } from "../sections/voices";
import type { HomeSection } from "./types";

export const SECTIONS: readonly HomeSection[] = [
  hero,
  aspirants,
  rows,
  strip,
  bolt,
  fall,
  hand,
  list,
  selena,
  voices,
  music,
  funny,
  chase,
  bend,
  archive,
  footer,
];
