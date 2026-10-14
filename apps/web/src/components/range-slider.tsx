"use client";

import { useRanger } from "@tanstack/react-ranger";
import { useRef } from "react";

interface RangeSliderProps {
  min: number;
  max: number;
  step?: number;
  values: readonly [number, number];
  onChange: (values: [number, number]) => void;
  label: string;
}

/** Headless dual-handle range slider built on TanStack Ranger. */
export function RangeSlider({ min, max, step = 5, values, onChange, label }: RangeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  const ranger = useRanger<HTMLDivElement>({
    getRangerElement: () => trackRef.current,
    values,
    min,
    max,
    stepSize: step,
    onChange: (instance) => {
      const [lo, hi] = instance.sortedValues;
      if (lo !== undefined && hi !== undefined) onChange([lo, hi]);
    },
  });

  return (
    <div
      ref={trackRef}
      className="relative my-3 h-1.5 w-full touch-none rounded-full bg-muted select-none"
    >
      {ranger.getSteps().map(({ left, width }, i) => (
        <div
          key={i}
          className={i === 1 ? "absolute h-full rounded-full bg-primary" : "absolute h-full"}
          style={{ left: `${left}%`, width: `${width}%` }}
        />
      ))}
      {ranger
        .handles()
        .map(({ value, onKeyDownHandler, onMouseDownHandler, onTouchStart, isActive }, i) => (
          <div
            key={i}
            role="slider"
            tabIndex={0}
            aria-label={`${label} ${i === 0 ? "minimum" : "maximum"}`}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={value}
            onKeyDown={onKeyDownHandler}
            onMouseDown={onMouseDownHandler}
            onTouchStart={onTouchStart}
            className={`absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border border-primary bg-white shadow-sm outline-none focus-visible:ring-4 focus-visible:ring-ring/50 ${isActive ? "ring-4 ring-ring/50" : ""}`}
            style={{ left: `${ranger.getPercentageForValue(value)}%` }}
          />
        ))}
    </div>
  );
}
