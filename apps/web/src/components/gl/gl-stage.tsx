"use client";

import { Canvas, type CanvasProps } from "@react-three/fiber";
import {
  Component,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { cn } from "@aspirant/ui/lib/utils";

import { usePageVisible } from "@/lib/hooks";

import { hasWebGL } from "./use-gl-ready";

/** @public */
export interface GLStageProps {
  /** The R3F scene. */
  children: ReactNode;
  /** Rendered instead of the canvas when WebGL is missing or the scene throws. */
  fallback?: ReactNode;
  /** Classes for the wrapper (it fills its parent by default). */
  className?: string;
  /** R3F camera props, for example `{ position: [0, 0, 5], fov: 40 }`. */
  camera?: CanvasProps["camera"];
  /** Maximum device pixel ratio. Capped at 1.75 whatever you pass. Default 1.75. */
  dpr?: number;
  /** Element that receives pointer events (for scenes under other content). */
  eventSource?: CanvasProps["eventSource"];
  /** Accessible label for the canvas. Omit for decorative scenes (then aria-hidden). */
  label?: string;
}

const noopSubscribe = () => () => undefined;

class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: unknown) {
    console.error("GLStage scene failed, showing the fallback.", error);
  }
  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * R3F <Canvas> with the site's rules built in: DPR capped at 1.75, transparent background,
 * rendering paused while off screen or while the tab is hidden, and a fallback when WebGL is
 * missing or the scene crashes. Load it lazily:
 *
 * const GLStage = dynamic(() => import("@/components/gl/gl-stage"), { ssr: false });
 * <GLStage fallback={<img ... />}><MyScene /></GLStage>
 */
function GLStage({
  children,
  fallback = null,
  className,
  camera,
  dpr = 1.75,
  eventSource,
  label,
}: GLStageProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  // False on the server and during hydration, then the real check (no mismatch).
  const supported = useSyncExternalStore(noopSubscribe, hasWebGL, () => false);
  const visible = usePageVisible();

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => setInView(entries[entries.length - 1]?.isIntersecting ?? false),
      { rootMargin: "100px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const maxDpr = Math.min(dpr, 1.75);

  return (
    <div
      ref={wrapRef}
      className={cn("relative h-full w-full", className)}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {supported ? (
        <SceneBoundary fallback={fallback}>
          <Canvas
            dpr={[1, maxDpr]}
            gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
            frameloop={inView && visible ? "always" : "never"}
            {...(camera ? { camera } : {})}
            {...(eventSource ? { eventSource } : {})}
          >
            {children}
          </Canvas>
        </SceneBoundary>
      ) : (
        fallback
      )}
    </div>
  );
}

export default GLStage;
