"use client";

import type { ReactNode } from "react";

import { useConsent } from "@/features/legal/consent/use-consent";

/**
 * "Cookie settings": the same button the menu's foot has. It opens the consent question again (the
 * banner is drawn by the site's shell, not by the home).
 */
export function CookieButton({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        useConsent.getState().reopen();
      }}
    >
      {children}
    </button>
  );
}
