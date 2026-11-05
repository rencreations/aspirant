"use client";

import { useCallback, useMemo } from "react";

import { useLibraryData } from "../data";
import { LibraryShell } from "../shell/library-shell";
import { useQueryState } from "../use-query-state";
import { DesignControls, type Counts } from "./controls";
import {
  NO_FILTERS,
  activeCount,
  groupByYear,
  haystack,
  pairsOf,
  passes,
  yearOf,
  type FacetKey,
  type Filters,
} from "./model";
import type { DesignFile, DesignPost } from "./types";
import { PostViewer } from "./viewer";
import { Wall, type View } from "./wall";
import styles from "./page.module.css";

const FACETS: FacetKey[] = ["pair", "who", "year", "fmt", "canon", "topic"];

/** The promotional posts and graphics, by campaign and year, with a study table for each one. */
export default function DesignPage() {
  const { data, failed } = useLibraryData<DesignPost>("design");
  const file = data as DesignFile | null;

  const [q, setQ] = useQueryState("q");
  const [pair, setPair] = useQueryState("pair");
  const [who, setWho] = useQueryState("who");
  const [year, setYear] = useQueryState("year");
  const [fmt, setFmt] = useQueryState("fmt");
  const [canon, setCanon] = useQueryState("canon");
  const [topic, setTopic] = useQueryState("topic");
  const [viewParam, setViewParam] = useQueryState("view", "posted");
  const [sort, setSort] = useQueryState("sort", "old");
  const [openId, setOpenId] = useQueryState("i");

  const view: View = viewParam === "details" ? "details" : "posted";
  const newestFirst = sort === "new";
  const filters: Filters = useMemo(
    () => ({ q, pair, who, year, fmt, canon, topic }),
    [q, pair, who, year, fmt, canon, topic],
  );

  const setters: Record<keyof Filters, (v: string) => void> = useMemo(
    () => ({
      q: setQ,
      pair: setPair,
      who: setWho,
      year: setYear,
      fmt: setFmt,
      canon: setCanon,
      topic: setTopic,
    }),
    [setQ, setPair, setWho, setYear, setFmt, setCanon, setTopic],
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
    const campaignById = new Map(file.campaigns.map((c) => [c.id, c]));
    const texts = new Map(file.items.map((p) => [p.id, haystack(p, campaignById.get(p.campaign))]));
    const years = [...new Set(file.items.map((p) => yearOf(p.date)))].sort();
    return { byId, campaignById, texts, years };
  }, [file]);

  const shown = useMemo(() => {
    if (!file || !model) return null;
    const visible = new Set(
      file.items.filter((p) => passes(p, model.texts.get(p.id) ?? "", filters)).map((p) => p.id),
    );
    const groups = groupByYear(file.campaigns, model.byId, visible, newestFirst);
    const flat = groups.flatMap((y) => y.campaigns.flatMap((c) => c.posts));
    const counts = Object.fromEntries(
      FACETS.map((k): [FacetKey, Record<string, number>] => [k, {}]),
    ) as Counts;
    for (const p of file.items) {
      const text = model.texts.get(p.id) ?? "";
      for (const k of FACETS) {
        if (!passes(p, text, filters, k)) continue;
        const values =
          k === "pair"
            ? pairsOf(p)
            : k === "who"
              ? p.chars
              : k === "year"
                ? [yearOf(p.date)]
                : k === "fmt"
                  ? [p.kind]
                  : k === "canon"
                    ? [p.canon]
                    : p.tags;
        for (const v of values) counts[k][v] = (counts[k][v] ?? 0) + 1;
      }
    }
    return {
      visible,
      groups,
      flat,
      counts,
      campaignCount: groups.reduce((n, y) => n + y.campaigns.length, 0),
    };
  }, [file, model, filters, newestFirst]);

  const open = openId && model ? model.byId.get(openId) : undefined;
  const position = open && shown ? shown.flat.findIndex((p) => p.id === open.id) + 1 : 0;

  const onStep = useCallback(
    (delta: number) => {
      if (!shown) return;
      const idx = shown.flat.findIndex((p) => p.id === openId);
      const next = shown.flat[idx < 0 ? 0 : idx + delta];
      if (next) setOpenId(next.id);
    },
    [shown, openId, setOpenId],
  );

  const total = file?.items.length ?? 0;
  const count = shown?.visible.size ?? 0;
  const reels = file?.items.filter((p) => p.kind === "reel").length ?? 0;
  const slides = file?.items.reduce((n, p) => n + (p.slides?.length ?? 0), 0) ?? 0;
  const first = model?.years[0];
  const last = model?.years[model.years.length - 1];
  const stat = file
    ? `${first} to ${last}, ${file.campaigns.length} campaigns, ${slides} pictures, ${reels} reels`
    : undefined;
  const summary = !shown
    ? "Loading"
    : count === total && activeCount(filters) === 0 && !filters.q
      ? `${total} posts in ${shown.campaignCount} campaigns`
      : count === 0
        ? "No post matches"
        : `${count} of ${total} posts in ${shown.campaignCount} ${shown.campaignCount === 1 ? "campaign" : "campaigns"}`;

  return (
    <LibraryShell
      slug="design"
      count={file ? total : null}
      {...(stat ? { stat } : {})}
      controls={
        file && model && shown ? (
          <DesignControls
            filters={filters}
            onFilter={onFilter}
            onClear={onClear}
            view={view}
            onView={(v) => {
              setViewParam(v);
            }}
            newestFirst={newestFirst}
            onSort={(newest) => {
              setSort(newest ? "new" : "old");
            }}
            summary={summary}
            counts={shown.counts}
            years={model.years}
            topics={file.topics}
          />
        ) : undefined
      }
    >
      <div className="shell">
        {failed ? (
          <p className={styles.empty}>The posts could not be read. Reload the page to try again.</p>
        ) : !shown ? null : shown.flat.length === 0 ? (
          <div className={styles.empty}>
            <p>No post matches these filters.</p>
            <button type="button" className={styles.reset} onClick={onClear}>
              Clear the filters
            </button>
          </div>
        ) : (
          <Wall
            years={shown.groups}
            view={view}
            activeId={openId}
            onOpen={(id) => {
              setOpenId(id);
            }}
          />
        )}
      </div>

      {open && file && model ? (
        <PostViewer
          post={open}
          position={position}
          total={shown?.flat.length ?? 0}
          campaign={model.campaignById.get(open.campaign)}
          view={view}
          onView={(v) => {
            setViewParam(v);
          }}
          onClose={() => {
            setOpenId("");
          }}
          onStep={onStep}
        />
      ) : null}
    </LibraryShell>
  );
}
