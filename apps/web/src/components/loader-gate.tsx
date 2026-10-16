"use client";

import { Component, lazy, Suspense, useCallback, useEffect, type ReactNode } from "react";

import { StarGlyph } from "@/components/star-glyph";
import { useTransitionRouter } from "@/components/transition/transition-provider";
import { audio } from "@/lib/audio";
import { useMounted } from "@/lib/hooks";
import { readEntered, useSiteStore } from "@/lib/stores";

const Loader = lazy(() => import("@/features/loader/Loader"));

declare global {
  interface Window {
    /** Set when the gate mounts, so the boot script's failsafe leaves the cover alone. */
    __aspirantsGate?: boolean;
  }
}

/** Element id of the wrapper around nav, HUD and <main>. It is made inert while gated. */
export const SHELL_ID = "site-shell";

class GateBoundary extends Component<{ onError: () => void; children: ReactNode }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch() {
    this.props.onError();
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

function GatePending({ onSkip }: { onSkip: () => void }) {
  return (
    <div className="fixed inset-0 z-(--z-gate) grid place-items-center bg-ink text-ceramic">
      <StarGlyph className="size-10 animate-pulse text-[var(--light-gold)]" />
      <button
        type="button"
        onClick={onSkip}
        className="absolute top-4 right-4 min-h-11 px-4 mono text-xs tracking-[0.2em] text-[#cfd9e8] uppercase"
      >
        Skip
      </button>
    </div>
  );
}

/**
 * Shows the loader (from @/features/loader, loaded on demand) once per browser session.
 * The server always renders the full site underneath, so crawlers and no-JS visitors get the
 * content; a boot script paints a cover first (html[data-gate="on"]) to avoid a flash.
 * Entering unlocks audio inside the click, then the hexagon iris opens onto the page.
 */
export function LoaderGate({ preload }: { preload?: readonly string[] }) {
  const mounted = useMounted();
  const entered = useSiteStore((s) => s.entered);
  const setEntered = useSiteStore((s) => s.setEntered);
  const { reveal } = useTransitionRouter();
  // Client only: the server and the first client render never show the gate.
  const show = mounted && !entered && !readEntered();

  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    if (show) {
      window.__aspirantsGate = true;
      root.dataset.gate = "on";
    } else {
      delete root.dataset.gate;
    }
    const shell = document.getElementById(SHELL_ID);
    if (shell) shell.inert = show;
  }, [mounted, show]);

  const open = useCallback(
    (tone: "light" | "dark") => {
      void reveal({ tone });
      setEntered(true);
      delete document.documentElement.dataset.gate;
      requestAnimationFrame(() => document.getElementById("main")?.focus({ preventScroll: true }));
    },
    [reveal, setEntered],
  );

  const activate = useCallback(() => {
    audio.unlock();
    audio.blip("star");
  }, []);

  if (!show) return null;

  return (
    <GateBoundary onError={() => open("dark")}>
      <Suspense
        fallback={
          <GatePending
            onSkip={() => {
              activate();
              open("dark");
            }}
          />
        }
      >
        <Loader onActivate={activate} onEnter={() => open("light")} preload={preload} />
      </Suspense>
    </GateBoundary>
  );
}
