import { startVideo } from "../phase-media";

import { Film } from "./film";
import { Hero } from "./hero";
import { Track } from "./track";

/**
 * The opening of the About page: the first screen (the title, the drone's place, what the series
 * is, the reel's preview) and the film, whose preview grows into a big window as the page is
 * scrolled. The film's stage comes first so that it is stuck to the screen from the very top; the
 * first screen is laid over it.
 *
 * The film is how the series started: the studio's own film about the first Aspirant ideas. Its
 * record is read from the collection's data here, while the page is built.
 */
export function Opening() {
  return (
    <Track>
      <Film film={startVideo().player} />
      <Hero />
    </Track>
  );
}
