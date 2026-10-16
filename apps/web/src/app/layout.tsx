import "@fontsource-variable/big-shoulders-display/wght";
import "@fontsource-variable/hanken-grotesk/wght";
import "@fontsource-variable/jetbrains-mono/wght";
import "@fontsource/instrument-serif/400";
import "@fontsource/instrument-serif/400-italic";
import "./globals.css";

import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { EmberField } from "@/components/ember-field";
import { FocusStar } from "@/components/focus-star";
import { HudFrame } from "@/components/hud/hud-frame";
import { LanternCursor } from "@/components/lantern-cursor";
import { LoaderGate, SHELL_ID } from "@/components/loader-gate";
import { SiteNav } from "@/components/nav/site-nav";
import { SiteProviders } from "@/components/site-providers";
import { ENTERED_KEY, PREFS_KEY } from "@/lib/stores";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name}: ${siteConfig.tagline}`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  openGraph: {
    title: siteConfig.name,
    description: siteConfig.description,
    type: "website",
    siteName: siteConfig.name,
    locale: "en",
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
  },
  robots: { index: true, follow: true },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#05070c",
  colorScheme: "dark light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/*
 * Runs before first paint: marks JS, applies the saved motion preference and pointer type,
 * and paints the gate cover when this tab has not entered yet (failsafe after 9 s).
 */
const BOOT = `(function(){try{var d=document.documentElement;d.classList.add("js");var s={};try{var p=JSON.parse(localStorage.getItem("${PREFS_KEY}")||"null");s=(p&&p.state)||{}}catch(e){}var r=s.motion==="reduced"||matchMedia("(prefers-reduced-motion: reduce)").matches;d.dataset.motion=r?"reduced":"auto";d.dataset.pointer=matchMedia("(hover: hover) and (pointer: fine)").matches?"fine":"coarse";var e=!1;try{e=sessionStorage.getItem("${ENTERED_KEY}")==="1"}catch(x){}if(!e){d.dataset.gate="on";setTimeout(function(){if(!window.__aspirantsGate)delete d.dataset.gate},9000)}}catch(x){}})();`;

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" data-theme="storm" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOT }} />
      </head>
      <body>
        <div className="gate-cover" aria-hidden="true" />
        <SiteProviders>
          <div id={SHELL_ID}>
            <a href="#main" className="skip-link">
              Skip to content
            </a>
            <EmberField />
            <SiteNav />
            <HudFrame />
            <main id="main" tabIndex={-1} className="relative z-(--z-content)">
              {children}
            </main>
          </div>
          <LanternCursor />
          <FocusStar />
          <LoaderGate />
        </SiteProviders>
        <noscript>
          <p className="noscript">
            This archive works best with JavaScript on. The whole text and every page still load
            without it.
          </p>
        </noscript>
      </body>
    </html>
  );
}
