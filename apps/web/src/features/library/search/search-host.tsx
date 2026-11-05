"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";

import { useLibrarySearch } from "./search-store";

const SearchOverlay = dynamic(() => import("./search-overlay"));

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

/** Mounted once for the whole `/collection` tree: the keys that open the search and the sheet itself. */
export function SearchHost() {
  const open = useLibrarySearch((s) => s.open);
  const setOpen = useLibrarySearch((s) => s.setOpen);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const slash = e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && !isTyping(e.target);
      const chord = e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey);
      if (slash || chord) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [setOpen]);

  return open ? <SearchOverlay /> : null;
}

/** A small button that opens the search. Use it in a header or a bar. */
export function SearchButton({ className }: { className?: string }) {
  const setOpen = useLibrarySearch((s) => s.setOpen);
  return (
    <button
      type="button"
      className={className}
      aria-label="Search the collection (press the slash key)"
      onClick={() => {
        setOpen(true);
      }}
    >
      Search <kbd>/</kbd>
    </button>
  );
}
