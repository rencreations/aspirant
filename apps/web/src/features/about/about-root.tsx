"use client";

import { useEffect, type ReactNode } from "react";

import { useFreshStart } from "@/features/character/vexana/seams/fresh-start";
import { BareScrollbar } from "@/features/character/vexana/shared/bare-scrollbar";
import { useNavLock } from "@/lib/nav-lock";

import styles from "./about.module.css";
import { resetAboutStage, useAboutStage } from "./stage-bus";

/**
 * The root of the About page. It carries the phase of the opening for the stylesheets
 * (`data-about-intro`), keeps the top bar bare (a canvas and a film are under it, so it takes no
 * blurred plate here), hides the browser's scrollbar (the film's player stops the scroll, and a
 * scrollbar that goes and comes back moves the page sideways) and starts a reload at the top.
 */
export function AboutRoot({ children }: { children: ReactNode }) {
  useFreshStart();
  const phase = useAboutStage((s) => s.phase);

  useEffect(() => {
    useNavLock.setState({ theme: "daybreak", bare: true, fade: false, away: false });
    return () => {
      useNavLock.setState({ theme: null, bare: false, fade: false, away: false });
      resetAboutStage();
    };
  }, []);

  return (
    <div className={styles.root} data-about="" data-about-intro={phase} data-theme="daybreak">
      <BareScrollbar />
      {children}
    </div>
  );
}
