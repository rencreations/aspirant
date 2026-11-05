"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import { ThemeZone } from "@/components/theme-zone";
import { useGLReady } from "@/components/gl/use-gl-ready";

import { ContinueHome } from "./continue-home";
import { ShelfFallback } from "./shelf-fallback";
import styles from "./shelf.module.css";

// The scene is its own chunk. The loading list (`preload.ts`) fetches the same chunk first.
const ShelfScene = dynamic(() => import("./shelf-scene"), { ssr: false });

/**
 * The landing of `/collection`. The ten links are always in the page (crawlers, no JavaScript,
 * no WebGL); with WebGL the scene covers them and the list is taken out of reach (`inert`), because
 * the scene's own index row is the keyboard path.
 */
export function ShelfPage() {
  const { supported } = useGLReady();
  const [failed, setFailed] = useState(false);
  const live = supported === true && !failed;
  const state = supported === null ? "pending" : live ? "live" : "plain";

  return (
    <ThemeZone theme="daybreak" as="div" className={styles.root} data-shelf={state}>
      <div className={styles.fallback} inert={live}>
        <ShelfFallback heading={!live} />
      </div>
      <ContinueHome />
      {live ? (
        <ShelfScene
          onFail={() => {
            setFailed(true);
          }}
        />
      ) : null}
    </ThemeZone>
  );
}
