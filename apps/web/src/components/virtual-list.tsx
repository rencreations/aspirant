"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";

import type { Person } from "@/lib/people";

/** Renders only the visible rows of a very long list with TanStack Virtual. */
export function VirtualList({ items }: { items: readonly Person[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  // TanStack Virtual returns non-memoizable functions; the React Compiler skips this component, which is expected.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 8,
  });

  return (
    <div
      ref={parentRef}
      className="h-72 overflow-auto rounded-md border"
      role="list"
      aria-label="Virtualized people list"
      tabIndex={0}
    >
      <div style={{ height: virtualizer.getTotalSize() }} className="relative w-full">
        {virtualizer.getVirtualItems().map((row) => {
          const person = items[row.index];
          if (!person) return null;
          return (
            <div
              key={row.key}
              role="listitem"
              className="absolute inset-x-0 flex items-center justify-between border-b px-3 text-sm"
              style={{ height: row.size, transform: `translateY(${row.start}px)` }}
            >
              <span>
                <span className="mr-2 font-mono text-xs text-muted-foreground">#{person.id}</span>
                {person.name}
              </span>
              <span className="text-muted-foreground">{person.role}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
