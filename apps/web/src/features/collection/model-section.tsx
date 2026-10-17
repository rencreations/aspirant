"use client";

import dynamic from "next/dynamic";
import { Suspense, useCallback, useState, type KeyboardEvent } from "react";

import { Frame } from "@/components/frame/frame";
import { FrameImage } from "@/components/frame/frame-image";
import { StarButton } from "@/components/ui/star-button";
import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";

import { pairAccent } from "./frames";
import styles from "./models.module.css";
import type { ModelApi } from "./model-scene";
import type { ModelItem } from "./types";

const GLStage = dynamic(() => import("@/components/gl/gl-stage"), { ssr: false });
const ModelScene = dynamic(() => import("./model-scene"), { ssr: false });

interface ModelsProps {
  models: readonly ModelItem[];
}

/** The 3D viewers and the emote strip. One viewer is live at a time; the other stays a picture. */
export function ModelsSection({ models }: ModelsProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const emotes = models[0]?.emotes ?? [];

  return (
    <div className={styles.wrap}>
      <ul className={styles.list}>
        {models.map((model) => (
          <li key={model.id} className={styles.item}>
            {/* The key remounts the viewer on open and close, so its state starts fresh. */}
            <ModelViewer
              key={`${model.id}-${activeId === model.id}`}
              model={model}
              active={activeId === model.id}
              onToggle={() => setActiveId((id) => (id === model.id ? null : model.id))}
            />
          </li>
        ))}
      </ul>
      {emotes.length > 0 && <EmoteStrip emotes={emotes} />}
    </div>
  );
}

function ModelViewer({
  model,
  active,
  onToggle,
}: {
  model: ModelItem;
  active: boolean;
  onToggle: () => void;
}) {
  const [api, setApi] = useState<ModelApi | null>(null);
  const [loaded, setLoaded] = useState(false);
  const onLoaded = useCallback(() => setLoaded(true), []);
  const onReady = useCallback((next: ModelApi) => setApi(next), []);
  const name = model.title.replace(/, 3D model$/, "");

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!active || !api) return;
    if (e.key === "ArrowLeft") api.rotate(-0.3);
    else if (e.key === "ArrowRight") api.rotate(0.3);
    else if (e.key === "+" || e.key === "=" || e.key === "ArrowUp") api.zoom(0.85);
    else if (e.key === "-" || e.key === "_" || e.key === "ArrowDown") api.zoom(1.18);
    else if (e.key === "0") api.reset();
    else return;
    e.preventDefault();
  };

  return (
    <div className={styles.viewer} data-active={active}>
      <Frame
        shape="star"
        tilt={!active}
        accent={pairAccent(model.pair)}
        className={styles.frame}
        style={{ aspectRatio: 0.9 }}
      >
        <div
          className={styles.stage}
          role="group"
          tabIndex={active ? 0 : undefined}
          aria-label={
            active
              ? `3D viewer for ${name}. Arrow keys turn the model, plus and minus zoom, zero resets.`
              : undefined
          }
          onKeyDown={onKeyDown}
        >
          <FrameImage
            src={model.poster.src}
            alt={model.alt}
            width={model.poster.width}
            height={model.poster.height}
            className={styles.poster}
            sizes="(min-width: 900px) 40vw, 90vw"
          />
          {active && (
            <div className={styles.canvas} data-ready={loaded}>
              <GLStage
                camera={{ position: [0, 0.1, 4.4], fov: 34 }}
                label={`${name}, 3D model. Drag to orbit.`}
                fallback={<p className={styles.status}>3D is not available on this device.</p>}
              >
                <Suspense fallback={null}>
                  <ModelScene src={model.src} onReady={onReady} onLoaded={onLoaded} />
                </Suspense>
              </GLStage>
            </div>
          )}
          {active && !loaded && <p className={styles.status}>Loading the model</p>}
        </div>
      </Frame>

      <div className={styles.bar}>
        <div className={styles.barText}>
          <p className="m-0 hud-label">{active ? "Live viewer" : "3D model"}</p>
          <p className={styles.name}>{name}</p>
        </div>
        <div className={styles.tools}>
          {active && (
            <>
              <button
                type="button"
                className={styles.tool}
                aria-label="Turn left"
                onClick={() => api?.rotate(-0.45)}
              >
                <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                  <path d="M10 2L4 8l6 6" stroke="currentColor" strokeWidth="1.6" fill="none" />
                </svg>
              </button>
              <button
                type="button"
                className={styles.tool}
                aria-label="Turn right"
                onClick={() => api?.rotate(0.45)}
              >
                <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                  <path d="M6 2l6 6-6 6" stroke="currentColor" strokeWidth="1.6" fill="none" />
                </svg>
              </button>
              <button
                type="button"
                className={styles.tool}
                aria-label="Zoom in"
                onClick={() => api?.zoom(0.82)}
              >
                <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                  <path d="M3 8h10M8 3v10" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </button>
              <button
                type="button"
                className={styles.tool}
                aria-label="Zoom out"
                onClick={() => api?.zoom(1.2)}
              >
                <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                  <path d="M3 8h10" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </button>
              <button
                type="button"
                className={styles.tool}
                aria-label="Reset the view"
                onClick={() => api?.reset()}
              >
                <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                  <path
                    d="M3 8a5 5 0 105-5H5M5 1L3 3l2 2"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    fill="none"
                  />
                </svg>
              </button>
            </>
          )}
          <StarButton
            size="sm"
            variant={active ? "ghost" : "solid"}
            aria-pressed={active}
            onClick={onToggle}
          >
            {active ? "Close viewer" : `Open ${name} in 3D`}
          </StarButton>
        </div>
      </div>
    </div>
  );
}

/** Eight face-screen expressions as stickers. Hover wiggles, tap or Enter pops. */
function EmoteStrip({ emotes }: { emotes: readonly string[] }) {
  const [popped, setPopped] = useState<number | null>(null);

  return (
    <div className={styles.emotes}>
      <p className="m-0 hud-label">Emotes / the robot companion&apos;s face screen</p>
      <ul className={styles.strip}>
        {emotes.map((src, i) => (
          <li key={src}>
            <button
              type="button"
              className={styles.sticker}
              data-popped={popped === i}
              aria-label={`Emote ${i + 1} of ${emotes.length}`}
              onClick={() => {
                audio.blip("star");
                setPopped(i);
                window.setTimeout(() => setPopped((p) => (p === i ? null : p)), 600);
              }}
              onPointerEnter={(e) => {
                if (e.pointerType === "mouse") audio.blip("hover");
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={asset(src)}
                alt=""
                width={512}
                height={512}
                loading="lazy"
                decoding="async"
                draggable={false}
              />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
