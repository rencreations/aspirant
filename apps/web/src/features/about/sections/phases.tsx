import { phaseMedia } from "../phase-media";

import { PhasesView } from "./phases-view";

/**
 * The five phases. This part runs while the page is built: it reads the collection's data files
 * for the videos, the music, the comics and the art of each phase (`phase-media.ts`) and hands the
 * few records each phase needs to the view, so the data files themselves never travel to the page.
 */
export function Phases() {
  return <PhasesView media={phaseMedia()} />;
}
