"use client";

import Link from "next/link";
import { useEffect } from "react";

import styles from "./route-error.module.css";

/**
 * What a visitor sees when something on Vexana's pages breaks for good (a script that never arrived
 * on a poor connection, an unexpected exception). Pressing "Try again" asks the page to build
 * itself again; "Reload" starts the visit over; the third link leads back to the roster.
 */
export function RouteError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    // Kept in the console for whoever looks; the visitor is not shown it.
    console.error(error);
  }, [error]);
  return (
    <main className={styles.wrap} data-theme="storm">
      <div className={styles.box} role="alert">
        <p className={styles.eyebrow}>Signal lost</p>
        <h1 className={styles.title}>This page stumbled</h1>
        <p className={styles.text}>
          Something stopped it from loading, often a connection that dropped. Nothing is lost. Try
          again, or reload the page.
        </p>
        <div className={styles.row}>
          <button type="button" className={styles.btn} onClick={reset}>
            Try again
          </button>
          <button type="button" className={styles.btn} onClick={() => window.location.reload()}>
            Reload
          </button>
          <Link className={styles.btn} href="/character">
            All Aspirants
          </Link>
        </div>
      </div>
    </main>
  );
}
