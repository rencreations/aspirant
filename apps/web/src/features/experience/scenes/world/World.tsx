"use client";

import { WorldContext, type WorldClock } from "./context";
import { Sky } from "./layers/Sky";
import type { Preset } from "./types";

/** One scene composition: the sky first, then the preset's layers, all procedural. */
export function World({ preset, clock }: { preset: Preset; clock: WorldClock }) {
  return (
    <WorldContext.Provider value={clock}>
      <Sky params={preset.sky} />
    </WorldContext.Provider>
  );
}
