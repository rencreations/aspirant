"use client";

import type { Route } from "next";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { useTransitionRouter } from "@/components/transition/transition-provider";
import { audio } from "@/lib/audio";
import { libUrl } from "@/lib/library";
import { collectionRoute } from "@/lib/site";

import { fetchLibraryJson, libraryDataPath } from "../data";
import { COLLECTIONS, getCollection } from "../registry";
import type { CollectionSlug, SearchEntry } from "../types";
import { countByCollection, searchEntries } from "./search-match";
import { artsRoomHref } from "../arts/core/routes";
import { openPost } from "../design/route";
import { videoRoomOf, videoRoute } from "../video/links";
import styles from "./search-overlay.module.css";
import { useLibrarySearch } from "./search-store";

/** Open an entry: change the query of the room we are in, or travel to the room. */
function go(entry: SearchEntry, push: (href: Route, options: { label: string }) => void) {
  // A post of Design has its own address: it opens as a window over the room.
  if (entry.c === "design" && entry.s) {
    if (window.location.pathname.startsWith("/collection/design")) {
      openPost(entry.s);
      return;
    }
    push(`/collection/design/${entry.s}/` as Route, { label: getCollection(entry.c).name });
    return;
  }
  const base: string =
    entry.c === "video"
      ? videoRoute(videoRoomOf(entry.id))
      : entry.c === "arts"
        ? artsRoomHref(entry.r, entry.w[0])
        : collectionRoute(entry.c);
  const query = `?i=${encodeURIComponent(entry.id)}`;
  const here = window.location.pathname.replace(/\/+$/u, "");
  if (here.endsWith(base)) {
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${query}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  push(`${base}${query}` as Route, { label: getCollection(entry.c).name });
}

/**
 * The library search: one sheet over every room. It reads `search.json` (made by
 * `scripts/library/build_index.py`) the first time it opens. Up and down choose a result, Enter
 * opens it, Esc closes.
 */
export default function SearchOverlay() {
  const open = useLibrarySearch((s) => s.open);
  const setOpen = useLibrarySearch((s) => s.setOpen);
  const router = useTransitionRouter();
  const [entries, setEntries] = useState<SearchEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [room, setRoom] = useState<CollectionSlug | "">("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open || entries || failed) return;
    fetchLibraryJson<SearchEntry[]>(libraryDataPath("search")).then(setEntries, () => {
      setFailed(true);
    });
  }, [open, entries, failed]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    const lock = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = lock;
      previous?.focus?.();
    };
  }, [open]);

  const results = useMemo(
    () => (entries ? searchEntries(entries, query, room) : []),
    [entries, query, room],
  );
  const counts = useMemo(
    () => (entries ? countByCollection(entries, query) : {}),
    [entries, query],
  );

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({
      block: "nearest",
    });
  }, [active]);

  if (!open) return null;

  const close = () => {
    setOpen(false);
  };
  const pick = (entry: SearchEntry) => {
    audio.blip("click");
    close();
    go(entry, (href, options) => {
      router.push(href, options);
    });
  };

  return (
    <div
      className={styles.sheet}
      role="dialog"
      aria-modal="true"
      aria-label="Search the collection"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          close();
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          setActive((a) => Math.min(a + 1, Math.max(results.length - 1, 0)));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setActive((a) => Math.max(a - 1, 0));
        } else if (e.key === "Enter" && results[active]) {
          e.preventDefault();
          pick(results[active].entry);
        }
      }}
    >
      <button type="button" className={styles.scrim} aria-label="Close search" onClick={close} />
      <div className={styles.panel}>
        <div className={styles.head}>
          <span className="hud-label">Search the collection</span>
          <button type="button" className={`${styles.close} hud-label`} onClick={close}>
            Close (Esc)
          </button>
        </div>
        <input
          ref={inputRef}
          className={`${styles.input} display`}
          type="search"
          value={query}
          placeholder="A name, a film, a word"
          autoComplete="off"
          spellCheck={false}
          aria-label="Search"
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
        />
        <div className={styles.rooms} role="group" aria-label="Limit to one room">
          <button
            type="button"
            className={styles.room}
            aria-pressed={room === ""}
            onClick={() => {
              setRoom("");
              setActive(0);
            }}
          >
            All
          </button>
          {COLLECTIONS.map((c) => (
            <button
              key={c.slug}
              type="button"
              className={styles.room}
              aria-pressed={room === c.slug}
              style={{ "--room": c.colour } as CSSProperties}
              onClick={() => {
                setRoom(room === c.slug ? "" : c.slug);
                setActive(0);
              }}
            >
              {c.name}
              {query.trim() ? <span className={styles.n}>{counts[c.slug] ?? 0}</span> : null}
            </button>
          ))}
        </div>
        <p className={`${styles.status} hud-label`} role="status" aria-live="polite">
          {failed
            ? "The search index could not be loaded."
            : !entries
              ? "Loading the index"
              : !query.trim()
                ? "Type to search every room."
                : `${results.length} result${results.length === 1 ? "" : "s"}`}
        </p>
        <ul ref={listRef} className={styles.list} role="listbox" aria-label="Results">
          {results.map(({ entry }, i) => {
            const meta = getCollection(entry.c);
            return (
              <li key={`${entry.c}-${entry.id}`} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  className={styles.row}
                  style={{ "--room": meta.colour, "--i": Math.min(i, 14) } as CSSProperties}
                  onMouseMove={() => {
                    if (active !== i) setActive(i);
                  }}
                  onClick={() => {
                    pick(entry);
                  }}
                >
                  <span className={styles.thumb} aria-hidden="true">
                    {entry.i ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={libUrl(entry.i)} alt="" loading="lazy" decoding="async" />
                    ) : null}
                  </span>
                  <span className={styles.title}>{entry.t}</span>
                  <span className={`${styles.tag} hud-label`}>{meta.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
