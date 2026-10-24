"use client";

import {
  Blinds,
  Crt,
  Curtain,
  Dawn,
  Dusk,
  Heart,
  Iris,
  Paper,
  Pixels,
  Scan,
  Slab,
  Wave,
} from "./effects";

/**
 * The joins between the sections of Vexana's page, each its own effect, named for what it does.
 * A seam sits between two sections in the page and draws only while the join crosses the screen.
 *
 *   iris     About to the film          a light iris opens from the join
 *   blinds   the film to the craft      shutter blinds close one after another
 *   slab     the craft to the pair      two slabs sweep across at a slant
 *   curtain  the interlude to the comic two curtains close and open
 *   crt      the comic to the stream    static, then a set switching off
 *   pixels   the stream to the game     big pixels fill the screen and break up
 *   scan     the game to the 3D work    a laser scans a modeller's grid
 *   heart    the 3D work to Guinevere   a heart beats and swells
 *   wave     Guinevere to the art       three tides of ink rise
 *   paper    the art to the fanart      a taped sheet with a torn edge is pulled up
 *   dusk     the fanart to her theme    evening falls, with stars and a moon
 *   dawn     her theme to the next page a low sun glows on the join
 *
 * The first join (the Opening to About) and the one into the interlude are not seams: there the
 * next section rises over a stuck screen, by plain scrolling (see `about.module.css` and
 * `cover.module.css`).
 */
const SEAMS = {
  iris: Iris,
  blinds: Blinds,
  slab: Slab,
  curtain: Curtain,
  crt: Crt,
  pixels: Pixels,
  scan: Scan,
  heart: Heart,
  wave: Wave,
  paper: Paper,
  dusk: Dusk,
  dawn: Dawn,
} as const;

export type SeamKind = keyof typeof SEAMS;

export function Seam({ kind }: { kind: SeamKind }) {
  const Effect = SEAMS[kind];
  return <Effect />;
}
