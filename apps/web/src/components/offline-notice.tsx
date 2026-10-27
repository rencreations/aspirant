"use client";

import { useEffect, useRef, useState } from "react";

import { OFFLINE_BLOCKED_EVENT, isOffline } from "@/lib/offline";

/**
 * A calm line at the foot of the screen while the device has no connection: what is already
 * loaded keeps working, and a page that was never opened waits for the connection. It says so
 * when the connection comes back, and then leaves. It is a polite live region and takes no clicks.
 */
export function OfflineNotice() {
  const [state, setState] = useState<"online" | "offline" | "back">("online");
  const [nudge, setNudge] = useState(0);
  const timer = useRef(0);

  useEffect(() => {
    const goOffline = () => {
      window.clearTimeout(timer.current);
      setState("offline");
    };
    const goOnline = () => {
      setState("back");
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        setState("online");
      }, 2600);
    };
    const blocked = () => {
      setState("offline");
      setNudge((n) => n + 1);
    };
    if (isOffline()) goOffline();
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    window.addEventListener(OFFLINE_BLOCKED_EVENT, blocked);
    return () => {
      window.clearTimeout(timer.current);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      window.removeEventListener(OFFLINE_BLOCKED_EVENT, blocked);
    };
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[999] flex justify-center px-4"
    >
      {state !== "online" ? (
        <p
          key={nudge}
          data-state={state}
          className="m-0 max-w-[46ch] rounded-full border border-[rgb(255_255_255/0.25)] bg-[rgb(20_14_38/0.92)] px-5 py-3 text-center text-[0.8125rem] leading-snug text-[#f3f1fb] shadow-[0_6px_28px_rgb(0_0_0/0.35)]"
        >
          {state === "offline"
            ? "You are offline. What has loaded keeps working. Other pages open when you are back."
            : "Back online."}
        </p>
      ) : null}
    </div>
  );
}
