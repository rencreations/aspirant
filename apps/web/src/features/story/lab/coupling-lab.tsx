"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

import { StarGlyph } from "@/components/star-glyph";
import { ThemeZone } from "@/components/theme-zone";
import { HudPanel } from "@/components/ui/hud-panel";
import { Meter } from "@/components/ui/meter";
import { couplingLab, couplingScores, pairs } from "@/content/world";
import { audio } from "@/lib/audio";
import { prefersReducedMotion } from "@/lib/hooks";
import { clamp, lerp } from "@/lib/math";
import { CHARACTER_NAMES } from "@/lib/slugs";

import { ChapterLink } from "../chapter-link";
import { SectionHead } from "../section-head";
import { closenessFor, MAX_SCORE, scoreOf, stageOf } from "./coupling-math";
import styles from "./coupling-lab.module.css";
import { createHum, type Hum } from "./hum";
import type { LabView } from "./lab-canvas";

const LabCanvas = dynamic(() => import("./lab-canvas"), {
  ssr: false,
  loading: () => <div className={styles.canvasFallback} aria-hidden="true" />,
});

const DEFAULT_COLOURS = ["#5ce1ff", "#ffcf5c"] as const;

const STAGE_TEXT = [
  "Apart. There is nothing to measure yet.",
  "The first Emblem stars wake.",
  "The stars link. One note, and a fifth above it.",
  "The stars merge into one. This is where the story's highest score sits.",
] as const;

const PRESETS = couplingLab
  .map((entry) => {
    const pair = pairs.find((p) => p.id === entry.pair);
    const source = couplingScores.find((s) => s.pair === entry.pair && s.value === entry.value);
    return {
      key: `${entry.pair}-${entry.value}`,
      value: entry.value,
      names: pair?.names ?? entry.pair,
      colours: pair?.colours ?? DEFAULT_COLOURS,
      labels: pair
        ? ([CHARACTER_NAMES[pair.members[0]], CHARACTER_NAMES[pair.members[1]]] as const)
        : null,
      source,
    };
  })
  .sort((a, b) => a.value - b.value);

/**
 * The Aspirant power lab. Two crystals; drag one toward the other (pointer, touch, the slider
 * or the preset buttons) and the coupling reading rises. At the thresholds the Emblem of Hope
 * stars wake, link and merge, and a soft note hums (Web Audio, silent when muted). The two
 * presets are the story's own scores; the dial between them is a toy.
 */
export function CouplingLab() {
  const stageRef = useRef<HTMLDivElement>(null);
  const view = useRef<LabView>({
    closeness: 0,
    colours: DEFAULT_COLOURS,
    labels: null,
    touched: false,
  });
  const hum = useRef<Hum | null>(null);
  const linger = useRef(0);
  const tween = useRef(0);
  const lastStage = useRef(0);
  const frame = useRef(0);
  const [score, setScore] = useState(0);
  const [closeness, setCloseness] = useState(0);
  const [preset, setPreset] = useState<number | null>(null);
  const [announce, setAnnounce] = useState("");

  const redraw = useCallback(() => {
    stageRef.current?.dispatchEvent(new Event("lab:view"));
  }, []);

  const apply = useCallback(
    (closeness: number) => {
      const c = clamp(closeness);
      view.current.closeness = c;
      const s = scoreOf(c);
      const stage = stageOf(s);
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        setScore(s);
        setCloseness(c);
      });
      redraw();
      if (stage > lastStage.current) {
        audio.blip("star");
        setAnnounce(STAGE_TEXT[stage]);
      } else if (stage < lastStage.current) {
        setAnnounce(STAGE_TEXT[stage]);
      }
      lastStage.current = stage;
      hum.current?.set(c, stage, true);
      window.clearTimeout(linger.current);
      linger.current = window.setTimeout(
        () => hum.current?.set(c, stage, false),
        stage >= 2 ? 2600 : 900,
      );
    },
    [redraw],
  );

  const touch = useCallback(() => {
    view.current.touched = true;
    hum.current ??= createHum();
    hum.current.wake();
  }, []);

  useEffect(() => {
    const t = tween.current;
    const l = linger.current;
    return () => {
      cancelAnimationFrame(t);
      cancelAnimationFrame(frame.current);
      window.clearTimeout(l);
      hum.current?.stop();
      hum.current = null;
    };
  }, []);

  const glideTo = (target: number) => {
    cancelAnimationFrame(tween.current);
    if (prefersReducedMotion()) {
      apply(target);
      return;
    }
    const from = view.current.closeness;
    const start = performance.now();
    const run = (now: number) => {
      const k = clamp((now - start) / 1100);
      const eased = 1 - Math.pow(1 - k, 3);
      apply(lerp(from, target, eased));
      if (k < 1) tween.current = requestAnimationFrame(run);
    };
    tween.current = requestAnimationFrame(run);
  };

  const choose = (i: number | null) => {
    touch();
    audio.blip("click");
    setPreset(i);
    const p = i === null ? null : PRESETS[i];
    view.current.colours = p ? [p.colours[0], p.colours[1]] : DEFAULT_COLOURS;
    view.current.labels = p?.labels ?? null;
    glideTo(p ? closenessFor(p.value) : 0);
  };

  const active = preset === null ? null : PRESETS[preset];
  const idea = couplingScores[0];
  const stage = stageOf(score);

  return (
    <ThemeZone theme="daybreak" aria-labelledby="lab-title" className={styles.section}>
      <section className="shell">
        <SectionHead
          id="lab-title"
          code="05 / Aspirant power lab"
          title="One plus one is more than two"
          lead="Two Aspirants who hold on to each other give more than the two of them added up. Pull the crystals together and watch the reading."
        />

        <div className={styles.layout}>
          <ThemeZone theme="storm" as="div" className={styles.screen}>
            <div ref={stageRef} className={styles.stage}>
              <LabCanvas
                view={view}
                className={styles.canvas}
                onDragStart={touch}
                onDrag={(c) => {
                  if (preset !== null) setPreset(null);
                  apply(c);
                }}
                onDragEnd={() => undefined}
              />
              <p className={`${styles.stageTag} hud-label`}>
                <StarGlyph /> Resonance bench
              </p>
              <p className={`${styles.stageTagR} hud-label`}>Drag a crystal</p>
            </div>
            <label className={styles.sliderRow}>
              <span className={styles.sliderEnd}>Apart</span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(closeness * 100)}
                className={styles.slider}
                style={{ "--p": closeness } as CSSProperties}
                aria-label="How close the two crystals are"
                aria-valuetext={`Coupling ${score.toFixed(2)}`}
                onChange={(e) => {
                  touch();
                  cancelAnimationFrame(tween.current);
                  setPreset(null);
                  apply(Number(e.currentTarget.value) / 100);
                }}
              />
              <span className={styles.sliderEnd}>Together</span>
            </label>
          </ThemeZone>

          <HudPanel
            label="Reading"
            code={`Max ${MAX_SCORE.toFixed(1)}`}
            accent="var(--gold)"
            className={styles.panel}
          >
            <div className={styles.readout}>
              <p className={styles.big} aria-hidden="true">
                {score.toFixed(2)}
              </p>
              <Meter
                label="Coupling"
                value={score}
                max={MAX_SCORE}
                segments={25}
                accent="var(--gold)"
                showValue={false}
                format={(v) => v.toFixed(2)}
              />
              <p className={styles.status} data-stage={stage}>
                {STAGE_TEXT[stage]}
              </p>
              <div role="group" aria-label="Scores from the story" className={styles.presets}>
                <button
                  type="button"
                  className={styles.preset}
                  aria-pressed={preset === null && score === 0}
                  onClick={() => choose(null)}
                >
                  <span>Apart</span>
                  <span className={styles.presetValue}>0.00</span>
                </button>
                {PRESETS.map((p, i) => (
                  <button
                    key={p.key}
                    type="button"
                    className={styles.preset}
                    aria-pressed={preset === i}
                    onClick={() => choose(i)}
                  >
                    <span>{p.names}</span>
                    <span className={styles.presetValue}>{p.value}</span>
                  </button>
                ))}
              </div>
              {active?.source ? (
                <div className={styles.source}>
                  <p className={`${styles.sourceLabel} hud-label`}>{active.source.label}</p>
                  <blockquote className={styles.sourceQuote}>{active.source.quote}</blockquote>
                  <ChapterLink id={active.source.chapterId} />
                </div>
              ) : (
                idea && (
                  <div className={styles.source}>
                    <p className={`${styles.sourceLabel} hud-label`}>The idea</p>
                    <blockquote className={styles.sourceQuote}>{idea.quote}</blockquote>
                    <ChapterLink id={idea.chapterId} />
                  </div>
                )
              )}
              <p className={styles.toy}>
                The dial is a toy. Only the two preset scores come from the story.
              </p>
            </div>
          </HudPanel>
        </div>

        <p className="sr-only" role="status" aria-live="polite">
          {announce}
        </p>

        <h3 className={`${styles.allTitle} hud-label`}>Every score the story gives</h3>
        <ul className={styles.all}>
          {couplingScores.map((s) => (
            <li key={`${s.chapterId}-${s.label}`} className={styles.scoreCard}>
              <p className={styles.scoreValue}>{s.display}</p>
              <p className={styles.scoreLabel}>{s.label}</p>
              <ChapterLink id={s.chapterId} />
            </li>
          ))}
        </ul>
      </section>
    </ThemeZone>
  );
}
