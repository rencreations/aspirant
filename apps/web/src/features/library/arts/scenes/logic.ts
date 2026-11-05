import type {
  Scene,
  SceneBeat,
  SceneFilm,
  SceneFilters,
  SceneGroup,
  SceneView,
  ShownFilm,
} from "./types";

/**
 * The still a visitor chose on a scrubber (a press or an arrow key), by film. A row of stills
 * shares one reading line, so the page cannot tell which one of the row was meant: the scrubber
 * shows this one while it sits on the reading line.
 */
export const sceneFocus = new Map<string, number>();

export const NO_SCENE_FILTERS: SceneFilters = { q: "", who: "", pair: "", film: "" };

export function hasSceneFilters(f: SceneFilters): boolean {
  return Boolean(f.q.trim() || f.who || f.pair || f.film);
}

function tokens(q: string): string[] {
  return q
    .toLowerCase()
    .split(/\s+/u)
    .filter((t) => t.length > 0);
}

/** Does a still match the words of the search? Every word must be found in the film, the note or the time. */
function sceneMatches(film: SceneFilm, scene: Scene, words: readonly string[]): boolean {
  if (words.length === 0) return true;
  const hay = `${film.title} ${film.kind} ${scene.note} ${scene.time}`.toLowerCase();
  return words.every((w) => hay.includes(w));
}

/** The stills of a film in groups by section. A film without sections is one group. */
export function groupScenes(film: SceneFilm, scenes: readonly Scene[]): SceneGroup[] {
  if (film.beats.length === 0) {
    return scenes.length ? [{ key: "all", beat: null, scenes: [...scenes] }] : [];
  }
  const byIndex = new Map<number, SceneBeat>(film.beats.map((b) => [b.i, b]));
  const groups: SceneGroup[] = [];
  for (const s of scenes) {
    const last = groups[groups.length - 1];
    const key = s.beat === null ? "none" : `b${s.beat}`;
    if (last?.key === key) {
      last.scenes.push(s);
    } else {
      groups.push({
        key,
        beat: s.beat === null ? null : (byIndex.get(s.beat) ?? null),
        scenes: [s],
      });
    }
  }
  return groups;
}

/** Apply the filters. `omit` leaves one filter out (to count what each chip would show). */
export function filterFilms(
  films: readonly SceneFilm[],
  filters: SceneFilters,
  omit?: keyof SceneFilters,
): ShownFilm[] {
  const words = omit === "q" ? [] : tokens(filters.q);
  const out: ShownFilm[] = [];
  for (const film of films) {
    if (omit !== "who" && filters.who && !film.chars.includes(filters.who as never)) continue;
    if (omit !== "pair" && filters.pair && film.pair !== filters.pair) continue;
    if (omit !== "film" && filters.film && film.id !== filters.film) continue;
    const scenes = words.length
      ? film.scenes.filter((s) => sceneMatches(film, s, words))
      : film.scenes;
    if (scenes.length === 0) continue;
    out.push({ film, scenes, groups: groupScenes(film, scenes) });
  }
  return out;
}

export interface SceneFacets {
  who: Record<string, number>;
  pair: Record<string, number>;
  film: Record<string, number>;
}

/** How many stills each chip would show, with the other filters kept. */
export function sceneFacets(films: readonly SceneFilm[], filters: SceneFilters): SceneFacets {
  const who: Record<string, number> = {};
  const pair: Record<string, number> = {};
  const film: Record<string, number> = {};
  for (const s of filterFilms(films, filters, "who")) {
    for (const c of s.film.chars) who[c] = (who[c] ?? 0) + s.scenes.length;
  }
  for (const s of filterFilms(films, filters, "pair")) {
    pair[s.film.pair] = (pair[s.film.pair] ?? 0) + s.scenes.length;
  }
  for (const s of filterFilms(films, filters, "film")) {
    film[s.film.id] = s.scenes.length;
  }
  return { who, pair, film };
}

export function countScenes(shown: readonly ShownFilm[]): number {
  return shown.reduce((n, s) => n + s.scenes.length, 0);
}

/** One line for the screen reader, and the label of the bar. */
export function sceneSummary(
  shown: readonly ShownFilm[],
  totalScenes: number,
  filtered: boolean,
): string {
  const n = countScenes(shown);
  const films = `${shown.length} ${shown.length === 1 ? "film" : "films"}`;
  if (!filtered) return `${n.toLocaleString("en-US")} stills in ${films}`;
  return `${n.toLocaleString("en-US")} of ${totalScenes.toLocaleString("en-US")} stills in ${films}`;
}

/** `1:40` for a length in seconds. */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/** `mm:ss` for a time in seconds. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** The address that opens a film at a second in the Films room. */
export function watchHref(filmId: string, t: number): string {
  return `/collection/films?i=${encodeURIComponent(filmId)}&t=${Math.max(0, Math.floor(t))}`;
}

/** Where a time sits on the film, 0 to 1. */
export function fractionOf(t: number, duration: number): number {
  if (duration <= 0) return 0;
  return Math.min(1, Math.max(0, t / duration));
}

/** The still nearest to a place on the film (0 to 1). */
export function nearestIndex(scenes: readonly Scene[], fraction: number, duration: number): number {
  if (scenes.length === 0) return -1;
  const t = fraction * duration;
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < scenes.length; i += 1) {
    const d = Math.abs((scenes[i]?.t ?? 0) - t);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/**
 * The still at the reading line: the first one whose bottom edge is below `probe`. `bottoms` are
 * the bottom edges of the stills in order (they never decrease), so this is a binary search.
 */
export function currentIndex(bottoms: readonly number[], probe: number): number {
  let lo = 0;
  let hi = bottoms.length - 1;
  if (hi < 0) return -1;
  if ((bottoms[hi] ?? 0) <= probe) return hi;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((bottoms[mid] ?? 0) > probe) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

/** Columns of a grid that fits as many cells of at least `min` pixels as it can. */
export function columnsFor(width: number, min: number, gap: number): number {
  return Math.max(1, Math.floor((width + gap) / (min + gap)));
}

/** Sizes the style sheet uses, in pixels at 16 px to the rem. They only feed the height estimate. */
const LAYOUT = {
  strips: { min: 176, gap: 0, chrome: 30, rowGap: 22, group: 28 },
  sheet: { min: 104, gap: 0, chrome: 18, rowGap: 8, group: 24 },
  head: 170,
  scrubber: 64,
  beatHead: 34,
  /** On a phone the note of a section wraps to two or three lines. */
  beatHeadNarrow: 70,
  foot: 0,
} as const;

/**
 * A close guess of a film section's height, for `contain-intrinsic-size`, so a far section that
 * has not been drawn yet takes about the room it will need and the page does not jump.
 */
export function estimateHeight(shown: ShownFilm, width: number, view: SceneView): number {
  const spec = LAYOUT[view];
  const cols = columnsFor(width, spec.min, spec.gap);
  const cellW = (width - spec.gap * (cols - 1)) / cols;
  const ar = shown.film.w > 0 && shown.film.h > 0 ? shown.film.w / shown.film.h : 16 / 9;
  const cellH = cellW / ar + spec.chrome;
  let h: number = LAYOUT.head + LAYOUT.scrubber + LAYOUT.foot;
  const groups = view === "sheet" ? [{ beat: null, scenes: shown.scenes }] : shown.groups;
  for (const g of groups) {
    const rows = Math.ceil(g.scenes.length / cols);
    h += rows * cellH + Math.max(0, rows - 1) * spec.rowGap;
    if (g.beat?.note) h += width < 640 ? LAYOUT.beatHeadNarrow : LAYOUT.beatHead;
    h += spec.group;
  }
  return Math.round(h);
}
