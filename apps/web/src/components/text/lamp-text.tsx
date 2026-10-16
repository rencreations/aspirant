"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";

import { useReducedMotion } from "@/lib/hooks";

import styles from "./text-effects.module.css";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger, useGSAP);

export interface LampTextProps {
  /** The text. Words light up one after another as the block scrolls through. */
  text: string;
  /** Element to render. Default "p". */
  as?: keyof HTMLElementTagNameMap;
  className?: string;
  /** ScrollTrigger start. Default "top 80%". */
  start?: string;
  /** ScrollTrigger end. Default "bottom 45%". */
  end?: string;
}

const DIM = 0.18;

/**
 * Words light up as the section scrolls, like a lamp moving over the text (ScrollTrigger
 * scrub). The word under the lamp gets a soft glow. Fully lit and static under reduced
 * motion, and in the server HTML. Screen readers read the text once, normally.
 *
 * <LampText as="p" className="serif text-step-4" text="Aspirant is a story about ..." />
 */
export function LampText({
  text,
  as,
  className,
  start = "top 80%",
  end = "bottom 45%",
}: LampTextProps) {
  // Typed as a single intrinsic tag (HTMLElement props): an ElementType union breaks once
  // @react-three/fiber augments JSX.IntrinsicElements.
  const Tag = (as ?? "p") as "span";
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();

  // useGSAP reverts the tween and its ScrollTrigger on unmount and when a dependency changes
  // (including the in-app reduce motion toggle).
  useGSAP(
    () => {
      const root = ref.current;
      if (!root || reduced) return;
      const words = Array.from(root.querySelectorAll<HTMLElement>("[data-word]"));
      if (!words.length) return;
      let current = -1;
      const mark = (index: number) => {
        if (index === current) return;
        if (current >= 0) words[current]?.removeAttribute("data-current");
        current = index;
        if (index >= 0) words[index]?.setAttribute("data-current", "true");
      };
      const tween = gsap.fromTo(
        words,
        { opacity: DIM },
        {
          opacity: 1,
          ease: "none",
          stagger: 1,
          scrollTrigger: {
            trigger: root,
            start,
            end,
            scrub: 0.6,
            onUpdate: (self) => {
              const p = self.progress;
              mark(
                p <= 0 || p >= 1 ? -1 : Math.min(words.length - 1, Math.floor(p * words.length)),
              );
            },
            onLeave: () => mark(-1),
            onLeaveBack: () => mark(-1),
          },
        },
      );
      return () => {
        tween.scrollTrigger?.kill();
        tween.kill();
        mark(-1);
        gsap.set(words, { clearProps: "opacity" });
      };
    },
    { dependencies: [text, start, end, reduced], scope: ref },
  );

  const parts = text.split(/(\s+)/);

  return (
    <Tag ref={ref} className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {parts.map((part, i) =>
          /^\s*$/.test(part) ? (
            part
          ) : (
            <span key={i} data-word="" className={styles.lampWord}>
              {part}
            </span>
          ),
        )}
      </span>
    </Tag>
  );
}
