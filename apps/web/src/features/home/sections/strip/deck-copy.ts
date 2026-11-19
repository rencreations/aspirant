/**
 * The words of the window's deck (the running strips above and below the picture and the readout
 * pill), built from the strip's own copy in `content.ts`: the series' words and the film's real
 * duration, nothing else. The server markup and the runtime both read it.
 */
import { STRIP } from "../../content";

/** The lines the two strips take turns with. */
export const DECK_STRIPS: readonly string[] = STRIP.deck.strips;

/** The lines the readout pill takes turns with. */
export const DECK_READOUT: readonly string[] = [
  STRIP.deck.readout[0],
  `${STRIP.deck.durationLabel} ${STRIP.play.duration}`,
  STRIP.deck.readout[1],
];
