import type { ReactNode } from "react";

import styles from "./under.module.css";

/** Puts the next section under the transition in front of it. See under.module.css. */
export function Under({ open, children }: { open: number; children: ReactNode }) {
  return (
    <div className={styles.under} style={{ ["--open" as string]: open }}>
      <div className={styles.pin}>{children}</div>
      <div className={styles.spacer} />
    </div>
  );
}
