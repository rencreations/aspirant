"use client";

import { useLibraryData } from "../../data";
import { useTransparentNav } from "../../shell/room-chrome";
import { FilmsBack } from "./back";
import { FilmsStage } from "./stage";
import type { FilmWork } from "./types";

const NONE: readonly FilmWork[] = [];

/**
 * The Films room (`/collection/video/films`), after juliencalot.com: the ten official films, one to
 * a screen, full bleed, on an endless strip. The one on screen plays by itself; the next is
 * buffered while it plays. A contents sheet goes straight to any film. `?i=<id>&t=<seconds>` opens
 * a film at a second, and `&from=<room>` sends the back button to the room that opened it. The
 * top bar has no background. The back button lives in the stage (beside Index on a phone, and
 * inside the room when it is full screen); without films the page shows it alone.
 */
export default function FilmsPage() {
  useTransparentNav("storm");
  const { data, failed } = useLibraryData<FilmWork>("video-films");
  const films = data?.items ?? NONE;

  return (
    <>
      <h1 className="sr-only">Films</h1>
      {films.length > 0 ? <FilmsStage films={films} /> : <FilmsBack />}
      {failed ? (
        <div className="shell below-nav" style={{ paddingTop: "8rem" }}>
          <p>The films could not be read. Check your connection and reload the page.</p>
        </div>
      ) : null}
    </>
  );
}
