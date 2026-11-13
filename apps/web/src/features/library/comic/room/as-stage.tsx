"use client";

import type { CSSProperties } from "react";

import type { ComicStageData } from "../types";
import { Chibi, drawing, PanelArt, Part, Stage, type Place } from "./stage";
import styles from "./as-stage.module.css";

const R = drawing(1280, 640);
const N = drawing(1000, 1250);

const TITLE = "THE ASPIRANT";

/** A fat starburst with a sound word in it. */
function Burst({ word }: { word: string }) {
  const points = Array.from({ length: 28 }, (_, i) => {
    const a = (i / 28) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? 50 : 34;
    return `${(50 + Math.cos(a) * r).toFixed(2)},${(50 + Math.sin(a) * r).toFixed(2)}`;
  }).join(" ");
  return (
    <svg viewBox="0 0 100 100" className={styles.burst} aria-hidden="true">
      <polygon points={points} fill="#14121a" transform="translate(3 4)" />
      <polygon
        points={points}
        fill="#ffd23d"
        stroke="#14121a"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <text x="50" y="58" textAnchor="middle" className={styles.burstWord}>
        {word}
      </text>
    </svg>
  );
}

/** Speed lines: thin wedges that run out from the middle. */
function Rays() {
  const wedges = Array.from({ length: 36 }, (_, i) => {
    const a0 = (i / 36) * Math.PI * 2;
    const a1 = a0 + (Math.PI * 2) / 72;
    const p = (a: number, r: number) =>
      `${(50 + Math.cos(a) * r).toFixed(2)},${(50 + Math.sin(a) * r).toFixed(2)}`;
    return `${p(a0, 8)} ${p(a0, 70)} ${p(a1, 70)} ${p(a1, 8)}`;
  });
  return (
    <svg viewBox="0 0 100 100" className={styles.rays} aria-hidden="true">
      {wedges.map((w, i) => (
        <polygon
          key={i}
          points={w}
          fill={i % 3 === 0 ? "#ff4d6d" : "#ff9a3d"}
          opacity={i % 3 === 0 ? 0.2 : 0.14}
        />
      ))}
    </svg>
  );
}

function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <path d="M20 0 L24 16 L40 20 L24 24 L20 40 L16 24 L0 20 L16 16 Z" fill="currentColor" />
    </svg>
  );
}

const SPARKLES: ReadonlyArray<[number, number, number, string]> = [
  [330, 150, 34, "#35d6e0"],
  [800, 560, 26, "#ff4d6d"],
  [1100, 500, 32, "#35d6e0"],
  [170, 120, 24, "#ff9a3d"],
  [610, 585, 30, "#ffd23d"],
  [1050, 120, 26, "#ff4d6d"],
];

/** Dots of colour that drift behind everything. */
const DOTS: ReadonlyArray<[number, number, number, string]> = [
  [260, 520, 22, "#ff9a3d"],
  [940, 150, 18, "#35d6e0"],
  [90, 330, 16, "#ff4d6d"],
  [1190, 330, 20, "#ff9a3d"],
  [700, 100, 14, "#ff4d6d"],
];

interface Props {
  stage: ComicStageData;
}

/**
 * The Aspirant's stage, made for this room: a comic page that has been blown open. Layla and Fanny
 * (the pink and the orange) fight and stand side by side in panels cut from the comic, the first
 * page is in the middle, speed lines turn behind it, a starburst shouts, and their chibi stickers
 * float over the edge of the card. Everything is a live part.
 */
export function AsStage({ stage }: Props) {
  const p = stage.panels;
  const c = stage.chibi;
  const first = p["as-first"];
  const sword = p["as-layla-sword"];
  const fanny = p["as-fanny-face"];
  const burst = p["as-layla-burst"];
  const both = p["as-both"];
  const duel = p["as-duel"];
  const angry = p["as-layla-angry"];
  const hearts = c["fl-hearts"];
  const camera = c["fl-camera"];
  const oval = c["fl-oval"];
  if (
    !first ||
    !sword ||
    !fanny ||
    !burst ||
    !both ||
    !duel ||
    !angry ||
    !hearts ||
    !camera ||
    !oval
  )
    return null;

  return (
    <Stage
      label="The Aspirant, the comic"
      className={styles.stage}
      ratio={{ wide: "1280 / 640", narrow: "4 / 5" }}
      vars={
        {
          "--frame": "#14121a",
          "--frame-w": "0.5cqw",
          "--frame-r": "0.2cqw",
          "--frame-shadow": "0.5cqw 0.6cqw 0 #14121a",
        } as CSSProperties
      }
    >
      {/* ---- the card ---- */}
      <Part
        id="shadow"
        order={0}
        wide={R(58, 70, 1180, 556, -0.9)}
        narrow={N(20, 180, 972, 1050, -0.8)}
        z={1}
        amp={2}
        dur={11}
        depth={-0.5}
        still
      >
        <span className={styles.shadow} />
      </Part>
      <Part
        id="card"
        order={1}
        wide={R(44, 56, 1186, 560, -0.9)}
        narrow={N(8, 168, 980, 1050, -0.8)}
        z={2}
        amp={2}
        dur={12}
        depth={-0.3}
        still
      >
        <span className={styles.card} />
      </Part>
      <Part
        id="rays"
        order={2}
        wide={R(330, 60, 620, 620, 0)}
        narrow={N(120, 330, 760, 760, 0)}
        z={3}
        amp={0}
        dur={60}
        depth={-0.1}
        still
      >
        <Rays />
      </Part>

      {/* ---- the title ---- */}
      <Part
        id="title"
        order={9}
        wide={R(290, 0, 710, 158, -1.8)}
        narrow={N(30, 6, 940, 196, -1.4)}
        z={14}
        amp={4}
        dur={6.6}
        depth={0.7}
      >
        <span className={styles.title}>
          <span className={styles.titleText} aria-label={TITLE}>
            {Array.from(TITLE).map((ch, i) =>
              ch === " " ? (
                <span key={i} className={styles.gap} />
              ) : (
                <span
                  key={i}
                  className={styles.letter}
                  data-hot={i % 4 === 1 ? "true" : undefined}
                  style={{ "--k": i } as CSSProperties}
                >
                  {ch}
                </span>
              ),
            )}
          </span>
          <span className={styles.tagline}>
            Rivals at Selrick Academy. Partners against the Enders.
          </span>
        </span>
      </Part>

      {/* ---- the panels ---- */}
      <Part
        id="sword"
        order={3}
        wide={R(76, 176, 262, 414, -3)}
        narrow={N(36, 300, 290, 500, -3)}
        z={8}
        amp={7}
        dur={8.6}
        depth={0.9}
      >
        <PanelArt
          panel={sword}
          alt="Layla with her blade, a panel of the comic"
          position="50% 20%"
          eager
        />
      </Part>
      <Part
        id="fanny"
        order={4}
        wide={R(338, 272, 178, 218, 2.4)}
        narrow={N(310, 560, 250, 330, 2.5)}
        z={9}
        amp={6}
        dur={7.2}
        depth={0.6}
      >
        <PanelArt panel={fanny} alt="Fanny, a panel of the comic" position="40% 30%" eager />
      </Part>
      <Part
        id="first"
        order={5}
        wide={R(512, 214, 296, 244, 0)}
        narrow={N(250, 270, 600, 280, 1)}
        z={10}
        amp={6}
        dur={7}
        depth={0.5}
      >
        <PanelArt panel={first} alt="The planet, the first page of the comic" eager />
      </Part>
      <Part
        id="burst-panel"
        order={6}
        wide={R(800, 286, 178, 204, -2.2)}
        narrow={N(560, 640, 280, 330, -2)}
        z={9}
        amp={6}
        dur={7.8}
        depth={0.6}
      >
        <PanelArt
          panel={burst}
          alt="Layla in a star of light, a panel of the comic"
          position="50% 30%"
          eager
        />
      </Part>
      <Part
        id="both"
        order={7}
        wide={R(962, 168, 252, 416, 3)}
        narrow={N(676, 300, 290, 500, 3)}
        z={8}
        amp={7}
        dur={9}
        depth={0.9}
      >
        <PanelArt
          panel={both}
          alt="Layla and Fanny side by side, a panel of the comic"
          position="50% 25%"
          eager
        />
      </Part>
      <Part
        id="angry"
        order={8}
        wide={R(528, 470, 250, 138, 1.4)}
        narrow={N(60, 820, 440, 250, 1.5)}
        z={9}
        amp={5}
        dur={8.4}
        depth={0.4}
      >
        <PanelArt panel={angry} alt="Layla, furious, a panel of the comic" position="50% 22%" />
      </Part>
      <Part
        id="duel"
        order={8}
        wide={R(792, 500, 160, 112, -1.6)}
        z={9}
        amp={5}
        dur={9.6}
        depth={0.3}
      >
        <PanelArt
          panel={duel}
          alt="Fanny above and Layla below, a panel of the comic"
          position="50% 80%"
        />
      </Part>

      {/* ---- the shout and the stickers ---- */}
      <Part
        id="pow"
        order={11}
        wide={R(884, 118, 220, 178, -9)}
        narrow={N(700, 150, 290, 240, -8)}
        z={13}
        amp={9}
        dur={4.4}
        depth={1.5}
      >
        <Burst word="KA-POW!" />
      </Part>
      <Part
        id="hearts"
        order={12}
        wide={R(14, 440, 330, 245, -5)}
        narrow={N(0, 960, 500, 372, -4)}
        z={15}
        amp={10}
        dur={5.6}
        depth={1.7}
      >
        <Chibi chibi={hearts} alt="Chibi Layla and Fanny with a heart" />
      </Part>
      <Part
        id="camera"
        order={13}
        wide={R(1000, 468, 258, 181, 4)}
        narrow={N(500, 990, 480, 336, 4)}
        z={15}
        amp={10}
        dur={6.2}
        delay={-1.8}
        depth={1.7}
      >
        <Chibi chibi={camera} alt="Chibi Layla and Fanny smiling" />
      </Part>
      <Part
        id="oval"
        order={13}
        wide={R(310, 468, 150, 112, -3)}
        z={12}
        amp={8}
        dur={5.2}
        delay={-0.9}
        depth={1.4}
      >
        <Chibi chibi={oval} alt="Chibi Layla and Fanny" />
      </Part>

      {/* ---- sparkles and dots ---- */}
      {SPARKLES.map(([x, y, s, color], i) => (
        <Part
          key={`s${i}`}
          id={`sparkle-${i}`}
          order={14}
          wide={R(x, y, s, s, 0)}
          narrow={i % 2 === 0 ? N(60 + i * 150, 230 + i * 130, s * 1.6, s * 1.6, 0) : undefined}
          z={16}
          amp={9 + i}
          dur={3.2 + i * 0.5}
          delay={-i * 0.7}
          depth={1.9}
        >
          <span className={styles.spark} style={{ color }}>
            <Sparkle className={styles.sparkle} />
          </span>
        </Part>
      ))}
      {DOTS.map(([x, y, s, color], i) => {
        const wide: Place = R(x, y, s, s, 0);
        return (
          <Part
            key={`d${i}`}
            id={`dot-${i}`}
            order={14}
            wide={wide}
            z={4}
            amp={12}
            dur={4.4 + i * 0.6}
            delay={-i * 0.5}
            depth={1.1}
          >
            <span className={styles.dot} style={{ background: color }} />
          </Part>
        );
      })}
    </Stage>
  );
}
