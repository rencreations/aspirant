import { TRAILER_FILM } from "@/features/home/fx/video-plane/data";
import { windowBox } from "@/features/home/fx/video-plane/layout";
import { WindowDeck } from "@/features/home/sections/strip/deck";

import { FILM_STRIPS, FILM_AT, PANEL_TRAVEL, ROW_START } from "./series";

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
function ease(a: number, b: number, at: number) {
  const t = Math.max(0, Math.min(1, (at - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** The art stays in the same elements. Their current orbital positions become the start of the row. */
export function animateGallery(
  root: HTMLElement,
  track: HTMLElement,
  logo: HTMLElement,
  start: number,
  title: string,
  onPress: () => void,
) {
  const cards = Array.from(root.querySelectorAll<HTMLElement>("[data-series]")).map((el) => ({
    el,
    copy: el.querySelector<HTMLElement>("[data-series-copy]")!,
  }));
  const definition = root.querySelector<HTMLElement>("[data-definition]")!;
  const film = root.querySelector<HTMLElement>("[data-series-film]")!;
  const button = film.querySelector<HTMLButtonElement>("[data-strip-play]")!;
  const crop = film.querySelector<HTMLButtonElement>("[data-film-crop]")!;
  const video = crop.querySelector("video")!;
  const deck = new WindowDeck(film, {
    strips: FILM_STRIPS,
    readout: [title, "TheMLabel"],
    onPress,
  });
  let filmBox = windowBox(1, 1, TRAILER_FILM.aspect);
  let near = false;
  let phase = -Math.PI * 0.22;
  let frame = 0;
  let last = 0;
  let target = 0;
  let shown: number | undefined;
  let w = 0;
  let h = 0;
  let panel = 0;
  let stripe = 0;
  let origin = 0;

  const measure = () => {
    w = root.clientWidth;
    h = root.clientHeight;
    panel = cards[0]!.el.offsetWidth;
    filmBox = windowBox(w, h, TRAILER_FILM.aspect);
    film.style.setProperty("--sw", filmBox.w + "px");
    film.style.setProperty("--film-aspect", String(TRAILER_FILM.aspect));
    stripe = (w + panel * 0.88) / 2 - Math.min(w * 0.065, 95);
    origin = track.getBoundingClientRect().top + window.scrollY;
  };
  const draw = (now: number) => {
    frame = 0;
    const dt = last ? Math.min(0.06, (now - last) / 1000) : 0;
    last = now;
    const previous = shown;
    shown = shown === undefined ? target : mix(shown, target, 1 - Math.exp(-dt * 16));
    if (Math.abs(target - shown) < 0.0005) shown = target;
    const t = shown;
    const enter = ease(0, 1.05, t);
    const fade = 1 - ease(1.87, 2.49, t);
    const align = ease(2.06, ROW_START, t);
    const position = Math.max(0, Math.min(cards.length, (t - ROW_START) / PANEL_TRAVEL));
    const index = Math.floor(position);
    const station = index + ease(0.16, 0.87, position - index);
    const narrow = w < 700;
    const rowY = h * (narrow ? -0.08 : -0.075);
    const expand = ease(FILM_AT, FILM_AT + 1.1, t);
    const orbiting = t > 0 && t < ROW_START;
    if (orbiting) phase += dt * 0.15 * enter * (1 - align);
    if (orbiting || previous !== shown) {
      logo.style.transform = `translateY(${-h * 0.029 * enter}px) scale(${mix(1, narrow ? 0.41 : 0.39, enter)})`;
      logo.style.opacity = String(fade);
      definition.style.opacity = String(ease(0.38, 1.15, t) * fade);
      definition.style.transform = `translate(-50%, ${(1 - enter) * 16}px)`;
      cards.forEach(({ el, copy }, i) => {
        const arrival = ease(i * 0.095, 0.84 + i * 0.095, t);
        const angle = phase + (i * Math.PI) / 2 - (1 - arrival) * 0.97;
        const radius = 1 + (1 - arrival) * 0.68;
        const x = Math.cos(angle) * w * (narrow ? 0.345 : 0.32) * radius;
        const y = Math.sin(angle) * h * (narrow ? 0.29 : 0.305) * radius - h * 0.022;
        const orbitScale = Math.min(w * (narrow ? 0.29 : 0.215), h * 0.36) / panel;
        const focus = 1 - ease(0, 1, Math.abs(i - station));
        const scale = mix(orbitScale * mix(0.5, 1, arrival), mix(0.88, 1, focus), align);
        const tilt = Math.cos(angle) * 7 - 14 * (1 - arrival);
        el.style.transform = `translate(-50%, -50%) translate3d(${mix(x, (station - i) * stripe, align)}px,${mix(y, rowY, align)}px,0) rotate(${tilt * (1 - align)}deg) scale(${scale})`;
        el.style.visibility = arrival > 0 ? "visible" : "hidden";
        el.style.opacity = String(arrival * mix(1, mix(0.28, 1, focus), align) * (1 - expand));
        copy.style.opacity = String(ease(2.88, 3.46, t) * focus);
        copy.style.transform = `translateY(${(1 - align * focus) * 14}px)`;
      });
    }
    const filmIn = ease(cards.length - 1, cards.length, station);
    // Arrive at the same size and height as Soul Vessels before growing into the homepage window.
    if (previous !== shown) {
      const width = mix(panel * mix(0.88, 1, filmIn), filmBox.w, expand);
      const centerY = filmBox.y + filmBox.h / 2 - h / 2;
      const cropY = mix(1, 16 / 9 / TRAILER_FILM.aspect, expand);
      film.style.transform = `translate(-50%, -50%) translate3d(${(station - cards.length) * stripe}px,${mix(rowY, centerY, expand)}px,0) scale(${width / filmBox.w})`;
      film.style.opacity = String(align * mix(0.28, 1, filmIn));
      crop.style.transform = `translateY(-50%) scaleY(${cropY})`;
      video.style.transform = `scaleY(${1 / cropY})`;
    }
    const up = ease(0.42, 1, expand);
    if (button.disabled !== up < 0.8) {
      button.disabled = up < 0.8;
      crop.disabled = button.disabled;
    }
    if (up > 0 || previous !== shown) deck.step(dt, up, Math.max(11, filmBox.w / 80), filmBox.w);
    if (near && !document.hidden && (orbiting || up > 0 || shown !== target))
      frame = requestAnimationFrame(draw);
  };
  const update = () => {
    if (!near || document.hidden) return;
    target = Math.max(0, (window.scrollY - origin) / Math.max(h, 1) - start);
    if (!frame) {
      last = 0;
      frame = requestAnimationFrame(draw);
    }
  };
  const resize = new ResizeObserver(() => {
    measure();
    shown = undefined;
    update();
  });
  resize.observe(root);
  resize.observe(track.parentElement?.closest("[data-about]") ?? track);
  const observer = new IntersectionObserver(([entry]) => {
    near = entry?.isIntersecting ?? false;
    if (near) {
      measure();
      shown = undefined;
      update();
    } else {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  });
  observer.observe(root);
  window.addEventListener("scroll", update, { passive: true });
  document.addEventListener("visibilitychange", update);
  return () => {
    cancelAnimationFrame(frame);
    deck.dispose();
    observer.disconnect();
    resize.disconnect();
    window.removeEventListener("scroll", update);
    document.removeEventListener("visibilitychange", update);
  };
}
