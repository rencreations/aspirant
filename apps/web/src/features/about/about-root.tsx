"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";

import { useLenis } from "@/components/smooth-scroll";
import { useFreshStart } from "@/features/character/vexana/seams/fresh-start";
import { BareScrollbar } from "@/features/character/vexana/shared/bare-scrollbar";
import { REVEAL_EVENT } from "@/lib/hooks";
import { useNavLock } from "@/lib/nav-lock";
import { aboutPlaceOf, type AboutPlace } from "@/lib/return-to";

import styles from "./about.module.css";
import { layoutTop, placeLead, placeScroll, placeSelector, withoutPlace } from "./return-place";
import { resetAboutStage, useAboutStage } from "./stage-bus";

/** What a visitor does to move the page by hand. From then on the page is theirs. */
const HANDS = ["wheel", "touchstart", "keydown", "pointerdown"] as const;

/**
 * A visitor who comes back from a page this one sent them to (`/about?at=phase-4`, see
 * `lib/return-to.ts`) finds the page where they left it: it is scrolled to that place before it is
 * shown, and the opening does not play (the director skips it on a page that is not at its top).
 *
 * The place is put right three times, because three things move the page before the visitor sees
 * it. At the mount, so the loading screen opens on it. When the page transition says it is about to
 * open the page (`REVEAL_EVENT`): it has just put the scroll back at the top. And while the page
 * above the place still changes its height (pictures, faces), until the visitor moves the page by
 * hand. `at` is then taken out of the address, so a reload starts at the top like any other.
 */
function useReturnPlace(root: RefObject<HTMLElement | null>): void {
  const { scrollTo } = useLenis();
  // Read once and kept: the address loses `at` a frame after the mount, and the effect runs twice
  // in development.
  const asked = useRef<AboutPlace | null | undefined>(undefined);

  useLayoutEffect(() => {
    asked.current ??= aboutPlaceOf(window.location.search);
    const place = asked.current;
    const el = place ? root.current?.querySelector<HTMLElement>(placeSelector(place)) : null;
    if (!place || !el) return;

    const jump = () => {
      const navH =
        document.querySelector("header[data-overlay='nav']")?.getBoundingClientRect().height ?? 64;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const y = placeScroll(layoutTop(el), placeLead(place, navH), max);
      if (Math.abs(window.scrollY - y) < 1) return;
      // Both, as the page transition does: the smooth scroll may be stopped, or not there yet.
      scrollTo(y, { immediate: true });
      window.scrollTo(0, y);
    };

    jump();
    const frame = requestAnimationFrame(() => {
      jump();
      if (new URLSearchParams(window.location.search).has("at")) {
        window.history.replaceState(window.history.state, "", withoutPlace(window.location.href));
      }
    });

    // The page above the place may still grow: hold the place until the visitor takes the page.
    const held = new ResizeObserver(jump);
    held.observe(root.current ?? el);
    const release = () => {
      held.disconnect();
      for (const type of HANDS) window.removeEventListener(type, release);
    };
    for (const type of HANDS) window.addEventListener(type, release, { passive: true });

    window.addEventListener(REVEAL_EVENT, jump, { once: true });
    return () => {
      cancelAnimationFrame(frame);
      release();
      window.removeEventListener(REVEAL_EVENT, jump);
    };
  }, [root, scrollTo]);
}

/**
 * The root of the About page. It carries the phase of the opening for the stylesheets
 * (`data-about-intro`), keeps the top bar bare (a canvas and a film are under it, so it takes no
 * blurred plate here), hides the browser's scrollbar (the film's player stops the scroll, and a
 * scrollbar that goes and comes back moves the page sideways), starts a reload at the top and
 * opens at the place a returning visitor left (`useReturnPlace`).
 */
export function AboutRoot({ children }: { children: ReactNode }) {
  useFreshStart();
  const root = useRef<HTMLDivElement>(null);
  useReturnPlace(root);
  const phase = useAboutStage((s) => s.phase);

  useEffect(() => {
    useNavLock.setState({ theme: "daybreak", bare: true, fade: false, away: false });
    return () => {
      useNavLock.setState({ theme: null, bare: false, fade: false, away: false });
      resetAboutStage();
    };
  }, []);

  return (
    <div
      ref={root}
      className={styles.root}
      data-about=""
      data-about-intro={phase}
      data-theme="daybreak"
    >
      <BareScrollbar />
      {children}
    </div>
  );
}
