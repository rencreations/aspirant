"use client";

import { useEffect } from "react";

import { setExitHook } from "../../kernel/handoff";

import { exitBridge } from "./exit-bridge";

/**
 * Says to the page change (`kernel/handoff.ts`) that the footer's drone has a way out to wait for.
 * It draws nothing. The change calls the hook before the page is covered; the footer's runtime, when it
 * is mounted, answers with a short dart of the drone off the screen, and when it is not the hook
 * resolves at once, so the page always changes.
 */
export function ExitHook() {
  useEffect(
    () =>
      setExitHook(() => {
        const run = exitBridge.run;
        return run ? run() : Promise.resolve();
      }),
    [],
  );
  return null;
}
