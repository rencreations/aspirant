"use client";

import type { CSSProperties } from "react";

import type { ComicStageData } from "../types";
import { Chibi, drawing, PanelArt, Part, Stage, type Place } from "./stage";
import styles from "./vg-stage.module.css";

/** The banner this copies is 1280 by 595. The wide layout is placed in its pixels. */
const R = drawing(1280, 595);
/** On a narrow screen the composition stands taller: 1000 by 1250. */
const N = drawing(1000, 1250);

/** Ribbon letters in yellow: the S of STARS, and the A, A, T of ASPIRATION. */
const TITLE = "TWIN STARS OF ASPIRATION";
const YELLOW = new Set([5, 13, 18, 19]);

function Letters({ text, yellow }: { text: string; yellow?: Set<number> }) {
  return (
    <>
      {Array.from(text).map((ch, i) =>
        ch === " " ? (
          <span key={i} className={styles.gap} />
        ) : (
          <span
            key={i}
            className={styles.letter}
            data-yellow={yellow?.has(i) ? "true" : undefined}
            style={{ "--k": i } as CSSProperties}
          >
            {ch}
          </span>
        ),
      )}
    </>
  );
}

function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <path d="M20 0 L24 16 L40 20 L24 24 L20 40 L16 24 L0 20 L16 16 Z" fill="currentColor" />
    </svg>
  );
}

function Mascot() {
  return (
    <svg viewBox="0 0 100 125" className={styles.mascot} aria-hidden="true">
      <polygon
        points="12,44 20,6 50,28"
        fill="#ff8fb3"
        stroke="#fff"
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <polygon
        points="88,44 80,6 50,28"
        fill="#ff8fb3"
        stroke="#fff"
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <polygon points="22,32 25,16 38,28" fill="#ffc2d6" />
      <polygon points="78,32 75,16 62,28" fill="#ffc2d6" />
      <circle cx="50" cy="76" r="40" fill="#ff9fbf" stroke="#fff" strokeWidth="6" />
      <path
        d="M29 74 q8 -10 17 0"
        stroke="#7a2e57"
        strokeWidth="3.4"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M54 74 q8 -10 17 0"
        stroke="#7a2e57"
        strokeWidth="3.4"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M42 89 q8 8 16 0"
        stroke="#7a2e57"
        strokeWidth="3.2"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="27" cy="86" r="6" fill="#ff6f9f" opacity="0.7" />
      <circle cx="73" cy="86" r="6" fill="#ff6f9f" opacity="0.7" />
    </svg>
  );
}

function HeartBubble() {
  return (
    <svg viewBox="0 0 110 95" className={styles.bubble} aria-hidden="true">
      <defs>
        <pattern id="vg-dots" width="7" height="7" patternUnits="userSpaceOnUse">
          <circle cx="3.5" cy="3.5" r="1.5" fill="#fff" opacity="0.35" />
        </pattern>
      </defs>
      <path
        d="M14 10 Q56 -6 100 14 Q114 50 94 70 L99 92 L70 78 Q30 90 10 62 Q-4 34 14 10 Z"
        fill="#7a86f2"
        stroke="#fff"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path
        d="M14 10 Q56 -6 100 14 Q114 50 94 70 L99 92 L70 78 Q30 90 10 62 Q-4 34 14 10 Z"
        fill="url(#vg-dots)"
      />
      <path
        d="M55 62 C28 44 34 24 48 26 C53 27 55 31 55 31 C55 31 57 27 62 26 C76 24 82 44 55 62 Z"
        fill="#ff6f98"
        stroke="#fff"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Shards() {
  return (
    <svg viewBox="0 0 150 170" className={styles.shards} aria-hidden="true">
      <polygon points="0,36 128,6 70,52" fill="#3f2aa8" />
      <polygon points="6,84 118,62 56,104" fill="#6a4fd6" />
      <polygon points="12,128 96,112 52,150" fill="#4b36bd" />
      <polygon points="104,26 112,2 126,30" fill="#ffc83d" />
    </svg>
  );
}

/** Confetti: a small piece of colour, its place on the wide layout and its colour. */
const CONFETTI: ReadonlyArray<[number, number, number, number, number, string]> = [
  [846, 150, 20, 7, 24, "#35d6e0"],
  [935, 372, 16, 6, -30, "#ff5a7a"],
  [1112, 556, 22, 7, 20, "#ffc83d"],
  [372, 584, 18, 6, -18, "#7a86f2"],
  [98, 104, 16, 6, 36, "#ff5a7a"],
  [210, 556, 20, 7, -22, "#35d6e0"],
  [660, 136, 18, 6, 14, "#ffc83d"],
  [1172, 244, 18, 6, -40, "#7a86f2"],
  [752, 552, 18, 6, 28, "#ff5a7a"],
  [545, 148, 16, 6, -12, "#35d6e0"],
];

interface Props {
  stage: ComicStageData;
}

/**
 * Guinevere and Vexana's stage: the banner of the comic, made from live parts. The seven panels are
 * cut from the comic's own pages (the wide dark one is the first page, which the transition into
 * the comic will zoom into), the chibi pair is a sticker, and the ribbon, the card, the heart, the
 * mascot, the shards and the confetti are drawn here.
 */
export function VgStage({ stage }: Props) {
  const p = stage.panels;
  const c = stage.chibi;
  const first = p["gv-first"];
  const vexana = p["gv-vexana"];
  const boom = p["gv-boom"];
  const close = p["gv-close"];
  const meadow = p["gv-meadow"];
  const gold = p["gv-gold"];
  const pair = c["gv-pair"];
  if (!first || !vexana || !boom || !close || !meadow || !gold || !pair) return null;

  return (
    <Stage
      label="Guinevere and Vexana, the comic"
      className={styles.stage}
      ratio={{ wide: "1280 / 595", narrow: "4 / 5" }}
      vars={{ "--frame": "#5f4bd0", "--frame-w": "0.5cqw" } as CSSProperties}
    >
      {/* ---- the card ---- */}
      <Part
        id="scrap-left"
        order={0}
        wide={R(26, 118, 74, 440, -4)}
        narrow={N(8, 190, 60, 900, -2)}
        z={1}
        amp={3}
        dur={9}
        still
      >
        <span className={styles.scrap} />
      </Part>
      <Part
        id="scrap-right"
        order={0}
        wide={R(1176, 96, 100, 470, 3)}
        narrow={N(930, 200, 66, 880, 2)}
        z={1}
        amp={3}
        dur={10}
        still
      >
        <span className={styles.scrap} data-tint="true" />
      </Part>
      <Part
        id="back"
        order={1}
        wide={R(46, 68, 1196, 522, -0.6)}
        narrow={N(10, 170, 980, 1060, -0.6)}
        z={2}
        amp={2}
        dur={11}
        depth={-0.4}
        still
      >
        <span className={styles.back} />
      </Part>
      <Part
        id="card"
        order={2}
        wide={R(66, 60, 1160, 514, -0.35)}
        narrow={N(22, 180, 956, 1040, -0.3)}
        z={3}
        amp={2}
        dur={12}
        depth={-0.2}
        still
      >
        <span className={styles.card} />
      </Part>

      {/* ---- the ribbon, the subtitle ---- */}
      <Part
        id="ribbon"
        order={8}
        wide={R(222, 2, 842, 108, 0)}
        narrow={N(34, 8, 932, 170, 0)}
        z={12}
        amp={4}
        dur={6.5}
        depth={0.6}
      >
        <span className={styles.ribbon}>
          <svg
            viewBox="0 0 842 108"
            preserveAspectRatio="none"
            className={styles.ribbonArt}
            aria-hidden="true"
          >
            <defs>
              <pattern
                id="vg-stripes"
                width="14"
                height="14"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(40)"
              >
                <rect width="5" height="14" fill="#fff" opacity="0.12" />
              </pattern>
            </defs>
            <rect x="0" y="6" width="842" height="96" rx="7" fill="#e8860f" />
            <rect x="0" y="2" width="842" height="94" rx="7" fill="#ff9d1c" />
            <rect x="0" y="2" width="842" height="44" rx="7" fill="#ffb54a" />
            <rect x="0" y="2" width="842" height="94" rx="7" fill="url(#vg-stripes)" />
            <rect x="14" y="74" width="12" height="12" fill="#3a2a14" />
            <rect x="816" y="74" width="12" height="12" fill="#3a2a14" />
          </svg>
          <span className={styles.title} aria-label={TITLE}>
            <Letters text={TITLE} yellow={YELLOW} />
          </span>
        </span>
      </Part>
      <Part
        id="subtitle"
        order={9}
        wide={R(404, 112, 472, 40)}
        narrow={N(170, 184, 660, 52)}
        z={12}
        amp={3}
        dur={8}
        depth={0.3}
        still
      >
        <span className={styles.sub}>
          <Sparkle className={styles.sparkle} />
          <span>THE ASPIRANTS COMICS</span>
          <Sparkle className={styles.sparkle} />
        </span>
      </Part>

      {/* ---- the seven panels ---- */}
      <Part
        id="shards"
        order={5}
        wide={R(0, 96, 150, 170, 0)}
        narrow={N(0, 256, 120, 140, 0)}
        z={9}
        amp={5}
        dur={7.5}
        depth={1.1}
      >
        <Shards />
      </Part>
      <Part
        id="vexana"
        order={3}
        wide={R(112, 100, 285, 445, 1.5)}
        narrow={N(44, 262, 290, 470, -2)}
        z={8}
        amp={7}
        dur={8.5}
        depth={0.9}
      >
        <PanelArt
          panel={vexana}
          alt="Vexana in her dark form, a panel of the comic"
          position="50% 40%"
          eager
        />
      </Part>
      <Part
        id="first"
        order={4}
        wide={R(330, 148, 330, 176, -1)}
        narrow={N(250, 250, 700, 300, 1)}
        z={7}
        amp={6}
        dur={7}
        depth={0.5}
      >
        <PanelArt panel={first} alt="Fire over the city, the first page of the comic" eager />
      </Part>
      <Part
        id="pair"
        order={5}
        wide={R(660, 165, 290, 172, -1.2)}
        narrow={N(380, 600, 560, 330, 1.5)}
        z={7}
        amp={5}
        dur={9}
        depth={0.7}
      >
        <span className={styles.paper} />
      </Part>
      <Part
        id="chibi"
        order={10}
        wide={R(686, 134, 210, 232, 0)}
        narrow={N(440, 560, 400, 440, 0)}
        z={10}
        amp={9}
        dur={5.2}
        depth={1.4}
      >
        <Chibi chibi={pair} alt="Chibi Vexana and Guinevere" />
      </Part>
      <Part
        id="bubble"
        order={11}
        wide={R(876, 146, 112, 96, 5)}
        narrow={N(770, 540, 200, 170, 6)}
        z={11}
        amp={8}
        dur={4.6}
        depth={1.6}
      >
        <HeartBubble />
      </Part>
      <Part
        id="boom"
        order={6}
        wide={R(368, 318, 215, 226, -4)}
        narrow={N(60, 770, 380, 360, -3)}
        z={6}
        amp={6}
        dur={7.8}
        depth={0.6}
      >
        <PanelArt panel={boom} alt="Guinevere strikes, a panel of the comic" position="40% 30%" />
      </Part>
      <Part
        id="close"
        order={7}
        wide={R(560, 340, 196, 196, -1.5)}
        narrow={N(450, 840, 400, 330, 2)}
        z={5}
        amp={5}
        dur={9.4}
        depth={0.4}
      >
        <PanelArt panel={close} alt="The two close together, a panel of the comic" />
      </Part>
      <Part
        id="meadow"
        order={8}
        wide={R(764, 368, 164, 168, 1)}
        z={5}
        amp={5}
        dur={8.2}
        depth={0.4}
      >
        <PanelArt
          panel={meadow}
          alt="The two in a meadow, a panel of the comic"
          position="55% 50%"
        />
      </Part>
      <Part
        id="gold"
        order={6}
        wide={R(912, 110, 252, 432, 2.2)}
        narrow={N(690, 262, 270, 460, 2.5)}
        z={8}
        amp={7}
        dur={8.8}
        depth={0.9}
      >
        <PanelArt
          panel={gold}
          alt="A long haired figure in golden light, a panel of the comic"
          position="50% 20%"
        />
      </Part>

      {/* ---- the mascot and the confetti ---- */}
      <Part
        id="mascot"
        order={12}
        wide={R(1128, 22, 104, 130, 6)}
        narrow={N(850, 20, 130, 160, 6)}
        z={14}
        amp={9}
        dur={4.2}
        depth={1.8}
      >
        <Mascot />
      </Part>
      {CONFETTI.map(([x, y, w, h, r, color], i) => {
        const wide: Place = R(x, y, w, h, r);
        // On a narrow screen only some pieces stay, and they stand in other places.
        const narrow: Place | undefined =
          i % 2 === 0
            ? N(60 + ((i * 97) % 880), 230 + ((i * 131) % 900), w * 1.3, h * 1.3, r)
            : undefined;
        return (
          <Part
            key={i}
            id={`confetti-${i}`}
            order={13}
            wide={wide}
            narrow={narrow}
            z={13}
            amp={10 + (i % 4) * 3}
            dur={3.4 + (i % 5) * 0.7}
            delay={-(i * 0.6)}
            depth={1.2 + (i % 3) * 0.3}
          >
            <span className={styles.confetti} style={{ background: color }} />
          </Part>
        );
      })}
    </Stage>
  );
}
