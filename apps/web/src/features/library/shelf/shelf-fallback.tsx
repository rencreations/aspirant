import type { CSSProperties } from "react";

import { TLink } from "@/components/transition/t-link";
import { libUrl } from "@/lib/library";
import { collectionRoute } from "@/lib/site";

import { COLLECTIONS } from "../registry";
import styles from "./shelf-fallback.module.css";
import { splitOf } from "./splits";

/**
 * The ten covers as a plain grid of links. It is always in the page HTML (crawlers, keyboards,
 * screen readers) and it is what a visitor sees when WebGL is missing. The shelf scene draws
 * over it. While the scene is live it has its own heading, so this one is a paragraph (`heading`
 * false): the page has one h1.
 *
 * A cover that opens into rooms on the shelf and has no plain page of its own (Arts) lists its rooms
 * as links under its card, so the three are real links here as well.
 */
export function ShelfFallback({ heading = true }: { heading?: boolean }) {
  return (
    <nav aria-label="The ten collections" className={`${styles.grid} shell below-nav`}>
      {heading ? (
        <h1 className={`${styles.title} display`}>Collection</h1>
      ) : (
        <p className={`${styles.title} display`}>Collection</p>
      )}
      <ul className={styles.list}>
        {COLLECTIONS.map((c) => {
          const spec = splitOf(c.slug);
          const rooms = spec && !spec.chooser ? spec.parts : null;
          return (
            <li key={c.slug} style={{ "--cover-colour": c.colour } as CSSProperties}>
              <TLink
                href={collectionRoute(c.slug)}
                transitionLabel={c.name}
                className={styles.card}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={libUrl(c.cover)}
                  alt=""
                  width={512}
                  height={512}
                  loading="lazy"
                  crossOrigin="anonymous"
                />
                <span className="hud-label">{c.index}</span>
                <span className={`${styles.name} display`}>{c.name}</span>
                <span className={styles.line}>{c.tagline}</span>
              </TLink>
              {rooms ? (
                <ul className={styles.rooms} aria-label={`${c.name} rooms`}>
                  {rooms.map((p) => (
                    <li key={p.id}>
                      <TLink
                        href={p.href}
                        transitionLabel={p.name}
                        className={styles.room}
                        data-shelf-part={p.id}
                      >
                        {p.name}
                      </TLink>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
