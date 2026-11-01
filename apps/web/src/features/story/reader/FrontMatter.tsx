/**
 * "Before you begin": the three things to know before Part One, set as plain text at the top of
 * the first page. Server rendered.
 */
import type { FrontSection } from "@/content/story-types";
import { asset } from "@/lib/asset";

import { Segments } from "./blocks";
import { portraitFor } from "./portraits";
import s from "./reader.module.css";

function People({
  rows,
}: {
  rows: Extract<FrontSection["blocks"][number], { type: "people" }>["rows"];
}) {
  return (
    <ul className={s.people}>
      {rows.map((row) => {
        const portrait = portraitFor(row.entityId);
        return (
          <li key={row.name} className={s.person}>
            {portrait && (
              <span className={s.personArt} aria-hidden="true">
                {/* Decorative crop: the name sits right next to it. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={asset(portrait.src)}
                  alt=""
                  width={800}
                  height={450}
                  loading="lazy"
                  decoding="async"
                  style={{ objectPosition: portrait.position }}
                />
              </span>
            )}
            <span className={s.personText}>
              <span className={s.personName}>
                {row.entityId ? (
                  <Segments segments={[{ t: "ent", id: row.entityId, text: row.name }]} />
                ) : (
                  row.name
                )}
              </span>
              <span className={s.personLine}>{row.text}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function FrontMatter({ front }: { front: readonly FrontSection[] }) {
  return (
    <section className={s.front} aria-labelledby="before-title">
      <div className={s.column}>
        <p className={s.frontKicker}>Before you begin</p>
        <h2 id="before-title" className={s.frontTitle}>
          Three things to know first
        </h2>
        {front.map((section) => (
          <section key={section.id} className={s.frontItem} aria-labelledby={`front-${section.id}`}>
            <h3 id={`front-${section.id}`} className={s.frontItemTitle}>
              {section.title}
            </h3>
            {section.blocks.map((block, j) =>
              block.type === "people" ? (
                <People key={j} rows={block.rows} />
              ) : (
                <p key={j} className={s.frontText}>
                  <Segments segments={block.segments} />
                </p>
              ),
            )}
          </section>
        ))}
      </div>
    </section>
  );
}
