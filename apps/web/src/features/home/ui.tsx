import type { Route } from "next";
import type { ReactNode } from "react";

import { TLink } from "@/components/transition/t-link";

import styles from "./home.module.css";

/** A pill button that is a real link. The look of the site's buttons (see the About page). */
export function Pill({
  href,
  children,
  label,
}: {
  href: Route;
  children: ReactNode;
  /** The destination's name in the page change's loading state. */
  label?: string;
}) {
  return (
    <TLink href={href} className={styles.pill} transitionLabel={label}>
      {children}
    </TLink>
  );
}
