/**
 * Wait for the loading curtain to open (the first visit, or a page change). Resolves at once when
 * no curtain is up. Returns the way to stop waiting.
 */
export function whenCurtainOpen(): { promise: Promise<void>; cancel: () => void } {
  let cancel: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    const el = document.querySelector<HTMLElement>("[data-mode][data-active]");
    if (el?.dataset.active !== "true") {
      resolve();
      return;
    }
    const obs = new MutationObserver(() => {
      if (el.dataset.active !== "true") {
        obs.disconnect();
        resolve();
      }
    });
    obs.observe(el, { attributes: true, attributeFilter: ["data-active"] });
    cancel = () => {
      obs.disconnect();
    };
  });
  return { promise, cancel: () => cancel() };
}
