"use client";

import { useThree } from "@react-three/fiber";
import { useLayoutEffect, type ReactNode } from "react";
import { Fog } from "three";

import { col, WorldContext, type WorldClock } from "./context";
import {
  Citadel,
  Corridor,
  Giant,
  Hall,
  Memories,
  Ribbons,
  Ship,
  Terrain,
  Tree,
} from "./layers/architecture";
import { City } from "./layers/City";
import { Dome } from "./layers/Dome";
import { Lattice } from "./layers/Lattice";
import { Lights } from "./layers/Lights";
import { Particles } from "./layers/Particles";
import { Sky } from "./layers/Sky";
import { Board, Orb, Portal, Ticks } from "./layers/stage";
import type { Preset, ShapeParams } from "./types";

function Shape({ p }: { p: ShapeParams }): ReactNode {
  switch (p.kind) {
    case "board":
      return <Board p={p} />;
    case "portal":
      return <Portal p={p} />;
    case "ticks":
      return <Ticks p={p} />;
    case "orb":
      return <Orb p={p} />;
    case "corridor":
      return <Corridor p={p} />;
    case "hall":
      return <Hall p={p} />;
    case "citadel":
      return <Citadel p={p} />;
    case "terrain":
      return <Terrain p={p} />;
    case "tree":
      return <Tree p={p} />;
    case "ship":
      return <Ship p={p} />;
    case "giant":
      return <Giant p={p} />;
    case "ribbons":
      return <Ribbons p={p} />;
    case "memories":
      return <Memories p={p} />;
  }
}

function SceneFog({ fog }: { fog: Preset["fog"] }) {
  const scene = useThree((s) => s.scene);
  useLayoutEffect(() => {
    scene.fog = fog ? new Fog(col(fog.color).clone(), fog.near, fog.far) : null;
    // Materials compiled before the fog existed need a rebuild to pick it up.
    scene.traverse((o) => {
      const m = (o as { material?: { needsUpdate: boolean } }).material;
      if (m) m.needsUpdate = true;
    });
    return () => {
      scene.fog = null;
    };
  }, [scene, fog]);
  return null;
}

/** One scene composition: the sky first, then the preset's layers, all procedural. */
export function World({ preset, clock }: { preset: Preset; clock: WorldClock }) {
  return (
    <WorldContext.Provider value={clock}>
      <SceneFog fog={preset.fog} />
      <Sky params={preset.sky} />
      {preset.dome ? <Dome params={preset.dome} /> : null}
      {preset.city ? <City params={preset.city} /> : null}
      {preset.shapes?.map((s, i) => (
        <Shape key={`${s.kind}-${i}`} p={s} />
      ))}
      {preset.lattice?.map((l, i) => (
        <Lattice key={`${l.mode}-${i}`} params={l} />
      ))}
      {preset.lights ? <Lights params={preset.lights} /> : null}
      {preset.particles?.map((pp, i) => (
        <Particles key={`${pp.mode}-${i}`} params={pp} />
      ))}
    </WorldContext.Provider>
  );
}
