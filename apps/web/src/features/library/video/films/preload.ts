import { NAVIGATED_EVENT } from "@/lib/hooks";
import { libUrl } from "@/lib/library";
import { chunkItem, imageItem, type PreloadItem } from "@/lib/preload";

import { fetchLibraryJson, libraryDataItem, libraryDataPath } from "../../data";
import { mod, readDeepLink } from "./film-math";
import { FIRST_SECONDS, warmFilm, type FilmSource } from "./film-pool";
import type { FilmWork, FilmsFile } from "./types";

const ROUTE = "/collection/video/films";

/** The film as the pool knows it. */
export function filmSource(film: FilmWork): FilmSource {
  return { id: film.id, url: libUrl(film.video.src), dur: film.video.dur, bytes: film.bytes };
}

function readFilms(): Promise<FilmsFile> {
  return fetchLibraryJson<FilmsFile>(libraryDataPath("video-films"));
}

function onRoom(): boolean {
  return window.location.pathname.replace(/\/+$/u, "").endsWith(ROUTE);
}

/**
 * The query the room opens with (`?i=<id>&t=<s>`). On a first visit the address is already the
 * room's. On a page change the loading list starts before the address changes, so this waits for
 * the change itself (the transition tells when it has happened), never for a time.
 */
function roomQuery(): Promise<string> {
  if (onRoom()) return Promise.resolve(window.location.search);
  return new Promise((resolve) => {
    const check = () => {
      if (!onRoom()) return;
      window.removeEventListener(NAVIGATED_EVENT, check);
      window.removeEventListener("popstate", check);
      resolve(window.location.search);
    };
    window.addEventListener(NAVIGATED_EVENT, check);
    window.addEventListener("popstate", check);
  });
}

/**
 * The film the room opens on, ready to play: its poster, and the first `FIRST_SECONDS` of the film
 * itself buffered in the element the page will show (`film-pool.ts`). The bar moves with the real
 * seconds buffered.
 */
function firstFilmItem(): PreloadItem {
  return {
    id: "films-first",
    label: "Loading the first film",
    weight: 14,
    memo: false,
    run: async (report, context) => {
      const file = await readFilms();
      const query = await roomQuery();
      const ids = file.items.map((f) => f.id);
      const { index, t } = readDeepLink(query, ids);
      const film = file.items[index];
      if (!film) return;
      let poster = 0;
      let buffer = 0;
      let bytes = { received: 0, total: 0 };
      const tell = () => {
        report(0.1 * poster + 0.9 * buffer, bytes);
      };
      await Promise.all([
        imageItem(libUrl(film.video.poster), "Loading the first film")
          .run((f) => {
            poster = f;
            tell();
          }, context)
          .then(() => {
            poster = 1;
            tell();
          }),
        warmFilm(filmSource(film), {
          from: t,
          seconds: FIRST_SECONDS,
          onProgress: (f, b) => {
            buffer = f;
            bytes = b;
            tell();
          },
        }),
      ]);
    },
  };
}

/** Pictures of the room fetched into the browser cache, a few at a time, the nearest films first. */
function picturesItem(
  id: string,
  label: string,
  pick: (film: FilmWork) => string,
  priority: number,
  skipFirst: boolean,
): PreloadItem {
  return {
    id,
    label,
    weight: 1,
    deferred: true,
    priority,
    group: "library-video-films",
    run: async (report, context) => {
      const file = await readFilms();
      const ids = file.items.map((f) => f.id);
      const start = onRoom() ? readDeepLink(window.location.search, ids).index : 0;
      const n = file.items.length;
      // Next, the one before, the one after next, and so on round the ring.
      const order: number[] = [];
      for (let k = skipFirst ? 1 : 0; order.length < (skipFirst ? n - 1 : n); k += 1) {
        for (const i of k === 0 ? [start] : [start + k, start - k]) {
          const at = mod(i, n);
          if (!order.includes(at) && !(skipFirst && at === start)) order.push(at);
        }
      }
      let done = 0;
      const queue = [...order];
      const worker = async () => {
        for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
          const film = file.items[next];
          if (film) await imageItem(libUrl(pick(film)), label).run(() => undefined, context);
          done += 1;
          report(done / order.length);
        }
      };
      await Promise.all([worker(), worker()]);
    },
  };
}

/**
 * The loading list of `/collection/video/films`. Waited for: the data, the code, and the first film
 * (its poster and its first seconds). In the background: the other posters (nearest first), the
 * blurred backdrops and the small pictures of the contents.
 */
export function items(): PreloadItem[] {
  return [
    libraryDataItem("video-films"),
    chunkItem("library-video-films", "Opening the films", () => import("./page"), 2),
    firstFilmItem(),
    picturesItem("films-posters", "Loading the posters", (f) => f.video.poster, 12, true),
    picturesItem("films-backdrops", "Loading the posters", (f) => f.backdrop, 20, false),
    picturesItem("films-thumbs", "Loading the contents", (f) => f.thumb, 30, false),
  ];
}
