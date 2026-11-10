"use client";

import { CHARACTER_NAMES } from "@/lib/slugs";

import { ORDER } from "./characters";

/**
 * The page of `/collection/animation`. The carousel itself is drawn by the room's layout
 * (`AnimationShell`), which stays alive when a panel opens full screen. The page holds what the
 * address is about, for assistive technology: its heading and one plain sentence.
 */
export default function AnimationPage() {
  return (
    <>
      <h1 className="sr-only">Animation</h1>
      <p className="sr-only">
        The in-game animation of the ten Aspirants on a turning ring:{" "}
        {ORDER.map((s) => CHARACTER_NAMES[s]).join(", ")}. Each one opens full screen with Launch.
      </p>
    </>
  );
}
