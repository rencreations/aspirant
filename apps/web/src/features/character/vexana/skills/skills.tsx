"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useLenis } from "@/components/smooth-scroll";
import { asset } from "@/lib/asset";
import { useMediaQuery, useReducedMotion } from "@/lib/hooks";
import { clamp } from "@/lib/math";

import { SKILLS, skillAt } from "./skill-data";
import { SkillDemo } from "./skill-demo";
import { SkinShowcase } from "./skin-showcase";
import styles from "./skills.module.css";

const COUNT = SKILLS.length;
const STEP = 360 / COUNT;
/** The angle of node `i` on the dial, from the top, clockwise. */
const angleOf = (i: number) => -90 + i * STEP;
const pad = (n: number) => String(n).padStart(2, "0");

/** The turn that reaches `target` from `from` the short way round. */
function nearest(from: number, target: number) {
  const turns = Math.round((from - target) / 360);
  return target + turns * 360;
}

/**
 * The skills, set as a dial. The orb of her staff sits at the middle and a hand points at the
 * skill that is open. On a wide screen the page holds still while the hand steps round with the
 * scroll, one skill for each stretch of the way. Pressing a node goes straight to it. On a phone
 * the section is an ordinary block and the nodes are the controls. Below it, the skin showcase.
 */
export function Skills() {
  const reduced = useReducedMotion();
  const compact = useMediaQuery("(max-width: 900px)");
  const lenis = useLenis();
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const hand = useRef(angleOf(0));
  const [handAngle, setHandAngle] = useState(angleOf(0));
  const stepped = !compact && !reduced;

  // The hand turns by the short way round, so it never swings across the dial.
  useEffect(() => {
    hand.current = nearest(hand.current, angleOf(active));
    setHandAngle(hand.current);
  }, [active]);

  useEffect(() => {
    if (!stepped) return;
    const track = trackRef.current;
    if (!track) return;
    let raf = 0;
    const read = () => {
      raf = 0;
      const r = track.getBoundingClientRect();
      const range = r.height - window.innerHeight;
      if (range <= 0) return;
      const p = clamp(-r.top / range, 0, 0.9999);
      setActive(Math.min(COUNT - 1, Math.floor(p * COUNT)));
    };
    const onScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(read);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    read();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [stepped]);

  const choose = useCallback(
    (i: number) => {
      const track = trackRef.current;
      if (stepped && track) {
        const r = track.getBoundingClientRect();
        const range = r.height - window.innerHeight;
        const y = window.scrollY + r.top + (range * (i + 0.5)) / COUNT;
        lenis.scrollTo(y, { duration: 1.1 });
      } else {
        setActive(i);
      }
    },
    [lenis, stepped],
  );

  const skill = skillAt(active);

  return (
    <section id="skills" className={styles.skills} aria-labelledby="skills-title">
      <div className={styles.glow} aria-hidden="true" />
      <header className={styles.head}>
        <p className={styles.eyebrow}>
          <span className={styles.eyebrowNo}>03</span>
          <span className={styles.eyebrowBar} aria-hidden="true" />
          <span>Craft</span>
        </p>
        <h2 id="skills-title" className={styles.title}>
          Four notes
          <br />
          <em>and an echo</em>
        </h2>
        <p className={styles.lede}>
          Her staff holds a crescent and a black orb. Every skill begins there. Scroll to step
          through them, or press a node on the dial.
        </p>
      </header>

      <div ref={trackRef} className={styles.track} data-stepped={stepped}>
        <div className={styles.stick}>
          <div className={styles.stage} style={{ ["--sk" as string]: skill.tone }}>
            <div className={styles.dialWrap}>
              <div className={styles.dial}>
                <svg className={styles.dialArt} viewBox="0 0 560 560" aria-hidden="true">
                  <circle className={styles.ringOuter} cx="280" cy="280" r="214" />
                  <circle className={styles.ringMid} cx="280" cy="280" r="150" />
                  <circle className={styles.ringIn} cx="280" cy="280" r="92" />
                  {SKILLS.map((_, i) => {
                    const a = (angleOf(i) * Math.PI) / 180;
                    return (
                      <line
                        key={i}
                        className={styles.spoke}
                        x1={280 + Math.cos(a) * 92}
                        y1={280 + Math.sin(a) * 92}
                        x2={280 + Math.cos(a) * 214}
                        y2={280 + Math.sin(a) * 214}
                      />
                    );
                  })}
                </svg>

                <span
                  className={styles.hand}
                  style={{ transform: `rotate(${handAngle}deg)` }}
                  aria-hidden="true"
                />

                <svg className={styles.core} viewBox="0 0 100 100" aria-hidden="true">
                  <path className={styles.coreMoon} d="M62 14 A38 38 0 1 0 62 86" />
                  <circle className={styles.coreOrb} cx="50" cy="50" r="15" />
                </svg>

                {SKILLS.map((s, i) => {
                  const a = (angleOf(i) * Math.PI) / 180;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={styles.node}
                      style={{
                        left: `${50 + Math.cos(a) * 38.2}%`,
                        top: `${50 + Math.sin(a) * 38.2}%`,
                        ["--tone" as string]: s.tone,
                      }}
                      aria-pressed={i === active}
                      aria-label={`${s.kind}: ${s.name}`}
                      data-cursor="OPEN"
                      onClick={() => {
                        choose(i);
                      }}
                    >
                      {/* Plain <img>: static export, the icon is 100 px. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={asset(s.icon)} alt="" width={100} height={100} draggable={false} />
                    </button>
                  );
                })}
              </div>
              <p className={styles.counter} aria-hidden="true">
                <span className={styles.counterNow}>{pad(active + 1)}</span>
                <span className={styles.counterBar} />
                <span>{pad(COUNT)}</span>
              </p>
            </div>

            <article key={skill.id} className={styles.panel} aria-live="polite">
              <p className={styles.kind}>{skill.kind}</p>
              <h3 className={styles.name}>{skill.name}</h3>
              <p className={styles.text}>{skill.text}</p>
              <dl className={styles.stats}>
                {skill.stats.map(([k, v]) => (
                  <div key={k} className={styles.stat}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
              <div className={styles.demoBox}>
                <SkillDemo kind={skill.demo} />
                <span className={styles.demoTag}>How it plays</span>
              </div>
            </article>
          </div>
        </div>
      </div>

      <SkinShowcase />
    </section>
  );
}
