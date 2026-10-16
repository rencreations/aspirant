"use client";

import type { Route } from "next";
import Link from "next/link";
import { forwardRef, type ComponentPropsWithoutRef, type MouseEvent } from "react";

import { audio } from "@/lib/audio";
import type { ExternalHref } from "@/lib/site";

import { useTransitionRouter } from "./transition-provider";

type LinkProps = ComponentPropsWithoutRef<typeof Link>;

export interface TLinkProps extends Omit<LinkProps, "href"> {
  /** Internal route ("/story") or an external URL (rendered as a plain new-tab link). */
  href: Route | ExternalHref;
  /** Label shown on the transition cover. Defaults to the link text when it is a string. */
  transitionLabel?: string;
  /** Set false to use plain client navigation without the iris. */
  transition?: boolean;
  /** Play the click blip. Default true. */
  blip?: boolean;
}

const EXTERNAL = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;

/**
 * Internal link that navigates through the page transition. Renders a real <a> (Next Link,
 * with prefetch and base path), so modifier clicks, middle click, "open in new tab" and no-JS
 * all keep working: only a plain left click is intercepted.
 */
export const TLink = forwardRef<HTMLAnchorElement, TLinkProps>(function TLink(
  { href, onClick, transitionLabel, transition = true, blip = true, children, ...rest },
  ref,
) {
  const router = useTransitionRouter();
  const external = EXTERNAL.test(href);

  if (external) {
    return (
      <a ref={ref} href={href} target="_blank" rel="noopener noreferrer" {...rest}>
        {children}
      </a>
    );
  }

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || !transition) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (rest.target && rest.target !== "_self") return;
    if (rest.download !== undefined) return;
    e.preventDefault();
    if (blip) audio.blip("click");
    const keyboard = e.detail === 0;
    router.push(href, {
      ...(keyboard ? {} : { origin: { x: e.clientX, y: e.clientY } }),
      label: transitionLabel ?? (typeof children === "string" ? children : undefined),
    });
  };

  return (
    <Link ref={ref} href={href} onClick={handleClick} {...rest}>
      {children}
    </Link>
  );
});
