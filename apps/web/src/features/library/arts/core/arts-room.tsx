"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

import type { ArtsRoom } from "./routes";

// One chunk per room. The loading list (`preload.ts` of each room) fetches the chunk first.
const ROOMS: Record<Exclude<ArtsRoom, "cosplay">, ComponentType> = {
  splash: dynamic(() => import("../splash/page")),
  scene: dynamic(() => import("../scene/page")),
  comic: dynamic(() => import("../comic/page")),
  game: dynamic(() => import("../game/page")),
  design: dynamic(() => import("../design/page")),
  others: dynamic(() => import("../others/page")),
  fanart: dynamic(() => import("../fanart/page")),
};

const COSPLAY = dynamic(() => import("../cosplay/page"));
const COSPLAY_CHARACTER: ComponentType<{ character: string }> = dynamic(
  () => import("../cosplay/character"),
);

/** Draws one room of Arts, the page of `/collection/arts` and `/collection/arts/<room>`. */
export function ArtsRoomView({ room }: { room: Exclude<ArtsRoom, "cosplay"> }) {
  const Room = ROOMS[room];
  return <Room />;
}

/** The Cosplay roster of the ten, and the page of one Aspirant when `character` is given. */
export function CosplayView({ character }: { character?: string }) {
  return character ? <COSPLAY_CHARACTER character={character} /> : <COSPLAY />;
}
