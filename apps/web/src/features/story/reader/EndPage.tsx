/**
 * The page after the last chapter: who is who (the book's own list of the ten, with their art),
 * the other people it names, and the timeline of the world. It then leads on to the characters.
 */
import type { CSSProperties, ReactNode } from "react";

import { TLink } from "@/components/transition/t-link";
import { characters } from "@/content/characters";
import type { EndFile, Seg } from "@/content/story-types";
import { asset } from "@/lib/asset";
import { routes } from "@/lib/site";

import { chapterHref } from "../chapter-href";
import { END_KICKER, END_LEAD, END_TITLE } from "./end-copy";
import { portraitFor } from "./portraits";
import s from "./reader.module.css";
import { ReaderRoot } from "./ReaderRoot";

function Inline({ segs }: { segs: readonly Seg[] }): ReactNode {
  return segs.map((seg, i) => (seg.em ? <em key={i}>{seg.t}</em> : <span key={i}>{seg.t}</span>));
}

export function EndPage({ end }: { end: EndFile }) {
  return (
    <ReaderRoot chapterId="c48" score={null}>
      <article className={s.chapter} data-chapter="c48" aria-labelledby="the-end-title">
        <header className={s.finish}>
          <p className={s.finishKicker}>{END_KICKER}</p>
          <h1 id="the-end-title" className={s.finishTitle} tabIndex={-1}>
            {END_TITLE}
          </h1>
          <p className={s.finishLead}>{END_LEAD}</p>
        </header>
        <ul className={s.castList}>
          {end.cast.map((c) => {
            const person = characters.find((p) => p.slug === c.slug);
            const face = portraitFor(c.slug);
            return (
              <li
                key={c.slug}
                className={s.castItem}
                style={{ "--accent": person?.palette.primary ?? "var(--cyan)" } as CSSProperties}
              >
                <div className={s.castArt}>
                  {face && (
                    <>
                      {/* Plain <img>: static export. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={asset(face.src)}
                        alt={`${c.name}, official art`}
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                        style={{ objectPosition: face.position }}
                      />
                    </>
                  )}
                </div>
                <p className={s.castText}>
                  <span className={s.castName}>{c.name}</span>
                  <span className="hud-label">{c.aka}</span>
                  <br />
                  <Inline segs={c.text} />
                </p>
              </li>
            );
          })}
        </ul>
        {end.also.map((segs, i) => (
          <p key={i} className={s.p} style={{ marginTop: "2rem" }}>
            <Inline segs={segs} />
          </p>
        ))}
        <h2 className={s.sectionHead}>Timeline</h2>
        <ol className={s.timeline}>
          {end.timeline.map((row, i) => (
            <li key={i} className={s.timelineItem}>
              {row.when && <strong>{row.when}: </strong>}
              <Inline segs={row.text} />
            </li>
          ))}
        </ol>
        <nav className={s.end} aria-label="Next">
          <TLink
            href={routes.characters}
            transitionLabel="Characters"
            className={s.endNext}
            style={{ "--tint": "#10131b" } as CSSProperties}
            data-cursor="NEXT"
          >
            {/* Plain <img>: static export. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className={s.endPicture}
              src={asset("/img/char/selena/splash-sm.webp")}
              alt=""
              width={800}
              height={450}
              loading="lazy"
              decoding="async"
              draggable={false}
            />
            <span className={s.endShade} aria-hidden="true" />
            <span className={s.endText}>
              <span className={s.endKicker}>Next</span>
              <span className={s.endLabel}>The Aspirants</span>
              <span className={s.endTitle}>Meet the ten, one page each</span>
            </span>
          </TLink>
          <div className={s.endRow}>
            <TLink href={chapterHref("c48")} transitionLabel="Chapter 48" className={s.endLink}>
              Back to the last chapter
            </TLink>
            <TLink href={chapterHref("c00")} transitionLabel="Prologue" className={s.endLink}>
              Read again from the start
            </TLink>
          </div>
        </nav>
      </article>
    </ReaderRoot>
  );
}
