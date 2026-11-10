"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

import type { VideoRoom } from "../types";

// One chunk per room. The loading list (`preload.ts` of each room) fetches the chunk first.
const ROOMS: Record<VideoRoom, ComponentType> = {
  films: dynamic(() => import("./films/page")),
  others: dynamic(() => import("./others/page")),
};

/** Draws one room of the Video collection. */
export function VideoRoomView({ room }: { room: VideoRoom }) {
  const Room = ROOMS[room];
  return <Room />;
}
