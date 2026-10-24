"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { PlayerOverlay, type PlayerVideo } from "@/components/video-player/player-overlay";
import { audio } from "@/lib/audio";

import { videoInfo } from "./info";
import { playerVideo, type VideoName } from "../media";

/** The three colours of the site's player on this page (see `PlayerVideo.skin`). */
const VEXANA_SKIN = { ink: "#140e26", keyline: "#b79cf2", accent: "#e040a0" } as const;

/** The site's player for one of this page's videos. It grows out of the button and shrinks back. */
export function videoFor(name: VideoName, title: string): PlayerVideo {
  const v = videoInfo(name);
  return {
    ...playerVideo(name, title, [{ label: `${v.height}p`, height: v.height, src: v.src }]),
    skin: VEXANA_SKIN,
  };
}

interface Props {
  video: PlayerVideo;
  className?: string;
  label: string;
  children: ReactNode;
  onOpen?: () => void;
}

/**
 * A button that opens the site's custom player. The player is the same one `VideoCard` opens, but
 * the button can wear any shape, so the page can build its own cards.
 */
export function PlayerButton({ video, className, label, children, onOpen }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const getOrigin = useCallback(() => ref.current?.getBoundingClientRect() ?? null, []);
  return (
    <>
      <button
        ref={ref}
        type="button"
        className={className}
        aria-label={label}
        aria-haspopup="dialog"
        data-cursor="PLAY"
        onPointerEnter={() => {
          audio.blip("hover");
        }}
        onClick={() => {
          onOpen?.();
          setOpen(true);
        }}
      >
        {children}
      </button>
      {open
        ? createPortal(
            <PlayerOverlay
              video={video}
              getOrigin={getOrigin}
              onClosed={() => {
                setOpen(false);
              }}
            />,
            document.body,
          )
        : null}
    </>
  );
}
