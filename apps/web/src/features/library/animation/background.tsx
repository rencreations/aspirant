"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";

import { slatsLook, type FieldColors } from "./colors";
import type { RingGeometry } from "./ring";
import styles from "./shell.module.css";
import { SlatsEngine, type SlatsSnapshot } from "./slats/engine";
import own from "./slats/slats.module.css";

interface Props {
  /** The colour field of each character, in the order of the ring. */
  fields: ReadonlyArray<FieldColors & { slug: string }>;
  /** The character whose field shows. */
  active: number;
  /** The ring (kept for the shell; the slats measure the screen themselves). */
  geometry: RingGeometry | null;
}

declare global {
  interface Window {
    /** Frame sheets and specs: the look in front and the cost of the field. */
    __slats?: {
      snapshot: () => SlatsSnapshot | null;
      /** Hold a change of character `ms` after it began, or null to let it run. */
      holdWash: (ms: number | null) => void;
    };
  }
}

/**
 * The field behind the ring: a sea of slats (React Bits' MicroSlats, ported in `slats/`) in the
 * colours of the character in front. The cursor or a finger stirs it and a press throws a splash.
 * A new character rolls her colours in from the horizon. The field rests while the room's full
 * screen view covers it, and while the tab is hidden. Without WebGL 2 it is her plain colour field.
 */
export const Background = memo(function Background({ fields, active }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<SlatsEngine | null>(null);
  const [plain, setPlain] = useState(false);
  // A new canvas after the GPU dropped the old one.
  const [epoch, setEpoch] = useState(0);
  const looks = useMemo(() => fields.map((f) => slatsLook(f.slug, f)), [fields]);
  const looksRef = useRef(looks);
  const activeRef = useRef(active);
  useEffect(() => {
    looksRef.current = looks;
    activeRef.current = active;
  }, [looks, active]);

  useEffect(() => {
    const el = host.current;
    const first = looksRef.current[activeRef.current];
    if (!el || !first) return;
    const field = SlatsEngine.create(el, first, () => {
      setEpoch((n) => n + 1);
    });
    if (!field) {
      setPlain(true);
      return;
    }
    engine.current = field;
    window.__slats = {
      snapshot: () => engine.current?.snapshot() ?? null,
      holdWash: (ms) => engine.current?.holdWash(ms),
    };

    // While the room hides the field (its full screen view covers it), it draws nothing. Read when
    // the room changes its view, never per frame.
    const room = el.closest<HTMLElement>("[data-animation-room]");
    const follow = () => {
      field.setActive(getComputedStyle(el).visibility !== "hidden");
    };
    follow();
    const watch = new MutationObserver(follow);
    if (room) watch.observe(room, { attributes: true, attributeFilter: ["data-view"] });
    return () => {
      watch.disconnect();
      field.destroy();
      if (engine.current === field) engine.current = null;
    };
  }, [epoch]);

  useEffect(() => {
    const look = looks[active];
    if (look) engine.current?.setLook(look);
  }, [looks, active]);

  return (
    <div className={styles.field} aria-hidden="true">
      <div ref={host} className={own.host} data-slats="">
        {plain
          ? fields.map((f, i) => (
              <i
                key={f.slug}
                className={own.plain}
                data-on={i === active}
                style={{ background: `linear-gradient(160deg, ${f.main} 18%, ${f.deep} 100%)` }}
              />
            ))
          : null}
      </div>
    </div>
  );
});
