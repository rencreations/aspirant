"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";

import styles from "./hold.module.css";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

interface HoldApi {
  /** The wrapper: its bottom edge is where the next section begins. */
  root: RefObject<HTMLDivElement | null>;
  /** Calls `fn` now and on every change of the hold's progress (0 to 1). Returns the unsubscribe. */
  subscribe: (fn: (p: number) => void) => () => void;
  /** Hides or shows the held section (the doors hide it once they have closed). */
  hideContent: (hide: boolean) => void;
}

const HoldContext = createContext<HoldApi | null>(null);

/** What an overlay of a hold reads: the wrapper, the progress and the hide switch. */
export function useHold(): HoldApi {
  const api = useContext(HoldContext);
  if (!api) throw new Error("useHold needs a <Hold>");
  return api;
}

/** Runs `fn` with the progress of the enclosing hold (0 before it, 1 after it). */
export function useHoldProgress(fn: (p: number) => void) {
  const { subscribe } = useHold();
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  useEffect(
    () =>
      subscribe((p) => {
        ref.current(p);
      }),
    [subscribe],
  );
}

interface HoldProps {
  /** Screens of scrolling the last screen of the section stays in place for. */
  hold: number;
  /** What is drawn over the held screen: the doors, the liquid. It reads `useHoldProgress`. */
  overlay?: ReactNode;
  /** False (reduced motion): the section is shown as it is, with no hold. */
  enabled?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/**
 * The last screen of a section stays put while the page scrolls `hold` more screens, and a
 * transition is drawn over it from that scroll alone (one ScrollTrigger, stateless, so scrolling
 * back plays it backwards). The section is not touched: the hold is made by the layout around it.
 * What follows the wrapper may overlap its spacer (a negative margin) to be revealed under it.
 */
export function Hold({ hold, overlay, enabled = true, className, style, children }: HoldProps) {
  const root = useRef<HTMLDivElement>(null);
  const stick = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const subs = useRef(new Set<(p: number) => void>());
  const progress = useRef(0);

  const api = useMemo<HoldApi>(
    () => ({
      root,
      subscribe(fn) {
        subs.current.add(fn);
        fn(progress.current);
        return () => {
          subs.current.delete(fn);
        };
      },
      hideContent(hide) {
        const el = stick.current;
        if (el) el.style.visibility = hide ? "hidden" : "";
      },
    }),
    [],
  );

  useEffect(() => {
    if (!enabled) return;
    const r = root.current;
    const s = stick.current;
    const t = track.current;
    if (!r || !s || !t) return;
    const emit = (p: number) => {
      progress.current = p;
      for (const fn of subs.current) fn(p);
    };
    const measure = () => {
      r.style.setProperty("--h", `${String(s.offsetHeight)}px`);
    };
    measure();
    let timer = 0;
    let height = s.offsetHeight;
    const ro = new ResizeObserver(() => {
      if (Math.abs(s.offsetHeight - height) < 1) return;
      height = s.offsetHeight;
      measure();
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        ScrollTrigger.refresh();
      }, 120);
    });
    ro.observe(s);
    const st = ScrollTrigger.create({
      trigger: t,
      start: "top top",
      end: "bottom bottom",
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        emit(self.progress);
      },
      onRefresh: (self) => {
        emit(self.progress);
      },
    });
    emit(st.progress);
    return () => {
      window.clearTimeout(timer);
      ro.disconnect();
      st.kill();
      s.style.visibility = "";
      emit(0);
    };
  }, [enabled]);

  if (!enabled) return <div className={className}>{children}</div>;

  return (
    <HoldContext.Provider value={api}>
      <div
        ref={root}
        className={[styles.root, className].filter(Boolean).join(" ")}
        style={{ ...style, ["--hold" as string]: hold }}
      >
        <div ref={stick} className={styles.stick}>
          {children}
        </div>
        <div className={styles.spacer} />
        <div ref={track} className={styles.track}>
          <div className={styles.stage}>{overlay}</div>
        </div>
      </div>
    </HoldContext.Provider>
  );
}
