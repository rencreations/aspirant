"use client";

import type { ReactNode } from "react";

import { ComicCard } from "./comic-card";
import { FilmCard } from "./film-card";
import { GalleryCard, galleryCellStyle, galleryRatio } from "./gallery-card";
import { Cell, CellList } from "./section-shell";
import styles from "./sections.module.css";
import { TrackCard } from "./track-card";
import type { ArtItem, ComicItem, FanArtItem, FilmItem, TrackItem } from "./types";

/** Shown when a section has nothing that matches the filters. */
export function EmptySection({ onClear }: { onClear: () => void }) {
  return (
    <div className={styles.empty}>
      <p>Nothing here matches those filters.</p>
      <button type="button" className="link" onClick={onClear}>
        Clear the filters
      </button>
    </div>
  );
}

interface FilmsProps {
  /** Wide films to show. */
  wide: readonly FilmItem[];
  /** Vertical films to show. */
  vertical: readonly FilmItem[];
  /** Every film in the collection, to keep each card's number and shape stable. */
  order: ReadonlyMap<string, number>;
  onOpen: (film: FilmItem, opener: HTMLElement) => void;
}

export function FilmsContent({ wide, vertical, order, onOpen }: FilmsProps) {
  return (
    <>
      {wide.length > 0 && (
        <CellList className={`${styles.list} ${styles.filmGrid}`} label="Films">
          {wide.map((film) => (
            <Cell key={film.id}>
              <FilmCard film={film} index={order.get(film.id) ?? 0} onOpen={onOpen} />
            </Cell>
          ))}
        </CellList>
      )}
      {vertical.length > 0 && (
        <>
          <h3 className={styles.sub}>
            In portrait <span>{vertical.length}</span>
          </h3>
          <CellList className={`${styles.list} ${styles.reelGrid}`} label="Vertical films">
            {vertical.map((film) => (
              <Cell key={film.id}>
                <FilmCard film={film} index={order.get(film.id) ?? 0} onOpen={onOpen} />
              </Cell>
            ))}
          </CellList>
        </>
      )}
    </>
  );
}

export function MusicContent({
  tracks,
  order,
}: {
  tracks: readonly TrackItem[];
  order: ReadonlyMap<string, number>;
}) {
  return (
    <CellList className={`${styles.list} ${styles.trackGrid}`} label="Music">
      {tracks.map((track) => (
        <Cell key={track.id}>
          <TrackCard track={track} index={order.get(track.id) ?? 0} />
        </Cell>
      ))}
    </CellList>
  );
}

export function ComicsContent({
  comics,
  onOpen,
}: {
  comics: readonly ComicItem[];
  onOpen: (comic: ComicItem, opener: HTMLElement) => void;
}) {
  return (
    <CellList className={`${styles.list} ${styles.comicGrid}`} label="Comics">
      {comics.map((comic) => (
        <Cell key={comic.id}>
          <ComicCard comic={comic} onOpen={onOpen} />
        </Cell>
      ))}
    </CellList>
  );
}

interface GalleryProps<T extends ArtItem | FanArtItem> {
  items: readonly T[];
  order: ReadonlyMap<string, number>;
  label: string;
  onOpen: (item: ArtItem | FanArtItem, opener: HTMLElement) => void;
  /** Extra content under each frame (the credit line for fan art). */
  caption?: (item: T) => ReactNode;
}

/** Frames in justified rows. */
export function GalleryContent<T extends ArtItem | FanArtItem>({
  items,
  order,
  label,
  onOpen,
  caption,
}: GalleryProps<T>) {
  return (
    <CellList className={`${styles.list} ${styles.gallery}`} label={label}>
      {items.map((item) => {
        const index = order.get(item.id) ?? 0;
        return (
          <Cell
            key={item.id}
            className={styles.cell}
            style={galleryCellStyle(galleryRatio(item, index))}
          >
            <GalleryCard item={item} index={index} onOpen={onOpen} />
            {caption?.(item)}
          </Cell>
        );
      })}
    </CellList>
  );
}

/** Credit under a fan art frame: always shown, with a link when we trust one. */
export function FanCredit({ piece }: { piece: FanArtItem }) {
  return (
    <p className={styles.credit}>
      <span>{piece.credit}</span>
      {piece.url && (
        <a href={piece.url} target="_blank" rel="noopener noreferrer">
          View the original
          <span className="sr-only"> of {piece.title} (opens in a new tab)</span>
        </a>
      )}
    </p>
  );
}
