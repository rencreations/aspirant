import "@fontsource-variable/big-shoulders-display/wght";
import "@fontsource-variable/hanken-grotesk/wght";
import "@fontsource-variable/jetbrains-mono/wght";
import "@fontsource/instrument-serif/400";
import "@fontsource/instrument-serif/400-italic";
import "./globals.css";

import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { FocusStar } from "@/components/focus-star";
import { HudFrame } from "@/components/hud/hud-frame";
import { LanternCursor } from "@/components/lantern-cursor";
import { LoaderGate, SHELL_ID } from "@/components/loader-gate";
import { SiteNav } from "@/components/nav/site-nav";
import { SiteProviders } from "@/components/site-providers";
import { MorphLayer } from "@/features/story/morph/morph-layer";
import { RELOAD_KEY, RELOAD_WINDOW_MS } from "@/lib/chunk-guard";
import { ENTERED_KEY } from "@/lib/stores";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name}: ${siteConfig.tagline}`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  // Resolved against the address of each page, so every route names itself as canonical.
  alternates: { canonical: "./" },
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
  themeColor: "#f3f5f9",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/*
 * Runs before first paint: marks JS and sets the pointer type,
 * and paints the gate cover when this tab has not entered yet, and for a returning tab whose scripts are slow to start (1.5 s).
 * The cover stays until the loader mounts (`window.__aspirantsGate`). There is no timer that lets
 * it go: a slow connection waits behind it, with a note, and never gets the plain server text of
 * the page, however long the scripts take (owner decision, 1 Nov 2026, one version only). The
 * only way out is the "Reload the page" link it shows after 90 s, for a visitor whose scripts
 * have really failed. A visitor without JavaScript never gets the cover (this script does not run).
 * It also catches a page whose own scripts or styles failed to arrive (an old deploy, or a
 * connection that dropped before they came): it reloads once, under the same one-a-minute rule as
 * `lib/chunk-guard.ts`, and when the device is offline it reloads as soon as the connection is back.
 */
const BOOT = `(function(){try{var d=document.documentElement;d.classList.add("js");d.dataset.pointer=matchMedia("(hover: hover) and (pointer: fine)").matches?"fine":"coarse";var e=!1;try{e=sessionStorage.getItem("${ENTERED_KEY}")==="1"}catch(x){}if(!e){d.dataset.gate="on"}else{setTimeout(function(){if(!window.__aspirantsGate)d.dataset.gate="on"},1500)}var k="${RELOAD_KEY}";var go=function(){try{var a=+sessionStorage.getItem(k)||0,n=Date.now();if(a&&n-a<${RELOAD_WINDOW_MS})return;sessionStorage.setItem(k,String(n));location.reload()}catch(x){}};addEventListener("error",function(v){var t=v.target;if(!t||(t.tagName!=="SCRIPT"&&t.tagName!=="LINK"))return;if((t.src||t.href||"").indexOf("/_next/static/")<0)return;try{if(!navigator.onLine){addEventListener("online",go,{once:true});return}go()}catch(x){}},true)}catch(x){}})();`;

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" data-theme="daybreak" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOT }} />
      </head>
      <body>
        <div className="gate-cover">
          <div className="gate-cover-inner">
            <p className="gate-cover-mark" aria-hidden="true">
              The Aspirants
            </p>
            <span className="gate-cover-bar" aria-hidden="true" />
            <div className="gate-cover-notes">
              <p className="gate-cover-note gate-cover-first">Loading the site</p>
              <p className="gate-cover-note gate-cover-slow">
                Slow connection. Still loading. The page opens when everything is loaded, with all
                its animations.
              </p>
            </div>
            <p className="gate-cover-note gate-cover-stuck">
              Still waiting for the site&apos;s files. <a href=".">Reload the page</a>
            </p>
          </div>
        </div>
        <SiteProviders>
          <div id={SHELL_ID}>
            <a href="#main" className="skip-link">
              Skip to content
            </a>
            <SiteNav />
            <HudFrame />
            <main id="main" tabIndex={-1} className="relative z-(--z-content)">
              {children}
            </main>
          </div>
          <MorphLayer />
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
