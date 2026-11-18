import type { CSSProperties } from "react";

import { TLink } from "@/components/transition/t-link";
import { COLLECTIONS } from "@/features/library/registry";
import { libUrl } from "@/lib/library";
import { collectionRoute } from "@/lib/site";

import libraryIndex from "../../../../../public/data/library/index.json";

import { ARCHIVE } from "../../content";
import { Pill } from "../../ui";
import type { SectionMarkup } from "../../kernel/types";

import styles from "./archive.module.css";

const COUNTS: Readonly<Record<string, number>> = libraryIndex.counts;

/** A count as the site writes it: "1,371". */
function figure(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * What the server draws for the archive: the ten rooms of the collection as ten covers, each a real
 * link to its room with its count (from the library's index, read when the page is built, so the
 * numbers are in the HTML and need no loading), and the way to the whole collection. The spotlight
 * (a beam and a pool of light) is drawn under the canvas; the drone is the light's source.
 */
export function view(): SectionMarkup {
  return {
    below: (
      <>
        <div className={styles.pool} data-archive-pool="" />
        <div className={styles.beam} data-archive-beam="" />
      </>
    ),
    text: (
      <>
        <h2 className={styles.title}>{ARCHIVE.title}</h2>
        <ul className={styles.strip} data-archive-strip="" aria-label={ARCHIVE.rooms}>
          {COLLECTIONS.map((room, i) => {
            const count = COUNTS[room.slug] ?? 0;
            return (
              <li
                key={room.slug}
                className={styles.room}
                data-archive-room={i}
                style={{ "--room": room.colour } as CSSProperties}
              >
                <TLink
                  href={collectionRoute(room.slug)}
                  transitionLabel={room.name}
                  className={styles.card}
                  data-cursor="OPEN"
                  aria-label={`${room.name}, ${figure(count)} ${ARCHIVE.items}`}
                >
                  <span className={styles.frame}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className={styles.cover}
                      src={libUrl(room.cover)}
                      alt=""
                      width={512}
                      height={512}
                      decoding="async"
                      crossOrigin="anonymous"
                    />
                    <span className={styles.veil} aria-hidden="true" />
                  </span>
                  <span className={styles.meta} aria-hidden="true">
                    <span className={styles.idx}>{room.index}</span>
                    <span className={styles.name}>{room.name}</span>
                    <span className={styles.more}>
                      <span className={styles.count}>
                        {figure(count)} {ARCHIVE.items}
                      </span>
                      <span className={styles.tag}>{room.tagline}</span>
                      <span className={styles.open}>{ARCHIVE.open}</span>
                    </span>
                  </span>
                </TLink>
              </li>
            );
          })}
        </ul>
        <div className={styles.foot} data-archive-button="">
          <Pill href={ARCHIVE.button.href} label="Collection">
            {ARCHIVE.button.label}
          </Pill>
        </div>
      </>
    ),
  };
}
