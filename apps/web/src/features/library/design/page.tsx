"use client";

import { useCallback, useEffect, useMemo } from "react";

import { useLibraryData } from "../data";
import { LibraryFooter } from "../shell/library-shell";
import { useQueryState } from "../use-query-state";
import { DesignBar, type Counts } from "./bar";
import {
  FACETS,
  NO_FILTERS,
  groupByYear,
  haystack,
  passes,
  valuesOf,
  yearOf,
  type Filters,
} from "./model";
import { useDesignRoute } from "./route";
import { DesignStage } from "./stage";
import type { DesignFile, DesignPost } from "./types";
import { PostViewer } from "./viewer";
import { Wall } from "./wall";
import styles from "./page.module.css";

/**
 * The Design room: the promotional posts and graphics, by campaign and year. A film opens the page,
 * the wall rises over it, and a post opens as a window over the wall at its own address,
 * `/collection/design/<slug>/` (see `route.ts`). The room is drawn by `app/collection/design/layout.tsx`.
 */
export default function DesignPage() {
  const { data, failed } = useLibraryData<DesignPost>("design");
  const file = data as DesignFile | null;

  const [q, setQ] = useQueryState("q");
  const [pair, setPair] = useQueryState("pair");
  const [year, setYear] = useQueryState("year");
  const [fmt, setFmt] = useQueryState("fmt");
  const [sort, setSort] = useQueryState("sort", "old");
  const route = useDesignRoute();

  const newestFirst = sort === "new";
  const filters: Filters = useMemo(() => ({ q, pair, year, fmt }), [q, pair, year, fmt]);
  const setters: Record<keyof Filters, (v: string) => void> = useMemo(
    () => ({ q: setQ, pair: setPair, year: setYear, fmt: setFmt }),
    [setQ, setPair, setYear, setFmt],
  );
  const onFilter = useCallback(
    (key: keyof Filters, value: string) => {
      setters[key](value);
    },
    [setters],
  );
  const onClear = useCallback(() => {
    (Object.keys(NO_FILTERS) as Array<keyof Filters>).forEach((k) => {
      setters[k]("");
    });
  }, [setters]);

  const model = useMemo(() => {
    if (!file) return null;
    const byId = new Map(file.items.map((p) => [p.id, p]));
    const bySlug = new Map(file.items.map((p) => [p.slug, p]));
    const campaignById = new Map(file.campaigns.map((c) => [c.id, c]));
    const texts = new Map(file.items.map((p) => [p.id, haystack(p, campaignById.get(p.campaign))]));
    const years = [...new Set(file.items.map((p) => yearOf(p.date)))].sort();
    return { byId, bySlug, campaignById, texts, years };
  }, [file]);

  const shown = useMemo(() => {
    if (!file || !model) return null;
    const visible = new Set(
      file.items.filter((p) => passes(p, model.texts.get(p.id) ?? "", filters)).map((p) => p.id),
    );
    const groups = groupByYear(file.campaigns, model.byId, visible, newestFirst);
    const flat = groups.flatMap((y) => y.campaigns.flatMap((c) => c.posts));
    // What each choice of a facet would leave, with the other choices kept.
    const counts = Object.fromEntries(FACETS.map((k) => [k, {}])) as unknown as Counts;
    for (const p of file.items) {
      const text = model.texts.get(p.id) ?? "";
      for (const k of FACETS) {
        if (!passes(p, text, filters, k)) continue;
        for (const v of valuesOf(p, k)) counts[k][v] = (counts[k][v] ?? 0) + 1;
      }
    }
    return { visible, groups, flat, counts };
  }, [file, model, filters, newestFirst]);

  // An old link, `/collection/design/?i=<id>`, becomes the address of the post.
  useEffect(() => {
    if (!model) return;
    const id = new URLSearchParams(window.location.search).get("i");
    if (!id) return;
    const post = model.byId.get(id);
    if (post) route.forward(post.slug);
  }, [model, route]);

  const open = route.slug && model ? model.bySlug.get(route.slug) : undefined;
  // The window moves through what is on the wall; a post the filters hide still opens, among all.
  const list = useMemo(() => {
    if (!shown || !file) return [];
    return open && !shown.visible.has(open.id) ? [...shown.flat, open] : shown.flat;
  }, [shown, file, open]);
  const position = open ? list.findIndex((p) => p.id === open.id) + 1 : 0;

  const onStep = useCallback(
    (delta: number) => {
      if (!open) return;
      const next = list[list.findIndex((p) => p.id === open.id) + delta];
      if (next) route.step(next.slug);
    },
    [list, open, route],
  );

  const total = file?.items.length ?? 0;
  const count = shown?.visible.size ?? 0;

  if (failed) {
    return (
      <main className="shell">
        <p className={styles.empty}>
          The contents could not be read. Reload the page to try again.
        </p>
      </main>
    );
  }
  if (!file || !model || !shown) return null;

  return (
    <>
      <DesignStage hero={file.hero} total={total} paused={Boolean(open)}>
        <DesignBar
          filters={filters}
          onFilter={onFilter}
          onClear={onClear}
          newestFirst={newestFirst}
          onSort={(newest) => {
            setSort(newest ? "new" : "old");
          }}
          counts={shown.counts}
          years={model.years}
          shown={count}
          total={total}
        />
        <main className={`${styles.wall} shell`}>
          {shown.flat.length === 0 ? (
            <div className={styles.empty}>
              <p>No content matches these choices.</p>
              <button type="button" className={styles.reset} onClick={onClear}>
                Clear
              </button>
            </div>
          ) : (
            <Wall years={shown.groups} activeSlug={route.slug} onOpen={route.open} />
          )}
        </main>
        <LibraryFooter slug="design" />
      </DesignStage>

      {open ? (
        <PostViewer
          post={open}
          position={position}
          total={list.length}
          campaign={model.campaignById.get(open.campaign)}
          onClose={route.close}
          onStep={onStep}
        />
      ) : null}
    </>
  );
}
