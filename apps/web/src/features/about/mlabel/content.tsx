"use client";

import { Fragment, type CSSProperties, type ReactNode } from "react";

import { TLink } from "@/components/transition/t-link";
import { asset } from "@/lib/asset";

import { LABEL } from "../content";
import { useArrive } from "../sections/arrive";

import { LOGO } from "./assets";
import styles from "./mlabel.module.css";
import { useScrub } from "./use-scrub";

/** The length of a part that is held on the screen, in screens. */
const held = (screens: number) => ({ "--len": screens }) as CSSProperties;

const [HALL, STORY] = LABEL.parts;
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

export function LabelContent() {
  const ref = useArrive<HTMLDivElement>("0px 0px -16% 0px");
  useScrub(ref);

  return (
    <div ref={ref} className={styles.content} data-theme="storm">
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
