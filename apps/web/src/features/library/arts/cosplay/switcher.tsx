"use client";

import { useEffect, useRef } from "react";

import { useTransitionRouter } from "@/components/transition/transition-provider";
import { TLink } from "@/components/transition/t-link";
import type { CharacterSlug } from "@/lib/slugs";

import { useZoom } from "../core/zoom";
import { artsRoute, cosplayRoute } from "../core/routes";
import { neighbour, type RosterEntry } from "./model";
import styles from "./cosplay.module.css";

/** A key that belongs to a field or a button, not to the page. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/u.test(target.tagName);
}

/**
 * The quiet row of the ten Aspirants on a character's page: "All" (the roster) first, then each
 * with the number of her photos, the open page marked. Left and right keys step to the one before
 * or after (going round the ten) through the page curtain, unless a field has the keys, a key is
 * held with a modifier, or the zoom is open (its own arrows step the photos). On a narrow screen the
 * row slides sideways and the open Aspirant is brought to its middle.
 */
export function Switcher({
  current,
  roster,
}: {
  current: CharacterSlug;
  roster: readonly RosterEntry[];
}) {
  const router = useTransitionRouter();
  const { openId } = useZoom();
  const listRef = useRef<HTMLUListElement>(null);
  const openRef = useRef(openId);

  useEffect(() => {
    openRef.current = openId;
  }, [openId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (openRef.current !== null || isTyping(event.target)) return;
      // The zoom may be opening or closing: it has the arrows while its viewer is on the page.
      if (document.querySelector("[data-zoom-viewer]")) return;
      event.preventDefault();
      const next = neighbour(current, event.key === "ArrowRight" ? 1 : -1);
      router.push(cosplayRoute(next), { label: next });
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [current, router]);

  // A row that slides sideways keeps the open Aspirant in view (no scrollIntoView: it would move the page too).
  useEffect(() => {
    const list = listRef.current;
    const here = list?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!list || !here || list.scrollWidth <= list.clientWidth) return;
    list.scrollLeft = Math.max(0, here.offsetLeft - (list.clientWidth - here.offsetWidth) / 2);
  }, [current]);

  return (
    <nav className={styles.switcher} aria-label="Aspirants" data-cosplay-switcher="">
      <ul className={styles.switchList} ref={listRef}>
        <li>
          <TLink
            href={artsRoute("cosplay")}
            transitionLabel="Cosplay"
            className={styles.pick}
            data-cosplay-all=""
          >
            All
          </TLink>
        </li>
        {roster.map((entry) => (
          <li key={entry.slug}>
            <TLink
              href={cosplayRoute(entry.slug)}
              transitionLabel={entry.name}
              className={styles.pick}
              aria-current={entry.slug === current ? "page" : undefined}
              aria-label={
                entry.count === null
                  ? entry.name
                  : `${entry.name}, ${entry.count === 0 ? "no photos" : entry.count === 1 ? "1 photo" : `${entry.count} photos`}`
              }
              data-slug={entry.slug}
            >
              <span>{entry.name}</span>
              {entry.count === null ? null : (
                <span className={styles.num} data-zero={entry.count === 0 ? "" : undefined}>
                  {entry.count}
                </span>
              )}
            </TLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
