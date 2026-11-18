"use client";

import { useCallback } from "react";
import { createPortal } from "react-dom";

import { PlayerOverlay, type PlayerVideo } from "@/components/video-player/player-overlay";

import { useStripPlayer } from "./store";

/**
 * The site's player for the trailer, opened from the grown frame or its play button. It draws
 * nothing until the store says it is open, grows out of the frame it came from (`getOrigin`) and tells
 * the store when it has closed. It is drawn on the page's body, above the home's layers, as the About
 * page's film is. The film is the collection's own file (`libUrl`), streamed by the player.
 */
export function StripPlayerHost({ video }: { video: PlayerVideo }) {
  const open = useStripPlayer((s) => s.open);
  const from = useStripPlayer((s) => s.from);
  const getOrigin = useCallback(
    () => (from ? new DOMRect(from.x, from.y, from.w, from.h) : null),
    [from],
  );
  const onClosed = useCallback(() => {
    useStripPlayer.getState().close();
  }, []);
  if (!open) return null;
  return createPortal(
    <PlayerOverlay video={video} getOrigin={getOrigin} onClosed={onClosed} />,
    document.body,
  );
}
