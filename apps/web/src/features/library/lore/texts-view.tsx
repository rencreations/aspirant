"use client";

import { useMemo, type CSSProperties, type MouseEvent } from "react";

import { audio } from "@/lib/audio";
import { CHARACTER_NAMES } from "@/lib/slugs";

import { Reader } from "./reader";
import { searchTexts } from "./search";
import { Hl } from "./text-body";
import styles from "./texts-view.module.css";
import { GROUP_TITLE, GROUPS, type LoreFile, type LoreText } from "./types";

export interface TextsViewProps {
  lore: LoreFile;
  q: string;
  terms: readonly string[];
  openId: string;
  onOpen: (id: string, heading?: string) => void;
  onClose: () => void;
  onPlace: (id: string) => void;
}

function plainClick(e: MouseEvent): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

function TextCard({
  text,
  index,
  number,
  terms,
  onOpen,
}: {
  text: LoreText;
  index: number;
  number: string;
  terms: readonly string[];
  onOpen: (id: string) => void;
}) {
  const names = text.chars.slice(0, 3).map((c) => CHARACTER_NAMES[c]);
  const more = text.chars.length - names.length;
  return (
    <a
      href={`?view=texts&i=${text.id}`}
      className={styles.card}
      style={{ "--i": index } as CSSProperties}
      data-older={text.rank === "older" ? "1" : "0"}
      onClick={(e) => {
        if (!plainClick(e)) return;
        e.preventDefault();
        audio.blip("click");
        onOpen(text.id);
      }}
    >
      <span className={styles.edge} aria-hidden="true" />
      <span className={styles.cardTop}>
        <span className={`${styles.number} hud-label`}>{number}</span>
        {text.rank === "older" ? (
          <span className={`${styles.older} hud-label`}>Older text</span>
        ) : null}
        <span className={`${styles.time} hud-label`}>{text.minutes} min</span>
      </span>
      <span className={`${styles.cardTitle} display`}>
        <Hl text={text.title} terms={terms} />
      </span>
      <span className={styles.cardLine}>{text.summary}</span>
      <span className={`${styles.cardFoot} hud-label`}>
        {names.length > 0 ? (
          <span>
            {names.join(", ")}
            {more > 0 ? ` +${more}` : ""}
          </span>
        ) : (
          <span>No Aspirant named</span>
        )}
        <span className={styles.open} aria-hidden="true">
          Read
        </span>
      </span>
    </a>
  );
}

/** The library of texts by group, the search results, or the reading room of one text. */
export function TextsView({ lore, q, terms, openId, onOpen, onClose, onPlace }: TextsViewProps) {
  const byId = useMemo(() => new Map(lore.texts.map((t) => [t.id, t] as const)), [lore.texts]);
  const results = useMemo(
    () => (terms.length > 0 ? searchTexts(lore.texts, q) : []),
    [lore.texts, q, terms],
  );
  const open = openId ? byId.get(openId) : undefined;

  if (open) {
    const at = lore.texts.findIndex((t) => t.id === open.id);
    return (
      <Reader
        key={open.id}
        text={open}
        prev={at > 0 ? (lore.texts[at - 1] ?? null) : null}
        next={at < lore.texts.length - 1 ? (lore.texts[at + 1] ?? null) : null}
        byId={byId}
        atlas={lore.atlas}
        terms={terms}
        onClose={onClose}
        onOpen={onOpen}
        onPlace={onPlace}
      />
    );
  }

  if (terms.length > 0) {
    return (
      <section className={styles.results} aria-label="Search results">
        {results.length === 0 ? (
          <p className={styles.empty}>
            No text has all of these words. Try fewer, or a name such as Selena or Terrinia.
          </p>
        ) : (
          <ol className={styles.resultList}>
            {results.map((r, i) => (
              <li
                key={r.text.id}
                className={styles.result}
                style={{ "--i": Math.min(i, 12) } as CSSProperties}
              >
                <a
                  href={`?view=texts&i=${r.text.id}`}
                  className={styles.resultHead}
                  onClick={(e) => {
                    if (!plainClick(e)) return;
                    e.preventDefault();
                    audio.blip("click");
                    onOpen(r.text.id);
                  }}
                >
                  <span className="hud-label">
                    {GROUP_TITLE[r.text.group]}
                    {r.text.rank === "older" ? " / Older text" : ""}
                  </span>
                  <span className={`${styles.resultTitle} display`}>
                    <Hl text={r.text.title} terms={terms} />
                  </span>
                  <span className="hud-label">
                    {r.hits} {r.hits === 1 ? "match" : "matches"}
                  </span>
                </a>
                <ul className={styles.snips}>
                  {r.snippets.map((s, j) => (
                    <li key={j}>
                      <a
                        href={`?view=texts&i=${r.text.id}#${s.headingId ?? ""}`}
                        onClick={(e) => {
                          if (!plainClick(e)) return;
                          e.preventDefault();
                          audio.blip("click");
                          onOpen(r.text.id, s.headingId ?? "");
                        }}
                      >
                        {s.heading ? <span className="hud-label">{s.heading}</span> : null}
                        <span>
                          <Hl text={s.text} terms={terms} />
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </section>
    );
  }

  const counts = GROUPS.map((g) => lore.texts.filter((t) => t.group === g.id).length);
  const starts = counts.map((_, i) => counts.slice(0, i).reduce((a, b) => a + b, 0));
  return (
    <div className={styles.library}>
      {GROUPS.map((g, gi) => {
        const texts = lore.texts.filter((t) => t.group === g.id);
        return (
          <section key={g.id} className={styles.group} aria-labelledby={`lore-group-${g.id}`}>
            <header className={styles.ghead}>
              <span className={styles.ghost} aria-hidden="true">
                {g.index}
              </span>
              <h2 id={`lore-group-${g.id}`} className={`${styles.gtitle} display`}>
                {g.title}
              </h2>
              <p className={styles.gline}>{g.line}</p>
              <p className={`${styles.gcount} hud-label`}>
                {texts.length} {texts.length === 1 ? "text" : "texts"}
              </p>
            </header>
            {g.note ? (
              <p className={styles.note} role="note">
                <span className={styles.noteMark} aria-hidden="true" />
                <span className="hud-label">{g.note}</span>
              </p>
            ) : null}
            <div className={styles.grid}>
              {texts.map((t, i) => {
                return (
                  <TextCard
                    key={t.id}
                    text={t}
                    index={(starts[gi] ?? 0) + i}
                    number={`${g.index}.${String(i + 1).padStart(2, "0")}`}
                    terms={terms}
                    onOpen={onOpen}
                  />
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
