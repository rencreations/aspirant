"use client";

import { useRef, useState, type CSSProperties, type KeyboardEvent } from "react";

import { cn } from "@aspirant/ui/lib/utils";

import { ThemeZone } from "@/components/theme-zone";
import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import { useVoiceState } from "@/lib/hooks";

import type { VersusPairing, VersusSide } from "../types";
import styles from "./versus.module.css";

type SideKey = "day" | "storm";

const PANEL_ID = "versus-panel";
const tabId = (i: number) => `versus-tab-${i}`;

let lastVoice = { url: "", at: 0 };

/** Play a side's voice line, ignoring a repeat of the same line within a moment. */
function speak(side: VersusSide, unlock: boolean) {
  const url = asset(side.voice.file);
  const now = performance.now();
  if (lastVoice.url === url && now - lastVoice.at < 700) return;
  lastVoice = { url, at: now };
  if (unlock) audio.unlock();
  void audio.playVoice(url);
}

function SideArt({ side, which }: { side: VersusSide; which: SideKey }) {
  return (
    <div className={styles.art} data-side={which}>
      <div className={styles.artBox}>
        {/* eslint-disable-next-line @next/next/no-img-element -- static export, plain img */}
        <img
          className={styles.idle}
          src={asset(side.idle.src)}
          alt=""
          width={side.idle.width}
          height={side.idle.height}
          loading="lazy"
          decoding="async"
          style={{ objectPosition: side.idlePosition }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element -- static export, plain img */}
        <img
          className={cn(styles.active, side.active.cutout && styles.cutout)}
          src={asset(side.active.src)}
          alt={side.alt}
          width={side.active.width}
          height={side.active.height}
          loading="lazy"
          decoding="async"
          style={{ objectPosition: side.active.position }}
        />
      </div>
    </div>
  );
}

/**
 * Off track, on track: two halves split by a diagonal rift, Daybreak on the left (or top on
 * phones) and Storm on the right. Hover, focus or tap a side to widen it, swap its art and
 * hear her line. Three pairings behind tabs.
 */
export function VersusStage({ pairings }: { pairings: readonly VersusPairing[] }) {
  const [index, setIndex] = useState(0);
  const [active, setActive] = useState<SideKey | null>(null);
  const tabsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const voice = useVoiceState();
  const pairing = pairings[index] ?? pairings[0];
  if (!pairing) return null;

  const choose = (to: number, focus = false) => {
    if (focus) tabsRef.current[to]?.focus();
    if (to === index) return;
    audio.blip("whoosh");
    setIndex(to);
    setActive(null);
  };

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const last = pairings.length - 1;
    let to = -1;
    if (e.key === "ArrowRight") to = i === last ? 0 : i + 1;
    else if (e.key === "ArrowLeft") to = i === 0 ? last : i - 1;
    else if (e.key === "Home") to = 0;
    else if (e.key === "End") to = last;
    if (to < 0) return;
    e.preventDefault();
    choose(to, true);
  };

  const split = active === "day" ? "66%" : active === "storm" ? "34%" : "50%";

  const sideButton = (which: SideKey, side: VersusSide) => {
    const playing = voice.playing && voice.url === asset(side.voice.file);
    return (
      <button
        type="button"
        className={styles.side}
        data-side={which}
        aria-pressed={active === which}
        onPointerEnter={(e) => {
          if (e.pointerType !== "mouse") return;
          setActive(which);
          audio.blip("hover");
          speak(side, false);
        }}
        onFocus={(e) => {
          setActive(which);
          if (e.target.matches(":focus-visible")) speak(side, false);
        }}
        onClick={() => {
          setActive(which);
          speak(side, true);
        }}
      >
        <span className={styles.label}>
          <span className={styles.world}>{which === "day" ? "Daybreak" : "Storm"}</span>
          <span className={styles.sideTitle}>{side.title}</span>
          <span className={styles.sideName}>{side.name}</span>
          <span className={styles.sideLine}>{side.line}</span>
          {playing && <span className={styles.sideVoice}>&ldquo;{side.voice.en}&rdquo;</span>}
        </span>
      </button>
    );
  };

  return (
    <ThemeZone theme="daybreak" aria-labelledby="versus-title" className={styles.section}>
      <div className={cn(styles.head, "shell")}>
        <div>
          <p className="hud-label">03 / Versus</p>
          <h2 id="versus-title" className={styles.title}>
            Off track, on track
          </h2>
          <p className={styles.intro}>
            Every pairing has two sides. Pick one to widen it and hear her speak.
          </p>
        </div>
        <div role="tablist" aria-label="Pairings" className={styles.tabs}>
          {pairings.map((p, i) => (
            <button
              key={p.id}
              ref={(el) => {
                tabsRef.current[i] = el;
              }}
              type="button"
              role="tab"
              id={tabId(i)}
              aria-selected={i === index}
              aria-controls={PANEL_ID}
              tabIndex={i === index ? 0 : -1}
              className={styles.tab}
              onClick={() => choose(i)}
              onKeyDown={(e) => onTabKey(e, i)}
            >
              <span className={styles.tabIndex} aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              {p.tab}
            </button>
          ))}
        </div>
      </div>

      <div
        role="tabpanel"
        id={PANEL_ID}
        aria-labelledby={tabId(index)}
        className={styles.stage}
        data-active={active ?? "none"}
        style={{ "--vs-split": split } as CSSProperties}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") setActive(null);
        }}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setActive(null);
        }}
      >
        <div className={styles.scene} key={pairing.id}>
          <SideArt side={pairing.day} which="day" />
          <SideArt side={pairing.storm} which="storm" />
          <svg
            className={styles.rift}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            <polyline
              className={styles.riftGlow}
              points="56,0 54.5,9 57,16 53.5,27 55.5,35 51.5,46 53,55 48.5,66 50.5,74 46,86 47.5,93 44,100"
            />
            <polyline
              className={styles.riftCore}
              points="56,0 54.5,9 57,16 53.5,27 55.5,35 51.5,46 53,55 48.5,66 50.5,74 46,86 47.5,93 44,100"
            />
          </svg>
          <svg
            className={cn(styles.rift, styles.riftAcross)}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            <polyline
              className={styles.riftGlow}
              points="0,44 9,45.5 16,43 27,46.5 35,44.5 46,48.5 55,47 66,51.5 74,49.5 86,54 93,52.5 100,56"
            />
            <polyline
              className={styles.riftCore}
              points="0,44 9,45.5 16,43 27,46.5 35,44.5 46,48.5 55,47 66,51.5 74,49.5 86,54 93,52.5 100,56"
            />
          </svg>
          <p className={styles.caption}>
            <span className={styles.captionTitle}>{pairing.title}</span>
            <span className={styles.captionNote}>{pairing.note}</span>
          </p>
        </div>
        {sideButton("day", pairing.day)}
        {sideButton("storm", pairing.storm)}
        <span className={styles.vs} aria-hidden="true">
          VS
        </span>
      </div>
    </ThemeZone>
  );
}
