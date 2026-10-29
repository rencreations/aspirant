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
import { RELOAD_KEY, RELOAD_WINDOW_MS } from "@/lib/chunk-guard";
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
 * Runs before first paint: marks JS, applies the saved motion preference and pointer type,
 * and paints the gate cover when this tab has not entered yet, and for a returning tab whose scripts are slow to start (1.5 s). The cover stays until the loader mounts: a slow connection waits behind it, with a note, and does not get the plain server text. Only when the scripts never start (`GATE_FAILSAFE_MS`) does it let go. It also catches
 * a page of an old deploy whose own scripts or styles are gone (the page then stays as plain
 * server text, with no animation at all, because nothing can start): it reloads once, under the
 * same one-a-minute rule as `lib/chunk-guard.ts`.
 */
/** The longest the cover waits for the scripts to start before it lets go (they have failed). */
const GATE_FAILSAFE_MS = 180_000;

const BOOT = `(function(){try{var d=document.documentElement;d.classList.add("js");var s={};try{var p=JSON.parse(localStorage.getItem("${PREFS_KEY}")||"null");s=(p&&p.state)||{}}catch(e){}var r=s.motion==="reduced"||matchMedia("(prefers-reduced-motion: reduce)").matches;d.dataset.motion=r?"reduced":"auto";d.dataset.pointer=matchMedia("(hover: hover) and (pointer: fine)").matches?"fine":"coarse";var e=!1;try{e=sessionStorage.getItem("${ENTERED_KEY}")==="1"}catch(x){}var f=function(){setTimeout(function(){if(!window.__aspirantsGate)delete d.dataset.gate},${GATE_FAILSAFE_MS})};if(!e){d.dataset.gate="on";f()}else{setTimeout(function(){if(!window.__aspirantsGate){d.dataset.gate="on";f()}},1500)}var k="${RELOAD_KEY}";addEventListener("error",function(v){var t=v.target;if(!t||(t.tagName!=="SCRIPT"&&t.tagName!=="LINK"))return;if((t.src||t.href||"").indexOf("/_next/static/")<0)return;try{if(!navigator.onLine)return;var a=+sessionStorage.getItem(k)||0,n=Date.now();if(a&&n-a<${RELOAD_WINDOW_MS})return;sessionStorage.setItem(k,String(n));location.reload()}catch(x){}},true)}catch(x){}})();`;

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
                Slow connection. Still loading. The page opens when everything is ready, with all
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
