"use client";

import { useMemo } from "react";

import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import { libUrl } from "@/lib/library";

import { useQueryState } from "../../use-query-state";
import { chapterChip } from "./chapters";
import styles from "./codex-view.module.css";
import { isUnmet, lorePath, scoreEntry } from "./model";
import type { Reach } from "./reach";
import { CODEX_KINDS, KIND_META, type CodexEntry, type CodexKind } from "./types";
import type { Codex } from "./use-codex";

export interface CodexViewProps {
  codex: Codex;
  terms: readonly string[];
  reach: Reach;
  onOpen: (slug: string) => void;
}

const thumbOf = (e: CodexEntry): string | null => {
  const m = e.media[0];
  if (!m) return null;
  const src = m.thumb ?? m.src;
  return src.startsWith("lib:") ? libUrl(src.slice(4)) : asset(src);
};

function Card({
  entry,
  unmet,
  onOpen,
  showKind,
}: {
  entry: CodexEntry;
  unmet: boolean;
  onOpen: (slug: string) => void;
  showKind: boolean;
}) {
  const thumb = unmet ? null : thumbOf(entry);
  return (
    <li className={styles.item}>
      <a
        href={lorePath(entry.slug)}
        className={styles.card}
        data-kind={entry.kind}
        data-unmet={unmet ? "1" : undefined}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
          e.preventDefault();
          audio.blip("click");
          onOpen(entry.slug);
        }}
      >
        <span className={styles.thumb} aria-hidden="true">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" loading="lazy" decoding="async" draggable={false} />
          ) : (
            <span className={styles.glyph}>
              {unmet ? "?" : entry.name.replace(/^The /u, "").charAt(0)}
            </span>
          )}
        </span>
        <span className={styles.text}>
          <span className={styles.sub}>
            {showKind ? `${KIND_META[entry.kind].label} / ` : ""}
            {unmet ? "ahead of you" : entry.sub}
          </span>
          <span className={styles.name}>{unmet ? "Not met yet" : entry.name}</span>
          <span className={styles.line}>
            {unmet ? `First in ${chapterChip(entry.first)}` : entry.line}
          </span>
        </span>
      </a>
    </li>
  );
}

/**
 * The codex: every entry of the story as a card, by kind, with the search over all of them. A
 * card opens the entry in a window with its own address. Entries the reader has not reached are
 * shut while the spoiler shield is on.
 */
export function CodexView({ codex, terms, reach, onOpen }: CodexViewProps) {
  const [kindParam, setKind] = useQueryState("kind", "person");
  const kind: CodexKind = CODEX_KINDS.includes(kindParam as CodexKind)
    ? (kindParam as CodexKind)
    : "person";
  const searching = terms.length > 0;

  const list = useMemo(() => {
    if (searching) {
      return codex.file.entries
        .map((e) => ({
          e,
          s: scoreEntry(codex.hay.get(e.slug) ?? { name: "", aka: "", rest: "" }, terms),
        }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s || codex.weight(b.e.slug) - codex.weight(a.e.slug))
        .map((x) => x.e);
    }
    return [...(codex.byKind.get(kind) ?? [])].sort(
      (a, b) => codex.weight(b.slug) - codex.weight(a.slug) || a.name.localeCompare(b.name),
    );
  }, [codex, kind, terms, searching]);

  const ahead = useMemo(
    () => codex.file.entries.filter((e) => isUnmet(e, reach.reach)).length,
    [codex, reach.reach],
  );

  return (
    <section className={styles.codex} aria-label="The codex">
      {reach.shield ? (
        <p className={styles.shield} role="status">
          <b>Spoiler shield on.</b>{" "}
          {reach.furthest < 0
            ? "You have not started the story, so nothing is open."
            : `You have read up to chapter ${String(reach.furthest)}.`}{" "}
          {ahead > 0 ? `${String(ahead)} entries are ahead of you. ` : ""}
          <button
            type="button"
            className={styles.shieldButton}
            onClick={() => {
              reach.setShield(false);
            }}
          >
            Show everything
          </button>
        </p>
      ) : (
        <p className={styles.shield} role="status">
          <b>Everything is shown, spoilers included.</b>{" "}
          {reach.furthest >= 0 ? (
            <button
              type="button"
              className={styles.shieldButton}
              onClick={() => {
                reach.setShield(true);
              }}
            >
              Hide what I have not read
            </button>
          ) : (
            "You have not started the story yet."
          )}
        </p>
      )}

      {!searching ? (
        <div className={styles.tabs} role="group" aria-label="Kinds">
          {CODEX_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              className={styles.tab}
              data-kind={k}
              aria-pressed={kind === k}
              onClick={() => {
                if (kind !== k) audio.blip("click");
                setKind(k);
              }}
            >
              {KIND_META[k].plural}
              <span className={styles.count}>{codex.byKind.get(k)?.length ?? 0}</span>
            </button>
          ))}
        </div>
      ) : null}

      <p className={`${styles.summary} hud-label`} role="status">
        {searching
          ? `${String(list.length)} ${list.length === 1 ? "entry matches" : "entries match"}`
          : KIND_META[kind].line}
      </p>

      {list.length === 0 ? (
        <p className={styles.none}>Nothing in the lore matches that.</p>
      ) : (
        <ul className={styles.grid}>
          {list.map((e) => (
            <Card
              key={e.slug}
              entry={e}
              unmet={isUnmet(e, reach.reach)}
              onOpen={onOpen}
              showKind={searching}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
