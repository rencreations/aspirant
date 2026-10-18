/**
 * The title sequence and the book's front matter ("Before you begin"), server rendered.
 * Letters of the title light one by one like windows at dusk; the full title stays in the
 * accessibility tree as one string.
 */
import type { CSSProperties } from "react";

import { cn } from "@aspirant/ui/lib/utils";

import { StarGlyph } from "@/components/star-glyph";
import type { FrontSection } from "@/content/story-types";
import { storyIndex } from "@/content/story";
import { asset } from "@/lib/asset";

import { Segments } from "./blocks";
import o from "./opening.module.css";
import { OpeningActions } from "./OpeningActions";
import { portraitFor } from "./portraits";

const fmt = new Intl.NumberFormat("en-GB");

function LitWord({ word, offset }: { word: string; offset: number }) {
  return (
    <span className={o.word}>
      {Array.from(word).map((letter, i) => (
        <span key={i} className={o.letter} style={{ "--i": offset + i } as CSSProperties}>
          {letter}
        </span>
      ))}
    </span>
  );
}

function People({
  rows,
}: {
  rows: Extract<FrontSection["blocks"][number], { type: "people" }>["rows"];
}) {
  return (
    <ul className={o.people}>
      {rows.map((row) => {
        const portrait = portraitFor(row.entityId);
        return (
          <li key={row.name} className={o.person}>
            <span className={o.personArt} aria-hidden="true">
              {portrait && (
                // Decorative crop: the name sits right next to it.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={asset(portrait.src)}
                  alt=""
                  width={800}
                  height={450}
                  loading="lazy"
                  decoding="async"
                  style={{ objectPosition: portrait.position }}
                />
              )}
            </span>
            <span className={o.personText}>
              <span className={o.personName}>
                {row.entityId ? (
                  <Segments segments={[{ t: "ent", id: row.entityId, text: row.name }]} />
                ) : (
                  row.name
                )}
              </span>
              <span className={o.personLine}>{row.text}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function Opening({ front }: { front: readonly FrontSection[] }) {
  const { stats } = storyIndex;
  const hours = Math.round(stats.words / 230 / 60);
  return (
    <div className={o.opening} data-unit="opening" data-mood="daybreak" data-theme="daybreak">
      <section className={o.hero} aria-labelledby="experience-title">
        <div className={o.glow} aria-hidden="true" />
        <p className={cn(o.kicker, "hud-label")}>
          <span>Selrick Academy archive</span>
          <span>Story file A5-01</span>
        </p>
        <h1 id="experience-title" className={o.title}>
          <span className="sr-only">The Aspirants: The Short Story</span>
          <span className={o.titleMain} aria-hidden="true">
            <LitWord word="The" offset={0} /> <LitWord word="Aspirants" offset={3} />
          </span>
          <span className={o.titleSub} aria-hidden="true">
            The Short Story
          </span>
        </h1>
        <p className={o.intro}>{storyIndex.intro}</p>
        <OpeningActions />
        <dl className={o.stats}>
          <div>
            <dt>Parts</dt>
            <dd>{stats.parts}</dd>
          </div>
          <div>
            <dt>Chapters</dt>
            <dd>{stats.chapters}</dd>
          </div>
          <div>
            <dt>Interludes</dt>
            <dd>{stats.interludes}</dd>
          </div>
          <div>
            <dt>Words</dt>
            <dd>{fmt.format(stats.words)}</dd>
          </div>
          <div>
            <dt>Reading time</dt>
            <dd>About {hours} hours</dd>
          </div>
        </dl>
        <p className={o.cue} aria-hidden="true">
          <span>Scroll to read</span>
          <StarGlyph className={o.cueStar} />
        </p>
      </section>

      <section className={o.front} aria-labelledby="before-title">
        <div className={o.frontHead}>
          <p className="hud-label">Before you begin</p>
          <h2 id="before-title" className={o.frontTitle}>
            Three things to know first
          </h2>
        </div>
        <div className={o.frontGrid}>
          {front.map((section, i) => (
            <section
              key={section.id}
              className={cn(o.panel, section.id === "who-you-will-meet-first" && o.panelWide)}
              aria-labelledby={`front-${section.id}`}
            >
              <p className={cn(o.panelCode, "hud-label")} aria-hidden="true">
                0{i + 1}
              </p>
              <h3 id={`front-${section.id}`} className={o.panelTitle}>
                {section.title}
              </h3>
              {section.blocks.map((block, j) =>
                block.type === "people" ? (
                  <People key={j} rows={block.rows} />
                ) : (
                  <p key={j} className={o.panelText}>
                    <Segments segments={block.segments} />
                  </p>
                ),
              )}
            </section>
          ))}
        </div>
        <a className={o.begin} href="#part-01">
          <span className="hud-label">The story begins</span>
          <span className={o.beginTitle}>Part One</span>
          <StarGlyph className={o.beginStar} />
        </a>
      </section>
    </div>
  );
}
