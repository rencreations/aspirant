"use client";

import { ArrowRightIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSyncExternalStore } from "react";

import { Button } from "@aspirant/ui/components/button";

import { siteConfig } from "@/lib/site";
import { useUiStore } from "@/stores/ui-store";

const HeroScene = dynamic(() => import("@/components/hero-scene"), {
  ssr: false,
  loading: () => null,
});

function detectWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

const subscribe = () => () => undefined;

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};
const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } },
};

export function Hero() {
  const reduceMotion = useReducedMotion();
  const reducedEffects = useUiStore((s) => s.reducedEffects);
  // false on the server and during hydration, then the real capability on the client.
  const hasWebGL = useSyncExternalStore(subscribe, detectWebGL, () => false);
  const animate = !reduceMotion && !reducedEffects;

  return (
    <section className="relative isolate overflow-hidden border-b">
      <div className="absolute inset-0 -z-10 opacity-90" data-testid="hero-canvas">
        {hasWebGL && <HeroScene animate={animate} />}
      </div>
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background/0 via-background/30 to-background" />

      <motion.div
        variants={container}
        initial={animate ? "hidden" : "show"}
        animate="show"
        className="mx-auto flex min-h-[78vh] max-w-6xl flex-col items-start justify-center gap-6 px-6 py-24"
      >
        <motion.p
          variants={item}
          className="rounded-full border bg-background/60 px-3 py-1 font-mono text-xs backdrop-blur"
        >
          v0.1 · static · container-ready
        </motion.p>
        <motion.h1
          variants={item}
          className="max-w-3xl text-5xl font-semibold tracking-tight text-balance sm:text-7xl"
        >
          {siteConfig.tagline}
        </motion.h1>
        <motion.p variants={item} className="max-w-xl text-lg text-pretty text-muted-foreground">
          {siteConfig.description}
        </motion.p>
        <motion.div variants={item} className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/ui">
              Explore the UI kit <ArrowRightIcon />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/data">Open the Data lab</Link>
          </Button>
        </motion.div>
      </motion.div>
    </section>
  );
}
