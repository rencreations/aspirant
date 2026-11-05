"use client";

import { useMemo, type CSSProperties } from "react";

import { TLink } from "@/components/transition/t-link";
import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import { characterRoute } from "@/lib/site";
import { CHARACTER_NAMES } from "@/lib/slugs";

import { matchesAll } from "./search";
import { Hl } from "./text-body";
import styles from "./who-view.module.css";
import { GROUP_TITLE, type LoreFile, type LoreText, type Person } from "./types";

export interface WhoViewProps {
  lore: LoreFile;
  terms: readonly string[];
  who: string;
  onWho: (slug: string) => void;
  onOpenText: (id: string, heading?: string) => void;
}

const portrait = (slug: string) => asset(`/img/char/${slug}/splash-sm.webp`);

function relKind(rel: string): string {
  const r = rel.toLowerCase();
  if (r.includes("hostile")) return "hostile";
  if (r.includes("friend") || r.includes("sister")) return "close";
  if (r.includes("teacher") || r.includes("student") || r.includes("healer") || r.includes("maker"))
    return "bond";
  if (r.includes("distrust") || r.includes("dominator") || r === "???" || r.includes("reliance"))
    return "unsure";
  return "plain";
}

function headingId(text: LoreText | undefined, name: string): string | undefined {
  const h = text?.blocks.find((b) => b.t === "h" && b.x === name);
  return h?.t === "h" ? h.id : undefined;
}

/** The ten Aspirants: the card, the relation list as given, and who sees whom as a grid. */
export function WhoView({ lore, terms, who, onWho, onOpenText }: WhoViewProps) {
  const people = lore.people;
  const byId = useMemo(() => new Map(lore.texts.map((t) => [t.id, t] as const)), [lore.texts]);
  const roll = useMemo(() => {
    const rel = byId.get("lore-relationship");
    const first = rel?.blocks[0];
    return first?.t === "kv" ? first.rows : [];
  }, [byId]);
  const sideOf = (p: Person) =>
    roll
      .find(([, names]) => names.split(", ").includes(p.name))?.[0]
      ?.replace(/^The /, "")
      .replace(/s$/, "") ?? "";

  const current = people.find((p) => p.slug === who) ?? people[0];
  const matching = useMemo(
    () =>
      new Set(
        people
          .filter(
            (p) =>
              terms.length === 0 || matchesAll([p.name, p.aka, p.text, p.blurb].join(" "), terms),
          )
          .map((p) => p.slug),
      ),
    [people, terms],
  );
  const aboutHer = useMemo(() => {
    if (!current) return [];
    return lore.texts
      .filter(
        (t) =>
          t.chars.slice(0, 3).includes(current.slug) &&
          !["lore-characters", "lore-relationship"].includes(t.id),
      )
      .slice(0, 9);
  }, [lore.texts, current]);

  if (!current) return null;
  const side = sideOf(current);
  const idx = people.indexOf(current);

  return (
    <div className={styles.who}>
      <div className={styles.roster} role="group" aria-label="The ten Aspirants">
        {people.map((p, i) => (
          <button
            key={p.slug}
            type="button"
            className={styles.face}
            aria-pressed={p.slug === current.slug}
            data-dim={matching.has(p.slug) ? "0" : "1"}
            style={{ "--i": i } as CSSProperties}
            onClick={() => {
              audio.blip("click");
              onWho(p.slug);
            }}
          >
            <span className={styles.faceArt}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={portrait(p.slug)}
                alt=""
                width={800}
                height={450}
                loading="lazy"
                decoding="async"
              />
            </span>
            <span className={`${styles.faceName} display`}>{CHARACTER_NAMES[p.slug]}</span>
          </button>
        ))}
      </div>

      <article key={current.slug} className={styles.card}>
        <div className={styles.art}>
          <span className={styles.ghost} aria-hidden="true">
            {String(idx + 1).padStart(2, "0")}
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={portrait(current.slug)}
            alt={`${current.name}, official art.`}
            width={800}
            height={450}
            decoding="async"
          />
        </div>
        <div className={styles.info}>
          <p className="hud-label">{side || "Aspirant"}</p>
          <h2 className={`${styles.name} display`}>
            <Hl text={current.name} terms={terms} />
          </h2>
          {current.aka ? <p className={styles.aka}>{current.aka}</p> : null}

          <dl className={styles.fields}>
            {[...current.facts, ...current.fields].map(([k, v], i) => (
              <div key={i}>
                <dt className="hud-label">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>

          <p className={styles.profile}>
            <Hl text={current.text} terms={terms} />
          </p>
          <p className={styles.blurb}>
            <span className="hud-label">In the relationship list</span>
            <Hl text={current.blurb} terms={terms} />
          </p>

          <div className={styles.actions}>
            <TLink
              href={characterRoute(current.slug)}
              transitionLabel={CHARACTER_NAMES[current.slug]}
              className={styles.page}
            >
              <span>Open {CHARACTER_NAMES[current.slug]}&apos;s page</span>
              <span aria-hidden="true" className={styles.arrow} />
            </TLink>
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={() => {
                onOpenText("lore-characters", headingId(byId.get("lore-characters"), current.name));
              }}
            >
              Her card
            </button>
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={() => {
                onOpenText(
                  "lore-relationship",
                  headingId(byId.get("lore-relationship"), current.name),
                );
              }}
            >
              Her relations
            </button>
          </div>
        </div>
      </article>

      <section className={styles.rels} aria-labelledby="lore-rels">
        <h3 id="lore-rels" className={`${styles.relsTitle} display`}>
          {CHARACTER_NAMES[current.slug]}&apos;s relationships
        </h3>
        <ul className={styles.relList}>
          {current.rels.map((r, i) => {
            const slug = r.s || "";
            const known = people.some((p) => p.slug === slug);
            return (
              <li key={i} data-kind={relKind(r.r)} style={{ "--i": i } as CSSProperties}>
                {known ? (
                  <button
                    type="button"
                    className={styles.relName}
                    onClick={() => {
                      audio.blip("click");
                      onWho(slug);
                    }}
                  >
                    {r.w}
                  </button>
                ) : (
                  <span className={styles.relName}>{r.w}</span>
                )}
                <span className={styles.relKind}>{r.r}</span>
              </li>
            );
          })}
        </ul>
        {current.more.length > 0 ? (
          <div className={styles.more}>
            {current.more.map((m) => (
              <p key={m.name}>
                <strong>{m.name}.</strong> {m.text}
              </p>
            ))}
          </div>
        ) : null}
        {aboutHer.length > 0 ? (
          <div className={styles.texts}>
            <p className="hud-label">Texts that centre on {CHARACTER_NAMES[current.slug]}</p>
            <ul>
              {aboutHer.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenText(t.id);
                    }}
                  >
                    <span>{t.title}</span>
                    <span className="hud-label">{GROUP_TITLE[t.group]}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className={styles.matrixBox} aria-labelledby="lore-matrix">
        <h3 id="lore-matrix" className={`${styles.relsTitle} display`}>
          Who sees whom
        </h3>
        <p className={styles.matrixLead}>
          Read along a row: this is what the Aspirant on the left is to each name across the top, as
          the official list gives it. A blank cell means the list does not say.
          {roll.length > 0 ? <> {roll.map(([k, v]) => `${k}: ${v}.`).join(" ")}</> : null}
        </p>
        <div className={styles.matrixWrap}>
          <table className={styles.matrix}>
            <thead>
              <tr>
                <td />
                {people.map((c) => (
                  <th key={c.slug} scope="col" data-on={c.slug === current.slug ? "1" : "0"}>
                    <button
                      type="button"
                      onClick={() => {
                        onWho(c.slug);
                      }}
                    >
                      {CHARACTER_NAMES[c.slug]}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map((row) => (
                <tr key={row.slug} data-on={row.slug === current.slug ? "1" : "0"}>
                  <th scope="row">
                    <button
                      type="button"
                      onClick={() => {
                        onWho(row.slug);
                      }}
                    >
                      {CHARACTER_NAMES[row.slug]}
                    </button>
                  </th>
                  {people.map((col) => {
                    if (row.slug === col.slug)
                      return <td key={col.slug} className={styles.self} aria-label="Same person" />;
                    const rel = row.rels.find((r) => r.s === col.slug)?.r ?? "";
                    return (
                      <td
                        key={col.slug}
                        data-kind={rel ? relKind(rel) : "none"}
                        data-col={col.slug === current.slug ? "1" : "0"}
                      >
                        {rel}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
