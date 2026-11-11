"use client";

import { useEffect, useMemo } from "react";

import { TLink } from "@/components/transition/t-link";
import { asset } from "@/lib/asset";
import { libUrl } from "@/lib/library";

import { ArtsBack, ArtsTakedown, useArtsBar } from "../core/chrome";
import { useArtsData } from "../core/data";
import { cosplayRoute } from "../core/routes";
import { SplashArt } from "./art";
import {
  NO_COSPLAY,
  THUMBS,
  countDigits,
  countWords,
  firstCharacterOf,
  photosOf,
  rosterOf,
  thumbsOf,
  totalsOf,
  type CosplayHead,
  type CosplayItem,
  type RosterEntry,
} from "./model";
import styles from "./cosplay.module.css";

/**
 * The roster of the ten Aspirants (`/collection/arts/cosplay`). Each has a tile: her official art,
 * her name, how many photos hold her, and a few of them as thumbnails. An Aspirant with no photo is
 * shown all the same, with a calm line. A tile opens her page. One pair to a column on a wide
 * screen, one pair to a row on a narrow one.
 */
export default function CosplayPage() {
  useArtsBar("daybreak");
  const { data } = useArtsData<CosplayItem, CosplayHead>("cosplay");
  const items = data?.items ?? null;
  const roster = useMemo(() => rosterOf(items), [items]);
  const totals = useMemo(() => (items ? totalsOf(items) : null), [items]);

  // An old link or a search entry that names a photo (`?i=<id>`) opens it on its Aspirant's page.
  useEffect(() => {
    if (!items) return;
    const wanted = new URLSearchParams(window.location.search).get("i");
    const found = wanted ? items.find((item) => item.id === wanted) : undefined;
    const slug = found ? firstCharacterOf(found) : null;
    if (!found || !slug) return;
    window.location.replace(`${asset(`${cosplayRoute(slug)}/`)}?i=${encodeURIComponent(found.id)}`);
  }, [items]);

  return (
    <main className={styles.room} data-cosplay-roster="">
      <ArtsBack />
      <header className={styles.head}>
        <div className={styles.heading}>
          <h1 className={styles.title}>Cosplay</h1>
          <p className={styles.count} data-cosplay-total="">
            {totals
              ? `10 Aspirants, ${totals.photos} ${totals.photos === 1 ? "photo" : "photos"}`
              : "10 Aspirants"}
          </p>
        </div>
        <p className={styles.lede}>
          Every Aspirant has a page, with a photo or not yet. The photos show real people who
          cosplay her, each credited.
        </p>
      </header>
      <ul className={styles.grid} data-cosplay-grid="">
        {roster.map((entry) => (
          <li key={entry.slug}>
            <Tile entry={entry} photos={items ? photosOf(items, entry.slug) : null} />
          </li>
        ))}
      </ul>
      <ArtsTakedown />
    </main>
  );
}

function Tile({ entry, photos }: { entry: RosterEntry; photos: readonly CosplayItem[] | null }) {
  const { slug, name, count } = entry;
  const thumbs = photos ? thumbsOf(photos, THUMBS) : null;
  return (
    <TLink
      href={cosplayRoute(slug)}
      transitionLabel={name}
      className={styles.tile}
      aria-label={count === null ? name : `${name}, ${countWords(count).toLowerCase()}`}
      data-cosplay-tile={slug}
      data-count={count ?? undefined}
    >
      <span className={styles.tileArt}>
        <SplashArt slug={slug} alt="" className={styles.tileImg} />
      </span>
      <span className={styles.meta}>
        <span className={styles.name}>{name}</span>
        {count !== null && count > 0 ? (
          <span className={styles.digits}>{countDigits(count)}</span>
        ) : null}
      </span>
      <span className={styles.under}>
        {thumbs && thumbs.shown.length > 0 ? (
          <>
            {thumbs.shown.map((photo) => (
              <span key={photo.id} className={styles.thumb}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className={styles.thumbImg}
                  src={libUrl(photo.img.t)}
                  alt=""
                  width={photo.img.w}
                  height={photo.img.h}
                  decoding="async"
                  draggable={false}
                />
              </span>
            ))}
            {thumbs.more > 0 ? (
              <span className={styles.more} aria-hidden="true">
                +{thumbs.more}
              </span>
            ) : null}
          </>
        ) : count === 0 ? (
          <>
            <span className={styles.spacer} aria-hidden="true" />
            <span className={styles.none}>{NO_COSPLAY}</span>
          </>
        ) : (
          <span className={styles.spacer} aria-hidden="true" />
        )}
      </span>
    </TLink>
  );
}
