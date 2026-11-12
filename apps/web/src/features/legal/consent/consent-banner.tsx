"use client";

import { useEffect, useRef, useState } from "react";

import { TLink } from "@/components/transition/t-link";
import { audio } from "@/lib/audio";
import { LEGAL_ROUTES } from "@/lib/legal";
import { useSiteStore } from "@/lib/stores";

import { startAnalytics, stopAnalytics } from "./analytics";
import styles from "./consent-banner.module.css";
import { useConsent } from "./use-consent";

/** How long the page stands before the first question shows, so it never lands on top of the opening. */
const FIRST_SHOW_MS = 900;

/**
 * The one question about Google Analytics. A small plate at the foot of the screen that does not
 * cover the page and takes no focus: it is the last thing in the tab order. Reject and Accept look
 * the same, so neither is easier to press. It shows once the loading screen has gone and the site
 * is open, and again when the visitor asks for it ("Cookie settings" in the menu) or a year later.
 *
 * Analytics runs here too: a saved or given yes starts Google Analytics once the site is open, a
 * refusal stops it and removes its cookies.
 */
export function ConsentBanner() {
  const entered = useSiteStore((s) => s.entered);
  const { choice, ready, reopened, hydrate, answer } = useConsent();
  const [late, setLate] = useState(false);
  const first = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Analytics follows the choice. A saved yes waits until the browser is idle.
  useEffect(() => {
    if (!entered || !ready) return;
    if (choice === "rejected") {
      stopAnalytics();
      return;
    }
    if (choice !== "accepted") return;
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(startAnalytics, { timeout: 4000 });
      return () => {
        window.cancelIdleCallback(id);
      };
    }
    const id = window.setTimeout(startAnalytics, 1500);
    return () => {
      window.clearTimeout(id);
    };
  }, [entered, ready, choice]);

  // The first question waits a moment after the site opens.
  const asking = ready && entered && choice === null;
  useEffect(() => {
    if (!asking) return;
    const id = window.setTimeout(() => {
      setLate(true);
    }, FIRST_SHOW_MS);
    return () => {
      window.clearTimeout(id);
    };
  }, [asking]);

  const show = reopened || (asking && late);

  // Asked for from the menu: the buttons take focus, since the visitor just asked.
  useEffect(() => {
    if (reopened) first.current?.focus({ preventScroll: true });
  }, [reopened]);

  if (!show) return null;

  const said = (value: "accepted" | "rejected") => {
    audio.blip("click");
    answer(value);
  };

  return (
    <section className={styles.banner} aria-label="Analytics choice" data-consent="">
      <p className={styles.ask}>Count this visit with Google Analytics?</p>
      <p className={styles.note}>
        It sets cookies to tell visits apart. Cloudflare&apos;s counter uses no cookies and runs
        either way.{" "}
        <TLink href={LEGAL_ROUTES.privacy} className="link">
          Privacy
        </TLink>
      </p>
      {choice !== null ? (
        <p className={styles.now} role="status">
          Now: {choice === "accepted" ? "accepted" : "rejected"}
        </p>
      ) : null}
      <div className={styles.actions}>
        <button
          ref={first}
          type="button"
          className={styles.button}
          data-consent-answer="rejected"
          onClick={() => {
            said("rejected");
          }}
        >
          Reject
        </button>
        <button
          type="button"
          className={styles.button}
          data-consent-answer="accepted"
          onClick={() => {
            said("accepted");
          }}
        >
          Accept
        </button>
      </div>
    </section>
  );
}
