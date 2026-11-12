"use client";

import { usePathname } from "next/navigation";
import type { ComponentPropsWithoutRef } from "react";

import { TLink } from "@/components/transition/t-link";

import { takedownHref, type ReportTarget } from "./prefill";

interface ReportLinkProps extends Omit<ComponentPropsWithoutRef<"a">, "href" | "children"> {
  item: ReportTarget;
}

/**
 * The small text link on the page of one item that is not Moonton's own (fan art, cosplay, fan
 * comics, fan videos, and the 3D models): it opens the takedown page with the item already named.
 * Text only, no icon. Where it sits is up to the page, through `className`.
 */
export function ReportLink({ item, ...rest }: ReportLinkProps) {
  const pathname = usePathname();
  return (
    <TLink
      {...rest}
      href={takedownHref(item, pathname)}
      transitionLabel="Takedown"
      data-report=""
      aria-label={`Copyright or takedown for ${item.title || "this item"}`}
    >
      Copyright or takedown
    </TLink>
  );
}
