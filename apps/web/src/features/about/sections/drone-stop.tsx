"use client";

import { useArrive } from "./arrive";
import styles from "./drone-stop.module.css";

/**
 * Where the drone stops. From here on the page does not need it: TheMLabel closes over the page
 * just below. So this is a place and nothing else: one thin circle on the paper, with the drone's
 * last anchor in the middle of it. No words.
 */
export function DroneStop() {
  const ref = useArrive<HTMLElement>("0px 0px -18% 0px");
  return (
    <section ref={ref} className={styles.stop} data-about-section="stop" data-in="false">
      <div className={styles.place} aria-hidden="true">
        <span className={styles.ring} />
        <span className={styles.halo} />
        <div className={styles.anchor} data-drone-anchor="stop" data-drone-face="happy" />
      </div>
    </section>
  );
}
