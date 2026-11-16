"use client";

import { useMemo } from "react";

import { PlayerOverlay, type PlayerVideo } from "@/components/video-player/player-overlay";
import { useCaptionsBlob } from "@/features/library/video/others/use-captions-blob";

interface PhasePlayerProps {
  video: PlayerVideo;
  getOrigin: () => DOMRect | null;
  onClosed: () => void;
}

/**
 * The site's player for a video of the collection opened from this page. A film of the collection
 * lives on another origin, and a browser refuses a caption track from another origin in a plain
 * `<video>`: so the captions are fetched here and handed to the player as an address of this page
 * (`useCaptionsBlob`, the collection's own way). The film starts at once and its captions join it
 * a moment later.
 */
export function PhasePlayer({ video, getOrigin, onClosed }: PhasePlayerProps) {
  const captions = useCaptionsBlob(video.captions);
  const playable = useMemo<PlayerVideo>(() => {
    const { captions: _own, ...rest } = video;
    return captions ? { ...rest, captions } : rest;
  }, [video, captions]);
  return <PlayerOverlay video={playable} getOrigin={getOrigin} onClosed={onClosed} />;
}
