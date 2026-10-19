"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { NextFooter } from "@/components/next-footer/next-footer";
import { VideoCard } from "@/components/video-player/video-card";
import { audio } from "@/lib/audio";

import type { ClipName, StageState } from "./director";
import styles from "./selena.module.css";
import { SelenaStage, type StageApi } from "./stage";

/** The buttons, in order, and the clip each one plays. */
const MENU: ReadonlyArray<{ id: string; label: string; clip: ClipName }> = [
  { id: "about", label: "About", clip: "phone-empty" },
  { id: "skills", label: "Skills", clip: "horizontal" },
  { id: "gallery", label: "Gallery", clip: "vertical" },
  { id: "others", label: "Others", clip: "phone-messages" },
];

const SELENA_TRAILER = {
  src: "/video/selena/trailer.mp4",
  poster: "/video/selena/trailer-poster.webp",
  title: "Selena, trailer",
  duration: 69,
} as const;

interface SelenaNext {
  label: string;
  sublabel: string;
  href: React.ComponentProps<typeof NextFooter>["href"];
  image: string;
  accent: string;
  vars: React.CSSProperties;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Selena's page. One full-screen picture: the welcome animation plays once the page is in view,
 * then Selena idles in a seamless loop. The trailer sits in the empty top-left corner of the
 * picture, and four buttons in the empty top-right corner send her into other animations:
 * About, Skills, Gallery, Others. A clip starts when the loop reaches the frame it was cut from,
 * and the idle loop resumes when it ends.
 */
export function SelenaPage({ next }: { next: SelenaNext }) {
  const stage = useRef<StageApi>(null);
  const [state, setState] = useState<StageState>({ mode: "boot", clip: null, loading: false });
  const [announce, setAnnounce] = useState("");

  const onState = useCallback((s: StageState) => {
    setState(s);
    if (s.mode === "queued" && s.clip) {
      const item = MENU.find((m) => m.clip === s.clip);
      setAnnounce(
        s.loading
          ? `Loading ${item?.label ?? "animation"}`
          : `${item?.label ?? "Animation"} is next`,
      );
    } else if (s.mode === "clip" && s.clip) {
      setAnnounce(`Playing ${MENU.find((m) => m.clip === s.clip)?.label ?? "animation"}`);
    } else if (s.mode === "loop") {
      setAnnounce("");
    }
  }, []);

  // Esc leaves the queue or the clip.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("[role='dialog']")) stage.current?.cancel();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const ui = state.mode === "loop" || state.mode === "queued";
  const busy = state.mode === "queued";
  const inClip = state.mode === "clip" || state.mode === "returning";

  return (
    <div className={styles.page} data-theme="storm">
      <section className={styles.hero} aria-labelledby="selena-title" data-mode={state.mode}>
        <h1 id="selena-title" className="sr-only">
          Selena
        </h1>
        <SelenaStage ref={stage} onState={onState} />

        <div className={styles.ui} data-visible={ui}>
          <div className={styles.trailer}>
            <VideoCard
              video={{
                src: SELENA_TRAILER.src,
                poster: SELENA_TRAILER.poster,
                title: SELENA_TRAILER.title,
              }}
              duration={SELENA_TRAILER.duration}
              tag="Trailer"
              className={styles.trailerCard}
            />
          </div>

          <nav className={styles.menu} aria-label="Selena" inert={!ui}>
            <ul>
              {MENU.map((item, i) => {
                const mine = state.clip === item.clip && busy;
                const status = mine ? (state.loading ? "loading" : "queued") : "idle";
                return (
                  <li key={item.id} style={{ ["--i" as string]: i }}>
                    <button
                      type="button"
                      className={styles.button}
                      data-state={status}
                      data-dim={busy && !mine}
                      aria-pressed={mine}
                      disabled={busy && !mine}
                      onPointerEnter={() => {
                        stage.current?.warm(item.clip);
                        audio.blip("hover");
                      }}
                      onFocus={() => {
                        stage.current?.warm(item.clip);
                      }}
                      onClick={() => {
                        audio.blip("click");
                        if (mine) stage.current?.cancel();
                        else stage.current?.request(item.clip);
                      }}
                    >
                      <span className={styles.shard} aria-hidden="true" />
                      <span className={styles.index} aria-hidden="true">
                        {pad(i + 1)}
                      </span>
                      <span className={styles.text}>{item.label}</span>
                      <span className={styles.bars} aria-hidden="true">
                        <i />
                        <i />
                        <i />
                      </span>
                      <span className={styles.sheen} aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        {state.mode === "welcome" ? (
          <button
            type="button"
            className={styles.corner}
            onClick={() => {
              stage.current?.skipWelcome();
            }}
          >
            <span>Skip</span>
            <i aria-hidden="true" />
          </button>
        ) : null}
        {inClip ? (
          <button
            type="button"
            className={styles.corner}
            disabled={state.mode === "returning"}
            onClick={() => {
              stage.current?.cancel();
            }}
          >
            <span>Back</span>
            <i aria-hidden="true" />
          </button>
        ) : null}

        <p role="status" aria-live="polite" className="sr-only">
          {announce}
        </p>
      </section>

      <div data-theme="daybreak" className={styles.nextZone} style={next.vars}>
        <NextFooter
          eyebrow="Next in queue"
          label={next.label}
          sublabel={next.sublabel}
          href={next.href}
          image={next.image}
          accent={next.accent}
        />
      </div>
    </div>
  );
}
