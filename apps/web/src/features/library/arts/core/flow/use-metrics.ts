"use client";

import { useRef, useState, type RefObject } from "react";

import { useIsoLayoutEffect } from "@/lib/hooks";

import { metricsFor, needsRebuild, type FlowMetrics } from "./math";

/**
 * The size the rows are planned for: the width of the wall's box. The plan is made again when the
 * width changes (a window dragged to a new size is measured when it rests), and never for a change
 * of height.
 */
export function useFlowMetrics(boxRef: RefObject<HTMLElement | null>): FlowMetrics | null {
  const [metrics, setMetrics] = useState<FlowMetrics | null>(null);
  const built = useRef<FlowMetrics | null>(null);

  useIsoLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    let timer = 0;
    const measure = () => {
      const vw = box.clientWidth;
      if (vw <= 0) return;
      if (needsRebuild(built.current, vw)) {
        built.current = metricsFor(vw);
        setMetrics(built.current);
      }
    };
    // The first measure is at once; a window being dragged is measured when it rests.
    const later = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(measure, 150);
    };
    measure();
    const observer = new ResizeObserver(later);
    observer.observe(box);
    window.addEventListener("resize", later, { passive: true });
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener("resize", later);
    };
  }, [boxRef]);

  return metrics;
}
