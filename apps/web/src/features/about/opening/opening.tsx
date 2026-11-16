import { Film } from "./film";
import { Hero } from "./hero";
import { Track } from "./track";

/**
 * The opening of the About page: the first screen (the title, the drone's place, what the series
 * is, the reel's preview) and the film, whose preview grows into a big window as the page is
 * scrolled. The film's stage comes first so that it is stuck to the screen from the very top; the
 * first screen is laid over it.
 */
export function Opening() {
  return (
    <Track>
      <Film />
      <Hero />
    </Track>
  );
}
