import type { ReactNode } from "react";

import { AnimationShell } from "@/features/library/animation/shell";

/**
 * The Animation room and the full screen view of each character share this layout: the carousel
 * and its live panel are drawn here, so they stay alive when the address changes between the two.
 */
export default function AnimationLayout({ children }: { children: ReactNode }) {
  return <AnimationShell>{children}</AnimationShell>;
}
