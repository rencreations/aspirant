"use client";

import type { CSSProperties, ReactNode } from "react";

import { StarGlyph } from "@/components/star-glyph";
import { ThemeZone } from "@/components/theme-zone";
import { TLink } from "@/components/transition/t-link";
import { libUrl } from "@/lib/library";
import { collectionRoute, routes } from "@/lib/site";

import { COLLECTIONS, getCollection, nextCollection } from "../registry";
import { SearchButton } from "../search/search-host";
import type { CollectionSlug } from "../types";
import styles from "./library-shell.module.css";

export interface LibraryShellProps {
  slug: CollectionSlug;
  /** Number of items in the collection. Null while the data is loading. */
  count: number | null;
  /** A second figure: a runtime, a size, "3 comics". */
  stat?: string;
  /** The sticky bar of filters and search, drawn under the header. */
  controls?: ReactNode;
  children: ReactNode;
}

/** Where a takedown request goes. */
const TAKEDOWN_URL = "https://github.com/rencreations/aspirant/issues";

/**
 * The frame of every collection page: the header (breadcrumb, the name, one sentence, the
 * count, the cover), the switcher to the other nine, the page's own controls and content, and
 * the footer (what this archive is, how to ask for a removal, the next room).
 */
export function LibraryShell({ slug, count, stat, controls, children }: LibraryShellProps) {
  const meta = getCollection(slug);
  const next = nextCollection(slug);
  const vars = { "--lib-colour": meta.colour, "--lib-ink": meta.ink } as CSSProperties;

  return (
    <ThemeZone theme="daybreak" as="div" className={styles.page} style={vars}>
      <header className={`${styles.header} below-nav`}>
        <div className={`${styles.grid} grid-hex fade-edges`} aria-hidden="true" />
        <p className={styles.ghost} aria-hidden="true">
          {meta.index}
        </p>
        <div className="relative shell">
          <p className={`${styles.crumb} hud-label`}>
            <StarGlyph className="size-3 text-accent" />
            <TLink href={routes.collection} transitionLabel="Collection" className={styles.back}>
              Collection
            </TLink>
            <span aria-hidden="true">/</span>
            <span>
              {meta.index} {meta.name}
            </span>
            <SearchButton className={styles.search} />
          </p>

          <div className={styles.row}>
            <div className={styles.main}>
              <h1 className={`${styles.title} display`}>{meta.name}</h1>
              <p className={styles.line}>{meta.line}</p>
              <p className={`${styles.stats} hud-label`}>
                <span className={styles.count}>
                  {count === null ? "..." : count.toLocaleString("en-US")}
                </span>
                <span>{count === 1 ? "item" : "items"}</span>
                {stat ? (
                  <>
                    <span aria-hidden="true" className={styles.dot} />
                    <span>{stat}</span>
                  </>
                ) : null}
              </p>
            </div>
            <div className={styles.cover} aria-hidden="true">
              {/* A decorative copy of the shelf cover. It hides itself if the file is missing. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={libUrl(meta.cover)}
                alt=""
                width={512}
                height={512}
                decoding="async"
                crossOrigin="anonymous"
                onError={(e) => {
                  e.currentTarget.style.visibility = "hidden";
                }}
              />
            </div>
          </div>

          <nav aria-label="Rooms of the collection" className={styles.switcher}>
            {COLLECTIONS.map((c) => (
              <TLink
                key={c.slug}
                href={collectionRoute(c.slug)}
                transitionLabel={c.name}
                className={styles.pill}
                aria-current={c.slug === slug ? "page" : undefined}
                style={{ "--pill-colour": c.colour, "--pill-ink": c.ink } as CSSProperties}
              >
                <span className={styles.pillIndex}>{c.index}</span>
                <span>{c.name}</span>
              </TLink>
            ))}
          </nav>
        </div>
      </header>

      {controls}

      <div className={styles.body}>{children}</div>

      <footer className={`${styles.foot} shell`}>
        <p className={styles.note}>
          A fan made archive. Aspirant and Mobile Legends: Bang Bang belong to Moonton, and this
          site is not affiliated with them. Fan work belongs to the people who made it and is shown
          with credit. To ask for something to be taken down, open an issue at{" "}
          <TLink href={TAKEDOWN_URL} className="link">
            the project page
          </TLink>
          .
        </p>
        <TLink
          href={collectionRoute(next.slug)}
          transitionLabel={next.name}
          className={styles.next}
          style={{ "--pill-colour": next.colour, "--pill-ink": next.ink } as CSSProperties}
        >
          <span className="hud-label">Next room, {next.index}</span>
          <span className={`${styles.nextName} display`}>{next.name}</span>
          <span className={styles.nextLine}>{next.tagline}</span>
        </TLink>
      </footer>
    </ThemeZone>
  );
}
