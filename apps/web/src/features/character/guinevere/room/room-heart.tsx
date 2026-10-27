"use client";

import gsap from "gsap";
import { useEffect, useRef } from "react";

import { useLenis } from "@/components/smooth-scroll";

import { toneHint } from "../../vexana/seams/gates";
import { useHold, useHoldProgress } from "../../vexana/seams/hold";
import { seg } from "../../vexana/seams/scroll-kit";
import { useScrollSnap } from "../../vexana/seams/snap";
import { HeartHole, type HeartHoleApi } from "./heart-hole";
import { roomBack } from "./room-back";
import { loadRoomMedia, roomMediaReady } from "./room-load";
import styles from "./room-heart.module.css";

/** The share of the hold where the heart starts to close and where it has shut. */
const FROM = 0.08;
const SHUT = 0.96;

/** Above the sections that follow, below the nav, while the cover is up. */
const Z_ABOVE = "44";

/** Waits until the room has started (its stage has left "boot"), at most `max` ms. */
function roomBegun(max = 15_000): Promise<void> {
  return new Promise((resolve) => {
    const begun = () => {
      const el = document.querySelector<HTMLElement>("[data-guinevere-room] [data-mode]");
      return !!el && el.dataset.mode !== "boot";
    };
    if (begun()) {
      resolve();
      return;
    }
    let timer = 0;
    const mo = new MutationObserver(() => {
      if (!begun()) return;
      mo.disconnect();
      window.clearTimeout(timer);
      resolve();
    });
    mo.observe(document.body, { attributes: true, subtree: true, attributeFilter: ["data-mode"] });
    timer = window.setTimeout(() => {
      mo.disconnect();
      resolve();
    }, max);
  });
}

/**
 * Her best friend to the room. The last screen of her section is held. Over it a layer of warm ink with a
 * heart cut out of it closes in from all the sides, following the scroll, and the stretch it closes
 * over can never be left half way (`useScrollSnap`). When the cover has shut, the page waits (with
 * a thin line that fills with the real progress of the download) until the room's first videos are
 * in memory, jumps to the room while the screen is covered, and waits for the room to begin its
 * welcome; then the ink fades away on it, so the room is seen from its first frame.
 *
 * The visitor who scrolls back up out of the room is never trapped: the cover does not come back
 * until they have gone up past the start of the stretch. The Back button of the room
 * (`roomBack.go`) plays the same heart the other way: it closes on the room, the page goes to her
 * last screen under the cover, and the heart opens on it.
 */
export function RoomHeart() {
  const hole = useRef<HeartHoleApi>(null);
  const loader = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLSpanElement>(null);
  const { root, range } = useHold();
  const { scrollTo, pause, resume } = useLenis();
  const api = useRef({ scrollTo, pause, resume });
  const rangeRef = useRef(range);
  const corner = useRef(0.5);
  const st = useRef({ engaged: false, busy: false, prev: null as number | null });

  useEffect(() => {
    api.current = { scrollTo, pause, resume };
    rangeRef.current = range;
  });

  // The room's first screen is fetched early (it is large), so the way in rarely waits.
  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          void loadRoomMedia(() => undefined);
          io.disconnect();
        }
      },
      { rootMargin: "200% 0px 200% 0px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
    };
  }, [root]);

  useEffect(() => {
    const measure = () => {
      corner.current = hole.current?.cornerAt() ?? 0.5;
    };
    measure();
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
    };
  }, []);

  /** What the effect below builds: the way in and the way back. Written there, read below. */
  const engine = useRef({
    engage: () => {
      /* set by the effect */
    },
    back: () => {
      /* set by the effect */
    },
  });

  useEffect(() => {
    const s = st.current;
    const r = root.current;

    /** The cover is done: put everything back. */
    const release = () => {
      hole.current?.set(0);
      const layer = hole.current?.el();
      if (layer) gsap.set(layer, { opacity: 1 });
      gsap.set(loader.current, { opacity: 0 });
      if (r) r.style.zIndex = "";
      toneHint.set(null);
      api.current.resume();
      s.busy = false;
    };

    const lift = () => {
      if (r) r.style.zIndex = Z_ABOVE;
    };

    /** Closed on the screen: go into the room. */
    const engage = async () => {
      if (s.busy) return;
      s.busy = true;
      lift();
      api.current.pause();
      hole.current?.set(1);
      toneHint.set("dark");
      if (!roomMediaReady()) {
        gsap.to(loader.current, { opacity: 1, duration: 0.25 });
        await loadRoomMedia((loaded, total) => {
          gsap.to(fill.current, {
            scaleX: total > 0 ? Math.min(1, loaded / total) : 1,
            duration: 0.2,
            overwrite: true,
          });
        }).catch(() => undefined);
        gsap.to(loader.current, { opacity: 0, duration: 0.2 });
      }
      const room = document.getElementById("room");
      if (room) {
        api.current.scrollTo(room.getBoundingClientRect().top + window.scrollY, {
          immediate: true,
        });
      }
      s.engaged = true;
      s.prev = 1;
      await roomBegun();
      const layer = hole.current?.el();
      gsap.to(layer ?? null, {
        opacity: 0,
        duration: 0.8,
        ease: "power2.out",
        onComplete: release,
      });
    };

    /** The Back button of the room: the heart closes on it, the page goes up, the heart opens. */
    const back = () => {
      if (s.busy) return;
      s.busy = true;
      lift();
      api.current.pause();
      const v = { p: 0 };
      const draw = () => {
        hole.current?.set(v.p);
        toneHint.set(v.p >= corner.current ? "dark" : null);
      };
      gsap.to(v, {
        p: 1,
        duration: 0.75,
        ease: "power2.inOut",
        onUpdate: draw,
        onComplete: () => {
          const span = rangeRef.current();
          const friend = document.getElementById("friend");
          const target =
            span?.start ??
            (friend
              ? friend.getBoundingClientRect().bottom + window.scrollY - window.innerHeight
              : 0);
          api.current.scrollTo(target, { immediate: true });
          s.engaged = false;
          s.prev = 0;
          gsap.to(v, {
            p: 0,
            duration: 0.85,
            delay: 0.1,
            ease: "power2.inOut",
            onUpdate: draw,
            onComplete: release,
          });
        },
      });
    };

    engine.current = {
      engage: () => {
        void engage();
      },
      back,
    };
    const go = () => {
      engine.current.back();
    };
    const before = roomBack.go;
    roomBack.go = go;
    return () => {
      if (roomBack.go === go) roomBack.go = before;
      if (r) r.style.zIndex = "";
      toneHint.set(null);
    };
  }, [root]);

  useHoldProgress((p) => {
    const s = st.current;
    const q = seg(p, FROM, SHUT);
    if (s.busy) return;
    if (s.prev === null) {
      // The first reading: a reload below the stretch is "already in the room", not a transition.
      s.prev = q;
      s.engaged = q >= 1;
      if (!s.engaged) hole.current?.set(q);
      return;
    }
    const was = s.prev;
    s.prev = q;
    if (s.engaged) {
      // Scrolled back up past the start of the stretch: the heart is armed again.
      if (p <= 0.0005) s.engaged = false;
      return;
    }
    hole.current?.set(q);
    toneHint.set(q > 0 && q >= corner.current ? "dark" : null);
    if (was < 1 && q >= 1) engine.current.engage();
  });

  // Never left half way: from half on the heart shuts (and the room opens), before it the heart opens.
  useScrollSnap("friend-room", () => {
    const s = st.current;
    const r = range();
    if (!r || s.busy || s.engaged) return null;
    const at = (p: number) => r.start + (r.end - r.start) * p;
    return { start: at(FROM), end: at(SHUT) };
  });

  return (
    <div className={styles.layer}>
      <HeartHole ref={hole} />
      <div ref={loader} className={styles.loader} role="status">
        <span className={styles.text}>Loading her room</span>
        <span className={styles.track}>
          <span ref={fill} className={styles.fill} />
        </span>
      </div>
    </div>
  );
}
