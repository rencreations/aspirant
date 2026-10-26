import type { CSSProperties } from "react";

/** The splash art is 2048 by 1152. */
const ASPECT = 1152 / 2048;

/**
 * Style that fits a square box on one point of a splash art: `at` is the point in percent from
 * the top left of the picture, `zoom` how many times wider than the box the picture is drawn.
 * The point lands in the middle of the box.
 */
export function crop(src: string, at: { x: number; y: number }, zoom: number): CSSProperties {
  const px = (0.5 - (at.x / 100) * zoom) / (1 - zoom);
  const py = (0.5 - (at.y / 100) * zoom * ASPECT) / (1 - zoom * ASPECT);
  return {
    backgroundImage: `url(${src})`,
    backgroundSize: `${zoom * 100}% auto`,
    backgroundPosition: `${(px * 100).toFixed(2)}% ${(py * 100).toFixed(2)}%`,
    backgroundRepeat: "no-repeat",
  };
}
