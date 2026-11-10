"use client";

import { useEffect, useState } from "react";

/**
 * Captions that the shared player can read from another origin. The player puts a `<track>` in a
 * `<video>` that has no `crossorigin` attribute, and a browser refuses a text track from another
 * origin in that case. The file is fetched here (the library sends CORS headers), put in a blob
 * and the blob's address, which belongs to this page, is handed to the player.
 *
 * Returns the address, or `undefined` while it loads, when there are no captions, or when the
 * file could not be read (the film then simply plays without captions).
 */
export function useCaptionsBlob(url: string | undefined): string | undefined {
  const [blob, setBlob] = useState<{ source: string; url: string } | null>(null);

  useEffect(() => {
    if (!url) return;
    // A caption file of this site's own origin needs no blob.
    if (url.startsWith("/") || url.startsWith("blob:")) return;
    let live = true;
    let made: string | null = null;
    fetch(url)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((text) => {
        if (!live) return;
        made = URL.createObjectURL(new Blob([text], { type: "text/vtt" }));
        setBlob({ source: url, url: made });
      })
      .catch(() => {
        if (live) setBlob(null);
      });
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [url]);

  if (!url) return undefined;
  if (url.startsWith("/") || url.startsWith("blob:")) return url;
  return blob?.source === url ? blob.url : undefined;
}
