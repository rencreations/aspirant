import type { ReactNode } from "react";

import styles from "./under.module.css";

/** Puts the next section under the transition in front of it. See under.module.css. */
export function Under({
  open,
  enabled = true,
  children,
}: {
  open: number;
  enabled?: boolean;
  children: ReactNode;
}) {
  if (!enabled) return <>{children}</>;
  return (
    <div className={styles.under} style={{ ["--open" as string]: open }}>
      <div className={styles.pin}>{children}</div>
      <div className={styles.spacer} />
    </div>
  );
}
