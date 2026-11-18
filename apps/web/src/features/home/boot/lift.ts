/**
 * While the home's opening runs, the stage's canvas must be seen above the loading screen
 * (`components/home-boot/`, at z 90 with its own ground), but the stage lives inside `<main>`, which
 * stacks at z 1. So for the length of the opening `<main>` is lifted above the loading screen and
 * made click through, and the canvas host is shown (the rest of the stage's layers stay hidden by
 * the page's own `data-open` rule, so only what the canvas draws shows). Everything is an inline
 * style on `<main>` and on the host, set once and removed once: nothing per frame, nothing on
 * `<html>` or `<body>`. The loading screen asks for it to be given back when it unmounts, so the
 * canvas never goes behind the ground for a frame.
 */

/** Above the loading screen (90), below the lantern cursor (95) and the cover (100). */
const LIFTED_Z = "91";

let lifted: { main: HTMLElement; host: HTMLElement | null } | null = null;

/** Lift the stage above the loading screen. `host` is the canvas host of the home. */
export function liftStage(host: HTMLElement | null): void {
  if (lifted || typeof document === "undefined") return;
  const main = document.getElementById("main");
  if (!main) return;
  lifted = { main, host };
  main.style.zIndex = LIFTED_Z;
  main.style.pointerEvents = "none";
  if (host) host.style.visibility = "visible";
}

/** Give the stage back to the page. Safe to call twice. */
export function dropStage(): void {
  if (!lifted) return;
  const { main, host } = lifted;
  lifted = null;
  main.style.removeProperty("z-index");
  main.style.removeProperty("pointer-events");
  if (host) host.style.removeProperty("visibility");
}

/** Is the stage lifted now (for the probes and the tests). */
export function isStageLifted(): boolean {
  return lifted !== null;
}
