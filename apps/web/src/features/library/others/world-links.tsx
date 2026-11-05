"use client";

import type { CSSProperties } from "react";

import { TLink } from "@/components/transition/t-link";
import { asset } from "@/lib/asset";
import { isCharacterSlug } from "@/lib/slugs";
import { characterRoute, routes } from "@/lib/site";

import styles from "./sections.module.css";
import type { LinkItem } from "./types";

/** Where a link item leads. `story` is the novel, `character:<slug>` a character page. */
function linkTarget(to: string) {
  if (to === "story") return routes.story;
  const slug = to.startsWith("character:") ? to.slice("character:".length) : "";
  return isCharacterSlug(slug) ? characterRoute(slug) : routes.collection;
}

/** The cards that lead out of the collection: the novel, the interactive drama and the ten pages. */
export function WorldLinks({ items }: { items: readonly LinkItem[] }) {
  return (
    <ul className={styles.links} aria-label="More of the world">
      {items.map((l, i) => (
        <li
          key={l.id}
          id={l.id}
          className={`${styles.item} ${i < 2 ? styles.linkBig : ""}`}
          style={{ "--i": i } as CSSProperties}
        >
          <TLink
            href={linkTarget(l.to)}
            transitionLabel={l.title}
            className={styles.link}
            data-testid={`link-${l.to}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={asset(l.local)} alt="" loading="lazy" decoding="async" draggable={false} />
            <span className={styles.linkText}>
              <span className={`${styles.linkTitle}`}>{l.title}</span>
              <span className={styles.linkLine}>{l.line}</span>
            </span>
          </TLink>
        </li>
      ))}
    </ul>
  );
}
