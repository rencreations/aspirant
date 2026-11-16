import { AboutRoot } from "./about-root";
import { DroneLayer } from "./drone/drone-layer";
import { MLabel } from "./mlabel/mlabel";
import { Opening } from "./opening/opening";
import { DroneStop } from "./sections/drone-stop";
import { Ledger } from "./sections/ledger";
import { Phases } from "./sections/phases";
import { Statement } from "./sections/statement";

/**
 * /about: what the Aspirants series is. One drone flies through the page: it writes the title,
 * lands beside it, shows off while the film grows into its window, rolls through the statement,
 * keeps the visitor company down the five phases and the resources, and comes to rest in a ring.
 * There the page turns dark: TheMLabel closes over it and is the end of the page (it has no
 * footer to a next page). The story itself is read at /story.
 */
export function AboutPage() {
  return (
    <AboutRoot>
      <Opening />
      <Statement />
      <Phases />
      <Ledger />
      <DroneStop />
      <DroneLayer />
      <MLabel />
    </AboutRoot>
  );
}
