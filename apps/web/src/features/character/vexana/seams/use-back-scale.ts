"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect } from "react";

import { perfLevel } from "@/lib/perf";

import { easeInOut, put } from "./scroll-kit";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

/**
 * The pair of Academic and Ender is held still while the interlude rises over it. Under the rising
 * panel the held screen steps back a little (it scales down about its middle), which is the depth
 * of the cover-up. Plain scale, driven by scroll alone.
 */
export function useBackScale(reduced: boolean) {
  useEffect(() => {
    if (reduced || perfLevel() === "lite") return;
    const cover = document.getElementById("cover");
    const stage = document.querySelector<HTMLElement>("#faces > *");
    if (!cover || !stage) return;
    const st = ScrollTrigger.create({
      trigger: cover,
      start: "top bottom",
      end: "top top",
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        put(stage, "transform", `scale(${1 - 0.05 * easeInOut(self.progress)})`);
      },
    });
    return () => {
      st.kill();
      stage.style.removeProperty("transform");
    };
  }, [reduced]);
}
