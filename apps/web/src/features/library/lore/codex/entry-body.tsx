"use client";

import { Fragment, useMemo } from "react";

import { TLink } from "@/components/transition/t-link";
import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import { libUrl } from "@/lib/library";
import { characterRoute } from "@/lib/site";

import { actOfChapter, chapterChip, chapterLink, chapterName, chapterTitle } from "./chapters";
import styles from "./entry-body.module.css";
import { hiddenFactCount, neighbours, pairSlug, REL_META, relLabel, visibleFacts } from "./model";
import { RelationGraph } from "./relation-graph";
import type { Reach } from "./reach";
import type { Codex } from "./use-codex";
import { KIND_META, type CodexEntry, type CodexFact, type CodexMedia } from "./types";

export interface BodyProps {
  codex: Codex;
  reach: Reach;
  onOpen: (slug: string) => void;
}

const mediaSrc = (m: CodexMedia) =>
  m.src.startsWith("lib:") ? libUrl(m.src.slice(4)) : asset(m.src);

/** The facts, grouped under the act each belongs to. */
function groupByAct(facts: readonly CodexFact[]) {
  const groups: Array<{ key: string; title: string; facts: CodexFact[] }> = [];
  for (const f of facts) {
    const act = actOfChapter(f.n);
    const key = act?.roman ?? "?";
    const last = groups[groups.length - 1];
    if (last?.key === key) {
      last.facts.push(f);
    } else {
      groups.push({ key, title: act ? `Act ${act.roman}: ${act.title}` : "The story", facts: [f] });
    }
  }
  return groups;
}

/** A button that looks like a link inside the codex (it opens another window, not a page). */
export function LoreLink({
  slug,
  onOpen,
  children,
  className,
}: {
  slug: string;
  onOpen: (slug: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a
      href={`/collection/lore/${slug}/`}
      className={className ?? styles.link}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        audio.blip("click");
        onOpen(slug);
      }}
    >
      {children}
    </a>
  );
}

/** The gate shown instead of an entry the reader has not met: what it is, and a way past. */
export function Unmet({ entry, reach }: { entry: CodexEntry; reach: Reach }) {
  return (
    <div className={styles.gate}>
      <p className={styles.gateLine}>
        {KIND_META[entry.kind].label} first met in <b>{chapterName(entry.first)}</b>
        {chapterTitle(entry.first) ? `, ${chapterTitle(entry.first)}` : ""}.
      </p>
      <p className={styles.gateNote}>
        {reach.furthest < 0
          ? "You have not started the story, and the spoiler shield is on."
          : `You have read up to ${chapterName(reach.furthest)}. Nothing past it is shown while the shield is on.`}
      </p>
      <button
        type="button"
        className={styles.gateButton}
        onClick={() => {
          reach.setShield(false);
        }}
      >
        Show it anyway
      </button>
    </div>
  );
}

/** The whole page of an entry, under its title. */
export function EntryBody({ entry, codex, reach, onOpen }: BodyProps & { entry: CodexEntry }) {
  const reachN = reach.reach;
  const facts = visibleFacts(entry, reachN);
  const hidden = hiddenFactCount(entry, reachN);
  const groups = useMemo(() => groupByAct(facts), [facts]);
  const ties = useMemo(
    () => neighbours(entry, reachN, codex.weight),
    [entry, reachN, codex.weight],
  );
  const chapters = entry.seen.filter((n) => n <= reachN);
  const weapons = entry.weapons.filter((w) => w.n <= reachN);
  const rows = entry.rows.filter((r) => r[2] <= reachN);
  const lead = hidden > 0 ? entry.short : entry.summary;
  const media = entry.media.slice(0, 3);
  const nameOf = (slug: string) => codex.entry.get(slug)?.name ?? slug;
  const kindOf = (slug: string) => codex.entry.get(slug)?.kind ?? "thing";

  const openPair = (a: string, b: string) => {
    audio.blip("click");
    onOpen(pairSlug(a, b));
  };

  return (
    <div className={styles.body}>
      <p className={styles.lead}>{lead}</p>

      {entry.character ? (
        <p className={styles.cta}>
          <TLink
            href={characterRoute(entry.character as Parameters<typeof characterRoute>[0])}
            transitionLabel={entry.name}
            className={styles.ctaLink}
          >
            Open {entry.name}&rsquo;s own page
          </TLink>
        </p>
      ) : null}

      {media.length > 0 || rows.length > 0 ? (
        <div className={styles.cols}>
          {media.length > 0 ? (
            <div className={styles.figures}>
              {media.map((m) => (
                <figure key={m.src} className={styles.figure}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mediaSrc(m)} alt={m.alt} loading="lazy" decoding="async" />
                  <figcaption className="hud-label">{m.credit}</figcaption>
                </figure>
              ))}
            </div>
          ) : null}
          {rows.length > 0 ? (
            <dl className={styles.rows}>
              {rows.map(([k, v]) => (
                <Fragment key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </Fragment>
              ))}
            </dl>
          ) : null}
        </div>
      ) : null}

      {entry.official && entry.official.length > 0 ? (
        <section aria-labelledby="codex-official" className={styles.section}>
          <h3 id="codex-official" className={styles.h}>
            Official text
          </h3>
          {entry.official.map((o) => (
            <figure key={o.text.slice(0, 40)} className={styles.quote}>
              <blockquote>{o.text}</blockquote>
              <figcaption className="hud-label">From {o.source}</figcaption>
            </figure>
          ))}
        </section>
      ) : null}

      {weapons.length > 0 ? (
        <section aria-labelledby="codex-gear" className={styles.section}>
          <h3 id="codex-gear" className={styles.h}>
            {entry.kind === "person" ? "Weapons and gear" : "Parts and tools"}
          </h3>
          <ul className={styles.gear}>
            {weapons.map((w) => (
              <li key={w.name}>
                <b>{w.name}</b>
                <span>{w.note}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="codex-story" className={styles.section}>
        <h3 id="codex-story" className={styles.h}>
          What the story says
        </h3>
        {groups.map((g) => (
          <div key={g.key} className={styles.act}>
            <h4 className={styles.actTitle}>{g.title}</h4>
            <ul className={styles.facts}>
              {g.facts.map((f, i) => (
                <li key={`${String(f.n)}-${String(f.p)}-${String(i)}`}>
                  <TLink
                    href={chapterLink(f.n, f.p)}
                    transitionLabel={chapterName(f.n)}
                    className={styles.chip}
                    aria-label={`${f.t} Read it in ${chapterName(f.n)}.`}
                  >
                    {chapterChip(f.n)}
                  </TLink>
                  <span>{f.t}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {hidden > 0 ? (
          <p className={styles.shut}>
            {hidden} more {hidden === 1 ? "line comes" : "lines come"} from chapters you have not
            reached.{" "}
            <button
              type="button"
              className={styles.shutButton}
              onClick={() => {
                reach.setShield(false);
              }}
            >
              Show everything
            </button>
          </p>
        ) : null}
      </section>

      {ties.length > 0 ? (
        <section aria-labelledby="codex-rel" className={styles.section}>
          <h3 id="codex-rel" className={styles.h}>
            Relationships
          </h3>
          <RelationGraph
            hub={entry}
            neighbours={ties}
            nameOf={nameOf}
            kindOf={kindOf}
            onOpenEntry={onOpen}
            onOpenPair={openPair}
          />
          <ul className={styles.relList}>
            {ties.map((n) => {
              const first = n.ties[0];
              return (
                <li key={n.slug} className={styles.rel}>
                  <div className={styles.relHead}>
                    <LoreLink slug={n.slug} onOpen={onOpen} className={styles.relName}>
                      {nameOf(n.slug)}
                    </LoreLink>
                    <span className={styles.relTags}>
                      {[...new Set(n.ties.map((t) => relLabel(t.type, t.dir)))].map((l) => (
                        <span
                          key={l}
                          className={styles.relTag}
                          data-family={
                            REL_META[
                              n.ties.find((t) => relLabel(t.type, t.dir) === l)?.type ?? "friend"
                            ].family
                          }
                        >
                          {l}
                        </span>
                      ))}
                    </span>
                  </div>
                  {first ? <p className={styles.relNote}>{first.t}</p> : null}
                  <LoreLink
                    slug={pairSlug(entry.slug, n.slug)}
                    onOpen={onOpen}
                    className={styles.relMore}
                  >
                    How {entry.name} and {nameOf(n.slug)} are tied
                  </LoreLink>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {chapters.length > 0 ? (
        <section aria-labelledby="codex-where" className={styles.section}>
          <h3 id="codex-where" className={styles.h}>
            Where it appears
          </h3>
          <ul className={styles.chapters}>
            {chapters.map((n) => (
              <li key={n}>
                <TLink
                  href={chapterLink(n)}
                  transitionLabel={chapterName(n)}
                  className={styles.chip}
                  title={chapterTitle(n)}
                >
                  {chapterChip(n)}
                </TLink>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
