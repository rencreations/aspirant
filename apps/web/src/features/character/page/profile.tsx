import type { CSSProperties } from "react";

import { StarGlyph } from "@/components/star-glyph";
import { HudPanel } from "@/components/ui/hud-panel";
import { Reveal } from "@/components/ui/reveal";
import type { Character } from "@/content/types";
import { asset } from "@/lib/asset";

import { SectionHead } from "./section-head";
import { mbtiAxes } from "./mbti";
import styles from "./profile.module.css";
import { Spoilers, type SpoilerFact } from "./spoilers";
import { traitsOf } from "./traits";

const pad = (n: number) => String(n).padStart(2, "0");

export interface ProfileProps {
  character: Character;
  focus: { x: number; y: number };
  later: readonly SpoilerFact[];
}

/** Personality, appearance, fighting style, motivation and flaws as HUD panels. */
export function Profile({ character: c, focus, later }: ProfileProps) {
  const traits = traitsOf(c.sections.personality);
  const axes = mbtiAxes(c.mbti);
  const lens = {
    "--focus-x": `${focus.x}%`,
    "--focus-y": `${focus.y}%`,
  } as CSSProperties;

  return (
    <section aria-labelledby="profile-title" className={`${styles.section} shell`}>
      <SectionHead id="profile-title" index="01" code="Personnel file" title="Profile">
        {c.summary}
      </SectionHead>

      <div className={styles.bento}>
        <Reveal className={styles.personality}>
          <HudPanel label="Personality" code={`${pad(traits.length)} traits`} as="article">
            <h3 className="sr-only">Personality</h3>
            <ul className={styles.traits}>
              {traits.map((t, i) => (
                <li key={t.source} className={styles.trait} data-size={i % 3}>
                  <span className={styles.chip}>{t.chip}</span>
                  {t.rest && <span className={styles.rest}>{t.rest}</span>}
                </li>
              ))}
            </ul>
          </HudPanel>
        </Reveal>

        <Reveal className={styles.mbti} delay={80}>
          <HudPanel label="Type" code={c.mbti} as="article">
            <h3 className="sr-only">MBTI type {c.mbti}</h3>
            <ul className={styles.axes}>
              {axes.map((a) => (
                <li key={a.left.letter} className={styles.axis} data-pick={a.pick}>
                  <span className={styles.pole} data-on={a.pick === "left"}>
                    <span className={styles.letter} aria-hidden="true">
                      {a.left.letter}
                    </span>
                    <span className={a.pick === "left" ? styles.word : "sr-only"}>
                      {a.left.word}
                    </span>
                  </span>
                  <span className={styles.track} aria-hidden="true">
                    <span className={styles.thumb} />
                  </span>
                  <span className={styles.pole} data-on={a.pick === "right"}>
                    <span className={a.pick === "right" ? styles.word : "sr-only"}>
                      {a.right.word}
                    </span>
                    <span className={styles.letter} aria-hidden="true">
                      {a.right.letter}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <p className={styles.axesNote}>The four letters of her type, spelled out.</p>
          </HudPanel>
        </Reveal>

        <Reveal className={styles.appearance} delay={40}>
          <HudPanel label="Appearance" code="Visual record" as="article">
            <h3 className="sr-only">Appearance</h3>
            <div className={styles.appearanceBody}>
              <div className={styles.portrait} style={lens} aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={asset(`/img/char/${c.slug}/splash.webp`)} alt="" loading="lazy" />
                <span className={styles.portraitRing} />
                <span className={styles.portraitTag}>Detail</span>
              </div>
              <ol className={styles.specs}>
                {c.sections.appearance.map((line, i) => (
                  <li key={line}>
                    <span className={styles.specCode} aria-hidden="true">
                      A.{pad(i + 1)}
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ol>
            </div>
          </HudPanel>
        </Reveal>

        <Reveal className={styles.fighting} delay={80}>
          <HudPanel label="Fighting style" code="Schematic" as="article">
            <h3 className="sr-only">Fighting style</h3>
            <div className={styles.fightBody}>
              <svg className={styles.schematic} viewBox="0 0 200 200" aria-hidden="true">
                <circle cx="100" cy="100" r="92" className={styles.ringOuter} />
                <circle cx="100" cy="100" r="64" className={styles.ringMid} />
                <circle cx="100" cy="100" r="34" className={styles.ringInner} />
                <path d="M100 0v200M0 100h200" className={styles.cross} />
                <g className={styles.sweep}>
                  <path d="M100 100L100 8A92 92 0 0 1 165 35Z" />
                </g>
                {c.sections.fighting.map((_, i) => {
                  const a = (i / c.sections.fighting.length) * Math.PI * 2 - Math.PI / 2;
                  const r = 64;
                  const x = 100 + Math.cos(a) * r;
                  const y = 100 + Math.sin(a) * r;
                  return (
                    <g key={i} className={styles.node}>
                      <line x1="100" y1="100" x2={x} y2={y} />
                      <circle cx={x} cy={y} r="9" />
                      <text x={x} y={y + 3.5} textAnchor="middle">
                        {pad(i + 1)}
                      </text>
                    </g>
                  );
                })}
                <g transform="translate(100 100)">
                  <path
                    d="M0 -14C1 -4 4 -1 14 0C4 1 1 4 0 14C-1 4 -4 1 -14 0C-4 -1 -1 -4 0 -14Z"
                    className={styles.core}
                  />
                </g>
              </svg>
              <div className={styles.fightText}>
                <p className={styles.weapon}>
                  <span className="hud-label">Role</span>
                  {c.role}
                </p>
                <ol className={styles.moves}>
                  {c.sections.fighting.map((line, i) => (
                    <li key={line}>
                      <span className={styles.moveCode} aria-hidden="true">
                        {pad(i + 1)}
                      </span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </HudPanel>
        </Reveal>

        <Reveal className={styles.motivation} delay={40}>
          <HudPanel label="Motivation" code="Directives" as="article">
            <h3 className="sr-only">Motivation</h3>
            <ol className={styles.directives}>
              {c.sections.motivation.map((line, i) => (
                <li key={line}>
                  <StarGlyph className={styles.directiveStar} />
                  <span className={styles.directiveCode} aria-hidden="true">
                    Dir {pad(i + 1)}
                  </span>
                  <span className={styles.directiveText}>{line}</span>
                </li>
              ))}
            </ol>
          </HudPanel>
        </Reveal>

        <Reveal className={styles.flaws} delay={80}>
          <HudPanel label="Flaws" code="Fault log" as="article" accent="var(--crimson)">
            <h3 className="sr-only">Flaws</h3>
            <ol className={styles.faults}>
              {c.sections.flaws.map((line, i) => (
                <li key={line}>
                  <span className={styles.faultCode} aria-hidden="true">
                    Warn {pad(i + 1)}
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ol>
          </HudPanel>
        </Reveal>
      </div>

      <Spoilers name={c.name} background={c.sections.background} later={later} />
    </section>
  );
}
