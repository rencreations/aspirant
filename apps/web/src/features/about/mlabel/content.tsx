"use client";

import { Fragment, type CSSProperties, type ReactNode } from "react";

import { TLink } from "@/components/transition/t-link";
import { asset } from "@/lib/asset";

import { LABEL } from "../content";
import { useArrive } from "../sections/arrive";

import { LOGO } from "./assets";
import styles from "./mlabel.module.css";
import { useScrub } from "./use-scrub";

/** A delay step for a part of a group, read by the stylesheet. */
const step = (i: number) => ({ "--i": i }) as CSSProperties;
/** The length of a part that is held on the screen, in screens. */
const held = (screens: number) => ({ "--len": screens }) as CSSProperties;

/** The words of the official definition; the two that name the thing are in the logo's orange. */
const WORDS = LABEL.definition.split(" ");
const HOT = new Set(["gallery", "signature"]);

const [COLLECT, HALL, STORY] = LABEL.parts;
const TICKS = Array.from({ length: 10 }, (_, i) => i);
/** The odometer's strips: the ones roll 0 to 9 and on to the 0 of ten, the tens 0 to 1. */
const ONES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0] as const;
const TENS = [0, 1] as const;
const CORNERS = ["tl", "tr", "br", "bl"] as const;
const pad = (n: number) => String(n).padStart(2, "0");

/** A line in its mask: the mask stands still and the line moves (`k` names the move). */
function Line({
  children,
  k = "line",
  className,
}: {
  children: ReactNode;
  k?: string;
  className?: string;
}) {
  return (
    <span className={styles.mask}>
      <span className={className ? `${styles.line} ${className}` : styles.line} data-k={k}>
        {children}
      </span>
    </span>
  );
}

/** The head of a part: its number and name, and a hairline that draws across after them. */
function Kicker({
  no,
  children,
  rule = true,
}: {
  no: number;
  children: ReactNode;
  rule?: boolean;
}) {
  return (
    <p className={`hud-label ${styles.kicker}`}>
      <span className={styles.mask}>
        <b className={styles.line} data-k="kick">
          {pad(no)}
        </b>
      </span>
      <span className={styles.mask}>
        <span className={styles.line} data-k="kick">
          {children}
        </span>
      </span>
      {rule ? (
        <span className={styles.kickRule} aria-hidden="true">
          <i data-k="kick-rule" />
        </span>
      ) : null}
    </p>
  );
}

/**
 * What TheMLabel is, after its logo has been spelled out: the official definition, then the
 * owner's own account of it (the system, a whole set and its four rewards, the hall of honor, the
 * story of every series), and the end of the page. It is dark, with the logo's orange as the one
 * accent, and it is type only: no pictures. The definition and the end arrive once, as before;
 * every part between them is drawn by the scroll (`use-scrub.ts`, the moves in `scenes.ts`), so
 * nothing in it pops in or vanishes, however fast the visitor scrolls, and a scroll back up plays
 * it back.
 */
export function LabelContent() {
  const ref = useArrive<HTMLDivElement>("0px 0px -16% 0px");
  useScrub(ref);

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

      {/* 01. The system: held on the screen while it is told. */}
      <section
        className={styles.held}
        style={held(2.2)}
        data-label-part="system"
        data-scene="system"
      >
        <div className={styles.pin}>
          <div className={`${styles.inner} ${styles.system}`}>
            <Kicker no={1}>{LABEL.system.kicker}</Kicker>
            <h3 className={`display ${styles.big}`}>
              {LABEL.system.title.map((line) => (
                <Line key={line}>{line} </Line>
              ))}
            </h3>
            <p className={`serif ${styles.built}`}>
              <Line>{LABEL.system.line}</Line>
            </p>
            <div className={styles.carries}>
              <span className={styles.rule} aria-hidden="true">
                <i data-k="rule" />
              </span>
              <p className={`serif ${styles.carry}`}>
                <Line k="carry">{LABEL.system.carries}</Line>
              </p>
              <ol className={styles.own}>
                {LABEL.system.own.map((name, i) => (
                  <li key={name}>
                    <span className={`hud-label ${styles.ownNo}`}>
                      <Line k="own-no">{pad(i + 1)}</Line>
                    </span>
                    <span className={`display ${styles.ownName}`}>
                      <Line k="own">{name}</Line>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* 02. Collect: the scroll counts a series up to ten. */}
      <section
        className={styles.held}
        style={held(2.8)}
        data-label-part="collect"
        data-scene="collect"
      >
        <div className={styles.pin}>
          <div className={`${styles.inner} ${styles.collect}`}>
            <Kicker no={2}>{COLLECT.kicker}</Kicker>
            <div className={styles.collectText}>
              <h3 className={`display ${styles.big}`}>
                {COLLECT.title.map((line) => (
                  <Line key={line}>{line} </Line>
                ))}
              </h3>
              <p className={`serif ${styles.unlock}`}>
                <span className={styles.wipe} data-k="wipe">
                  <span className={styles.wipeIn} data-k="wipe-in">
                    {COLLECT.line}
                  </span>
                </span>
              </p>
            </div>
            <div className={styles.meter} aria-hidden="true">
              <p className={`hud-label ${styles.meterLabel}`}>
                <Line k="meter-label">Skins collected</Line>
              </p>
              <span className={styles.mask}>
                <span className={`display ${styles.count}`} data-k="count">
                  <span className={styles.odo}>
                    <span className={styles.strip} data-k="tens">
                      {TENS.map((d, i) => (
                        <span key={i}>{d}</span>
                      ))}
                    </span>
                  </span>
                  <span className={styles.odo}>
                    <span className={styles.strip} data-k="ones">
                      {ONES.map((d, i) => (
                        <span key={i}>{d}</span>
                      ))}
                    </span>
                  </span>
                  <span className={styles.of}>/10</span>
                </span>
              </span>
              <ol className={styles.ticks}>
                {TICKS.map((i) => (
                  <li key={i}>
                    <i data-k="tick" />
                  </li>
                ))}
              </ol>
              <p className={`hud-label ${styles.done}`}>
                <Line k="done">Series complete</Line>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 03. The rewards: a list that scrolls, one row at a time. */}
      <section className={styles.flow} data-label-part="rewards">
        <div className={styles.inner}>
          <header className={styles.rewardsHead} data-scene="rewards-head">
            <Kicker no={3}>{LABEL.rewards.kicker}</Kicker>
            <h3 className={`serif ${styles.say}`}>
              <Line>{LABEL.rewards.line}</Line>
            </h3>
          </header>
          <ol className={styles.rewards}>
            {LABEL.perks.map((perk, i) => (
              <li key={perk.name} className={styles.reward} data-scene="reward">
                <span className={styles.rule} aria-hidden="true">
                  <i data-k="rule" />
                </span>
                <span className={`hud-label ${styles.rewardNo}`}>
                  <Line k="no">{pad(i + 1)}</Line>
                </span>
                <h4 className={`display ${styles.rewardName}`}>
                  <Line k="name">{perk.name}</Line>
                </h4>
                <p className={`serif ${styles.rewardLine}`}>
                  <Line k="say">{perk.line}</Line>
                </p>
              </li>
            ))}
          </ol>
          <div className={styles.rewardsFoot} data-scene="rule" aria-hidden="true">
            <span className={styles.rule}>
              <i data-k="rule" />
            </span>
          </div>
        </div>
      </section>

      {/* 04. The hall of honor: held on the screen, in a frame that comes in from the corners. */}
      <section className={styles.held} style={held(2.3)} data-label-part="hall" data-scene="hall">
        <div className={styles.pin}>
          <div className={styles.frame} aria-hidden="true">
            {CORNERS.map((corner) => (
              <i key={corner} className={styles.corner} data-corner={corner} data-k="corner" />
            ))}
          </div>
          <div className={`${styles.inner} ${styles.hall}`}>
            <Kicker no={4} rule={false}>
              {HALL.kicker}
            </Kicker>
            <h3 className={`display ${styles.hallTitle}`}>
              {HALL.title.map((word) => (
                <Fragment key={word}>
                  <span className={styles.hallWord} data-k="word">
                    {word}
                  </span>{" "}
                </Fragment>
              ))}
              <span className={`serif ${styles.hallOwn}`}>
                <Line k="own">{HALL.line}</Line>
              </span>
            </h3>
            <div className={styles.hallSay}>
              {HALL.more.map((line) => (
                <p key={line} className="serif">
                  <Line k="say">{line}</Line>
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 05. The skin story: the heading is held beside a list under a spotlight. */}
      <section className={styles.flow} data-label-part="story">
        <div className={`${styles.inner} ${styles.story}`}>
          <div className={styles.storyAside}>
            <div data-scene="story-head">
              <Kicker no={5}>{STORY.kicker}</Kicker>
              <h3 className={`display ${styles.storyTitle}`}>
                {STORY.title.map((line) => (
                  <Line key={line}>{line} </Line>
                ))}
              </h3>
              <p className={`serif ${styles.say}`}>
                <Line k="say">{STORY.line}</Line>
              </p>
            </div>
          </div>
          <ol className={styles.spots}>
            {STORY.more.map((name, i) => (
              <li key={name} className={styles.spot} data-scene="spot">
                <span className={`hud-label ${styles.spotNo}`} data-k="spot-no">
                  {pad(i + 1)}
                </span>
                <span className={styles.spotBody}>
                  <i className={styles.spotMark} data-k="spot-mark" aria-hidden="true" />
                  <span
                    className={`${i === STORY.more.length - 1 ? "serif" : "display"} ${styles.spotName}`}
                    data-k="spot-name"
                  >
                    {name}
                  </span>
                </span>
              </li>
            ))}
          </ol>
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
        </div>
      </section>
    </div>
  );
}
