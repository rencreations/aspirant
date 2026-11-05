"use client";

import { Fragment, useCallback, useMemo, useState } from "react";

import { pairs } from "@/content/pairs";

import { useLibraryData } from "../data";
import { Chips, ControlBar, characterOptions } from "../shell/controls";
import { LibraryShell } from "../shell/library-shell";
import { useQueryState } from "../use-query-state";
import { Cinema } from "./cinema";
import { Featured } from "./featured";
import {
  ROWS,
  facets,
  filterFilms,
  findFilm,
  groupRows,
  hasFilters,
  parseSeconds,
  runtimeWords,
  totalRuntime,
  type FilmFilters,
} from "./film-data";
import { DramaNote, FilmRow, LinkRow, ParodyNotice } from "./film-row";
import styles from "./films.module.css";
import type { Film, FilmsFile } from "./types";

const NONE: readonly Film[] = [];

/**
 * The films room: the featured film, then rows by kind, with filters by character, pair and kind
 * and a search. A film opens in the cinema view (`?i=<id>`, and `&t=<seconds>` for a start time,
 * which is where the scene stills of the Arts room point).
 */
export default function FilmsPage() {
  const { data, failed } = useLibraryData<Film>("films");
  const films = data?.items ?? NONE;
  const featuredId = (data as FilmsFile | null)?.featured ?? "";

  const [who, setWho] = useQueryState("who");
  const [pair, setPair] = useQueryState("pair");
  const [kind, setKind] = useQueryState("kind");
  const [q, setQ] = useQueryState("q");
  const [openId, setOpenId] = useQueryState("i");
  const [at, setAt] = useQueryState("t");
  const [press, setPress] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filters: FilmFilters = useMemo(() => ({ who, pair, kind, q }), [who, pair, kind, q]);
  const active = hasFilters(filters);
  const shown = useMemo(() => filterFilms(films, filters), [films, filters]);
  const counts = useMemo(() => facets(films, filters), [films, filters]);
  const rows = useMemo(() => groupRows(shown), [shown]);
  const order = useMemo(() => rows.flatMap((r) => r.films), [rows]);

  const featured = useMemo(() => findFilm(films, featuredId), [films, featuredId]);
  const current = useMemo(() => findFilm(films, openId), [films, openId]);
  const start = current ? parseSeconds(at, current.video.dur) : 0;

  const open = useCallback(
    (film: Film, play = false) => {
      setPress(play);
      setAt("");
      setOpenId(film.id);
    },
    [setAt, setOpenId],
  );

  const close = useCallback(() => {
    setPress(false);
    setAt("");
    setOpenId("");
  }, [setAt, setOpenId]);

  const step = useCallback(
    (direction: 1 | -1) => {
      const list = order.length > 0 && current && order.includes(current) ? order : films;
      if (!current || list.length === 0) return;
      const i = list.indexOf(current);
      const next = list[(i + direction + list.length) % list.length];
      if (!next) return;
      setPress(false);
      setAt("");
      setOpenId(next.id);
    },
    [order, films, current, setAt, setOpenId],
  );

  const clear = () => {
    setWho("");
    setPair("");
    setKind("");
    setQ("");
  };

  const summary = !data
    ? "Reading the films"
    : active
      ? `${shown.length} of ${films.length} films`
      : `${films.length} films, ${runtimeWords(totalRuntime(films))}`;

  const controls = (
    <ControlBar
      query={q}
      onQuery={setQ}
      placeholder="Search a film, a character or a scene"
      summary={summary}
      trailing={
        <button
          type="button"
          className={styles.filterToggle}
          aria-expanded={filtersOpen}
          onClick={() => {
            setFiltersOpen((o) => !o);
          }}
        >
          {active
            ? `Filters, ${[who, pair, kind].filter(Boolean).length + (q.trim() ? 1 : 0)} on`
            : "Filters"}
        </button>
      }
    >
      <div className={styles.filters} data-open={filtersOpen}>
        <Chips
          label="Character"
          options={characterOptions(counts.who)}
          value={who}
          onChange={setWho}
        />
        <Chips
          label="Pair"
          options={pairs.map((p) => ({
            value: p.id,
            label: p.names,
            count: counts.pair[p.id] ?? 0,
          }))}
          value={pair}
          onChange={setPair}
        />
        <Chips
          label="Kind"
          options={ROWS.map((r) => ({
            value: r.id,
            label: r.chip,
            count: counts.kind[r.id] ?? 0,
          }))}
          value={kind}
          onChange={setKind}
        />
      </div>
    </ControlBar>
  );

  let number = 0;
  return (
    <LibraryShell
      slug="films"
      count={data ? films.length : null}
      stat={data ? `${runtimeWords(totalRuntime(films))} of film` : undefined}
      controls={controls}
    >
      <div className={styles.page}>
        {failed ? (
          <div className={`${styles.empty} shell`}>
            <p>The films could not be read. Check your connection and reload the page.</p>
          </div>
        ) : null}

        {!active && featured ? <Featured film={featured} onOpen={open} /> : null}

        {data && rows.length === 0 ? (
          <div className={`${styles.empty} shell`}>
            <p>No film matches. Try fewer words, or clear the filters.</p>
            <button type="button" className={styles.secondary} onClick={clear}>
              Clear the filters
            </button>
          </div>
        ) : null}

        {rows.map(({ row, films: rowFilms }) => (
          <Fragment key={row.id}>
            {row.id === "parody" && !active ? (
              <>
                <LinkRow
                  number={++number}
                  title="Promo reels"
                  note="The eight promo reels and the promotional posts live in Design."
                  room="design"
                  action="Open Design"
                />
                <LinkRow
                  number={++number}
                  title="Fan-made films"
                  note="Fan animations and edits live in Fanart, each with its maker credited."
                  room="fanart"
                  action="Open Fanart"
                />
              </>
            ) : null}
            <FilmRow row={row} number={++number} films={rowFilms} onOpen={open}>
              {row.id === "parody" ? <ParodyNotice /> : null}
              {row.id === "drama" ? <DramaNote /> : null}
            </FilmRow>
          </Fragment>
        ))}
      </div>

      {current ? (
        <Cinema
          film={current}
          position={Math.max(1, (order.includes(current) ? order : films).indexOf(current) + 1)}
          total={(order.includes(current) ? order : films).length}
          start={start}
          press={press}
          onStart={(seconds) => {
            setAt(seconds > 0 ? String(Math.round(seconds * 10) / 10) : "");
          }}
          onClose={close}
          onStep={step}
        />
      ) : null}
    </LibraryShell>
  );
}
