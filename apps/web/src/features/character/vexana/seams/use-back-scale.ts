"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect } from "react";

import { perfLevel } from "@/lib/perf";

import { easeInOut, put } from "./scroll-kit";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

/**
 * The pair of Human and Ender is held still while the interlude rises over it. Under the rising
 * panel the pair steps back a little (its foreground scales down about the middle), which is the
 * depth of the cover-up. The ground behind it (the pale gradient and the contour lines) is not
 * scaled: it stays full-bleed, so there is never a strip with a hard edge beside the scaled
 * picture, and the beams of colour keep matching what is beside the interlude's panel while the
 * panel is still narrower than the screen. Plain scale, driven by scroll alone.
 */
export function useBackScale(reduced: boolean) {
  useEffect(() => {
    if (reduced || perfLevel() === "lite") return;
    const cover = document.getElementById("cover");
    const stage = document.querySelector<HTMLElement>("#faces [data-depth]");
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
