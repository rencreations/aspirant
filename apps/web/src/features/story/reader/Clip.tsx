"use client";

import { useRef, useState, type CSSProperties } from "react";

import type { ClipMedia } from "@/content/story-types";
import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import { withSound } from "@/lib/sound-prompt";

import s from "./reader.module.css";
import { Credit } from "./Credit";
import { useAutoplay } from "./use-autoplay";

/**
 * A short film clip set into the text. It is muted and loops while at least half of it is on
 * screen, and rests (on its still) otherwise. A clip that kept its own sound has a button that
 * turns it on for as long as the visitor wants; the chapter's music steps back meanwhile.
 */
export function Clip({
  media,
  caption,
  overlay,
}: {
  media: ClipMedia;
  caption?: string | undefined;
  overlay?: { kicker?: string; title: string } | undefined;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [heard, setHeard] = useState(false);
  useAutoplay(ref);

  const toggle = () => {
    const el = ref.current;
    if (!el) return;
    audio.unlock();
    if (heard) {
      el.muted = true;
      setHeard(false);
      audio.resumeMusic(600);
      return;
    }
    withSound("This clip", () => {
      el.muted = false;
      setHeard(true);
      audio.pauseMusic(500);
    });
  };

  return (
    <figure
      className={s.clip}
      data-shape={media.w / media.h >= 1.45 ? "wide" : "tall"}
      style={
        {
          "--ar": `${media.w} / ${media.h}`,
          "--ratio": (media.w / media.h).toFixed(3),
          "--tint": media.color,
        } as CSSProperties
      }
    >
      <div className={s.frame}>
        <video
          ref={ref}
          className={s.frameVideo}
          muted
          loop
          playsInline
          preload="none"
          poster={asset(`/${media.poster}`)}
          width={media.w}
          height={media.h}
          aria-label={media.alt}
        >
          <source src={asset(`/${media.src}`)} type="video/mp4" />
        </video>
        {overlay && (
          <p className={s.clipOverlay}>
            {overlay.kicker && <span className={s.clipOverlayKicker}>{overlay.kicker}</span>}
            <span className={s.clipOverlayTitle}>{overlay.title}</span>
          </p>
        )}
        {media.sound && (
          <button
            type="button"
            className={s.soundButton}
            aria-pressed={heard}
            aria-label={heard ? "Turn the clip's sound off" : "Turn the clip's sound on"}
            onClick={toggle}
          >
            <span aria-hidden="true">{heard ? "Sound on" : "Sound off"}</span>
          </button>
        )}
      </div>
      <Credit caption={caption} credit={media.credit} />
    </figure>
  );
}
