"use client";

import type { CSSProperties } from "react";

import { TLink } from "@/components/transition/t-link";
import { asset } from "@/lib/asset";

import { LABEL, NOTICE, PHASES } from "../content";
import { useArrive } from "../sections/arrive";

import { LOGO } from "./assets";
import styles from "./mlabel.module.css";

/** A delay step for a part of a group, read by the stylesheet. */
const step = (i: number) => ({ "--i": i }) as CSSProperties;

const part = (id: (typeof LABEL.parts)[number]["id"]) => LABEL.parts.find((p) => p.id === id);
const HALL = part("hall");
const PERKS = part("perks");
const STORY = part("story");

/** The ten Aspirants, in the order of the phases. */
const SKINS = PHASES.flatMap((phase) =>
  phase.skins.map((skin) => ({ ...skin, phase: phase.numeral })),
);
/** The three things the skin story gathers, from the official line. */
const GATHERED = ["Lore", "Cinematic trailers", "Character designs"] as const;
/** The words of the official definition; the two that name the thing are in the logo's orange. */
const WORDS = LABEL.definition.split(" ");
const HOT = new Set(["gallery", "signature"]);

const FIRST = SKINS[0];

/**
 * What TheMLabel is, after its logo has been spelled out: the official definition, the hall each
 * series gets, the four perks, the skin story, and the end of the page. Only the official words
 * are said (`LABEL` in the page's facts). It is dark, with the logo's orange as the one accent,
 * and every part arrives in the manner of the scene above it: plates that swing up from the
 * floor, light that crosses them, pieces that come together.
 */
export function LabelContent() {
  const ref = useArrive<HTMLDivElement>("0px 0px -16% 0px");

  return (
    <div ref={ref} className={styles.content} data-theme="storm">
      <section className={styles.screen} data-in="false" data-label-part="what">
        <div className={styles.inner}>
          <p className={`hud-label ${styles.eyebrow}`}>
            <b>{LABEL.name}</b>
            <span>Launched {LABEL.launched}</span>
          </p>
          <h2 className={`display ${styles.what}`}>
            {WORDS.map((word, i) => (
              <span key={i} className={styles.word} style={step(i)} data-hot={HOT.has(word)}>
                {word}
              </span>
            ))}
          </h2>
          <p className={`serif ${styles.lead}`}>
            A hall for every series, four perks for its skins, and the story behind them.
          </p>
        </div>
      </section>

      <section className={styles.screen} data-label-part="hall">
        <div className={styles.inner}>
          <div className={styles.head} data-in="false">
            <p className={`hud-label ${styles.eyebrow}`}>
              <b>01</b>
              <span>The gallery</span>
            </p>
            <h3 className={`display ${styles.title}`}>
              <span>{HALL?.title}</span>
            </h3>
            <p className={`serif ${styles.line}`}>{HALL?.line}</p>
          </div>
          <ul className={styles.hall} data-in="false" data-in-at="22">
            {SKINS.map((skin, i) => (
              <li key={skin.slug} className={styles.tall} style={step(i)}>
                <div className={styles.tallIn} style={step(i)}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- official splash art, cropped by the plate */}
                  <img
                    src={asset(skin.picture)}
                    alt={`${skin.name}, ${skin.title}`}
                    width={2048}
                    height={1152}
                    loading="lazy"
                    decoding="async"
                    style={{ objectPosition: `${skin.focus[0]}% ${skin.focus[1]}%` }}
                  />
                </div>
                <span className={`hud-label ${styles.tallName}`}>
                  {skin.phase} {skin.name}
                </span>
              </li>
            ))}
          </ul>
          <span className={`${styles.rule} ${styles.floor}`} data-in="false" />
        </div>
      </section>

      <section className={styles.screen} data-label-part="perks">
        <div className={styles.inner}>
          <div className={styles.head} data-in="false">
            <p className={`hud-label ${styles.eyebrow}`}>
              <b>02</b>
              <span>For the skins of a series</span>
            </p>
            <h3 className={`display ${styles.title}`}>
              <span>{PERKS?.title}</span>
            </h3>
          </div>
          <ul className={styles.perks} data-in="false" data-in-at="20">
            <li className={styles.perk} style={step(0)}>
              <span className={`hud-label ${styles.perkNo}`}>A</span>
              <div className={styles.act} aria-hidden="true">
                <span className={`display ${styles.gold}`}>
                  <span>{FIRST?.title}</span>
                  <span>{FIRST?.title}</span>
                </span>
              </div>
              <h4 className={`display ${styles.perkName}`}>{LABEL.perks[0]}</h4>
            </li>
            <li className={styles.perk} style={step(1)}>
              <span className={`hud-label ${styles.perkNo}`}>B</span>
              <div className={styles.act} aria-hidden="true">
                <span className={`hud-label ${styles.tag}`}>The Aspirants</span>
              </div>
              <h4 className={`display ${styles.perkName}`}>{LABEL.perks[1]}</h4>
            </li>
            <li className={styles.perk} style={step(2)}>
              <span className={`hud-label ${styles.perkNo}`}>C</span>
              <div className={styles.act} aria-hidden="true">
                <span className={styles.crest}>
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
              </div>
              <h4 className={`display ${styles.perkName}`}>{LABEL.perks[2]}</h4>
            </li>
            <li className={styles.perk} style={step(3)}>
              <span className={`hud-label ${styles.perkNo}`}>D</span>
              <div className={styles.act} aria-hidden="true">
                <span className={styles.show}>
                  {FIRST ? (
                    // eslint-disable-next-line @next/next/no-img-element -- official splash art on its stand
                    <img
                      src={asset(FIRST.picture)}
                      alt=""
                      width={2048}
                      height={1152}
                      loading="lazy"
                      decoding="async"
                      style={{ objectPosition: `${FIRST.focus[0]}% ${FIRST.focus[1]}%` }}
                    />
                  ) : null}
                </span>
              </div>
              <h4 className={`display ${styles.perkName}`}>{LABEL.perks[3]}</h4>
            </li>
          </ul>
        </div>
      </section>

      <section className={styles.screen} data-label-part="story">
        <div className={styles.inner}>
          <div className={styles.head} data-in="false">
            <p className={`hud-label ${styles.eyebrow}`}>
              <b>03</b>
              <span>All in one place</span>
            </p>
            <h3 className={`display ${styles.title}`}>
              <span>{STORY?.title}</span>
            </h3>
            <p className={`serif ${styles.line}`}>{STORY?.line}</p>
          </div>
          <ul className={styles.story} data-in="false" data-in-at="18">
            {GATHERED.map((name, i) => (
              <li key={name} className={styles.row} style={step(i)}>
                <span className={`hud-label ${styles.rowNo}`}>0{i + 1}</span>
                <span className={`display ${styles.rowName}`} style={step(i)}>
                  <span>{name}</span>
                </span>
                <span className={styles.rowMark} aria-hidden="true" />
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.screen} data-label-part="end">
        <div className={`${styles.inner} ${styles.end}`} data-in="false">
          {/* eslint-disable-next-line @next/next/no-img-element -- the label's own mark */}
          <img
            className={styles.endLogo}
            src={asset(LOGO.src)}
            alt={LABEL.name}
            width={LOGO.width}
            height={LOGO.height}
            loading="lazy"
            decoding="async"
          />
          <p className={`serif ${styles.first}`}>{LABEL.first}</p>
          <div className={styles.ways}>
            <TLink href="/story" className={`hud-label ${styles.pill}`}>
              Read the story
            </TLink>
            <TLink href="/collection" className={`hud-label ${styles.pill}`}>
              Open the collection
            </TLink>
          </div>
          <p className={`hud-label ${styles.notice}`}>{NOTICE}</p>
        </div>
      </section>
    </div>
  );
}
