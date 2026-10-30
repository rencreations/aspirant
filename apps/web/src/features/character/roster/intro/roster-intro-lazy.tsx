"use client";

import dynamic from "next/dynamic";

/**
 * The intro of `/character`, loaded on its own so no other page carries it. The same chunk is
 * warmed by the loading list (`preload-items.ts`).
 */
const RosterIntro = dynamic(() => import("./roster-intro"), { ssr: false });

export function RosterIntroMount() {
  return <RosterIntro />;
}
