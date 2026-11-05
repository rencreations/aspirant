import type { CSSProperties } from "react";

import { TLink } from "@/components/transition/t-link";
import { libUrl } from "@/lib/library";
import { collectionRoute } from "@/lib/site";

import { COLLECTIONS } from "../registry";
import styles from "./shelf-fallback.module.css";

/**
 * The ten covers as a plain grid of links. It is always in the page HTML (crawlers, keyboards,
 * screen readers) and it is what a visitor sees when WebGL is missing. The shelf scene draws
 * over it.
 */
export function ShelfFallback() {
  return (
    <nav aria-label="The ten collections" className={`${styles.grid} shell below-nav`}>
      <h1 className={`${styles.title} display`}>Collection</h1>
      <ul className={styles.list}>
        {COLLECTIONS.map((c) => (
          <li key={c.slug}>
            <TLink
              href={collectionRoute(c.slug)}
              transitionLabel={c.name}
              className={styles.card}
              style={{ "--cover-colour": c.colour } as CSSProperties}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={libUrl(c.cover)} alt="" width={512} height={512} loading="lazy" />
              <span className="hud-label">{c.index}</span>
              <span className={`${styles.name} display`}>{c.name}</span>
              <span className={styles.line}>{c.tagline}</span>
            </TLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
