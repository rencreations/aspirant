"use client";

import { useLibraryData } from "../../data";
import { BackToCollection, useTransparentNav } from "../../shell/room-chrome";
import { FilmsStage } from "./stage";
import type { FilmWork } from "./types";

const NONE: readonly FilmWork[] = [];

/**
 * The Films room (`/collection/video/films`), after juliencalot.com: the ten official films, one to
 * a screen, full bleed, on an endless strip. The one on screen plays by itself; the next is
 * buffered while it plays. A contents sheet goes straight to any film. `?i=<id>&t=<seconds>` opens
 * a film at a second. The top bar has no background, and one button leads back to the shelf.
 */
export default function FilmsPage() {
  useTransparentNav("storm");
  const { data, failed } = useLibraryData<FilmWork>("video-films");
  const films = data?.items ?? NONE;

  return (
    <>
      <h1 className="sr-only">Films</h1>
      {films.length > 0 ? <FilmsStage films={films} /> : null}
      {failed ? (
        <div className="shell below-nav" style={{ paddingTop: "8rem" }}>
          <p>The films could not be read. Check your connection and reload the page.</p>
        </div>
      ) : null}
      <BackToCollection tone="light" />
    </>
  );
}
