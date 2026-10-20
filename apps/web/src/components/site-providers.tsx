"use client";

import { useEffect, type ReactNode } from "react";

import { TooltipProvider } from "@aspirant/ui/components/tooltip";

import { SmoothScrollProvider } from "@/components/smooth-scroll";
import { SoundPrompt } from "@/components/sound-prompt";
import { TransitionProvider } from "@/components/transition/transition-provider";
import { audio } from "@/lib/audio";
import { useMediaQuery } from "@/lib/hooks";
import { perfLevel } from "@/lib/perf";
import { hydrateSiteStore, useSiteStore } from "@/lib/stores";

/** Keeps <html> attributes and the audio engine in sync with the store and the OS. */
function PreferencesSync() {
  const osReduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const finePointer = useMediaQuery("(hover: hover) and (pointer: fine)", true);
  const motion = useSiteStore((s) => s.motion);
  const theme = useSiteStore((s) => s.theme);
  const muted = useSiteStore((s) => s.muted);

  useEffect(() => {
    void hydrateSiteStore();
  }, []);

  // The performance level of this device (see lib/perf.ts) is decided now, and written on <html>.
  useEffect(() => {
    perfLevel();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.motion =
      osReduced || motion === "reduced" ? "reduced" : "auto";
  }, [osReduced, motion]);

  useEffect(() => {
    document.documentElement.dataset.pointer = finePointer ? "fine" : "coarse";
  }, [finePointer]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    audio.setMuted(muted);
  }, [muted]);

  return null;
}

/** Client providers for the root layout: preferences, smooth scroll, transitions, tooltips. */
export function SiteProviders({ children }: { children: ReactNode }) {
  return (
    <SmoothScrollProvider>
      <TransitionProvider>
        <TooltipProvider delayDuration={150}>
          <PreferencesSync />
          {children}
          <SoundPrompt />
        </TooltipProvider>
      </TransitionProvider>
    </SmoothScrollProvider>
  );
}
