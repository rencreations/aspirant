"use client";

import { usePathname } from "next/navigation";
import { Dialog } from "radix-ui";
import { useCallback, useEffect, useRef, useState } from "react";

import { MotionToggle } from "@/components/hud/preference-toggles";
import { AspirantLogo } from "@/components/logo/aspirant-logo";
import { useLenis } from "@/components/smooth-scroll";
import { TLink } from "@/components/transition/t-link";
import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import { useThemeAt } from "@/lib/hooks";
import { isActiveRoute, navItems, routes, siteConfig } from "@/lib/site";
import { useSiteStore } from "@/lib/stores";

import { MENU_PAIRS, warmMenuPairs } from "./menu-pairs";
import styles from "./nav.module.css";
import { SoundButton } from "./sound-button";

interface Tint {
  id: number;
  colour: string;
  x: number;
  y: number;
  out: boolean;
}

/**
 * The top bar and the full-screen menu.
 *
 * The bar is sticky and always visible: the menu button and the sound button on the left, the
 * large logo in the middle, the current page on the right. The menu button opens a screen-wide
 * menu with the five pages, big and centred. Hovering or focusing a page blooms its colour
 * behind the menu, highlights the title and shows its two aspirants beside it (no names, art
 * only). On narrow screens, where nothing hovers, the pair of the current page is shown.
 * The menu traps focus, Esc closes it and focus returns to the button.
 */
export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const [tints, setTints] = useState<Tint[]>([]);
  const { pause, resume } = useLenis();
  const theme = useThemeAt((w) => ({ x: w / 2, y: 4 }));
  const entered = useSiteStore((s) => s.entered);
  const tintId = useRef(0);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const currentIndex = navItems.findIndex((item) => isActiveRoute(pathname, item.href));
  const current = currentIndex >= 0 ? navItems[currentIndex] : undefined;

  useEffect(() => {
    let raf = 0;
    const read = () => {
      raf = 0;
      setScrolled(window.scrollY > 12);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // Warm the menu art once the site is open: the current page's pair first, then the rest.
  useEffect(() => {
    if (!entered) return;
    const hrefs = navItems.map((i) => i.href);
    const order = current ? [current.href, ...hrefs.filter((h) => h !== current.href)] : hrefs;
    const timer = window.setTimeout(() => {
      void warmMenuPairs(order);
    }, 600);
    return () => {
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entered]);

  // Close the menu after navigation.
  const [shownPath, setShownPath] = useState(pathname);
  if (shownPath !== pathname) {
    setShownPath(pathname);
    setOpen(false);
    setActive(null);
    setTints([]);
  }

  useEffect(() => {
    if (!open) return;
    pause();
    return resume;
  }, [open, pause, resume]);

  const bloom = useCallback((index: number, x: number, y: number) => {
    setActive(index);
    const item = navItems[index];
    const colour = item ? MENU_PAIRS[item.href]?.tint : undefined;
    if (!colour) return;
    const id = ++tintId.current;
    setTints((all) => [...all.filter((t) => !t.out).slice(-1), { id, colour, x, y, out: false }]);
  }, []);

  const settle = useCallback(() => {
    setActive(null);
    setTints((all) => all.map((t) => ({ ...t, out: true })));
    window.setTimeout(() => {
      setTints((all) => all.filter((t) => !t.out));
    }, 500);
  }, []);

  // Pointer parallax for the portraits: -1 to 1 across the screen.
  const parallax = useRef(0);
  const onMenuMove = (e: React.PointerEvent) => {
    if (parallax.current) return;
    const { clientX } = e;
    parallax.current = requestAnimationFrame(() => {
      parallax.current = 0;
      menuRef.current?.style.setProperty(
        "--mx",
        String(((clientX / window.innerWidth) * 2 - 1).toFixed(3)),
      );
    });
  };

  return (
    <header className={styles.nav} data-scrolled={scrolled} data-theme={theme} data-overlay="nav">
      <Dialog.Root
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setActive(null);
            setTints([]);
          }
          audio.blip(next ? "click" : "hover");
        }}
      >
        <div className={styles.inner}>
          <div className={styles.left}>
            <Dialog.Trigger className={styles.menuButton} aria-label="Open menu">
              <span className={styles.burger} aria-hidden="true" />
              <span className={styles.menuText} aria-hidden="true">
                Menu
              </span>
            </Dialog.Trigger>
            <SoundButton />
          </div>

          <TLink
            href={routes.home}
            className={styles.brand}
            aria-label={`${siteConfig.name}, home`}
            transitionLabel="Home"
            data-logo-host
          >
            <AspirantLogo variant="interactive" className={styles.logo} decorative />
          </TLink>

          <p className={styles.here}>
            {current ? (
              <>
                <span className={styles.hereIndex}>{current.index}</span>
                <span className={styles.hereLabel}>{current.label}</span>
              </>
            ) : null}
          </p>
        </div>

        <Dialog.Portal>
          <Dialog.Content
            ref={menuRef}
            className={styles.menu}
            data-theme="daybreak"
            data-active={active ?? "none"}
            data-current={currentIndex >= 0 ? currentIndex : "none"}
            aria-describedby={undefined}
            onPointerMove={onMenuMove}
            onCloseAutoFocus={(e) => {
              // Keep focus where the transition put it after navigating.
              if (document.activeElement?.id === "main") e.preventDefault();
            }}
          >
            <div className={styles.wipe} aria-hidden="true" />
            <div className={styles.paper} aria-hidden="true">
              {tints.map((t) => (
                <span
                  key={t.id}
                  className={styles.tint}
                  data-out={t.out}
                  style={{
                    background: t.colour,
                    ["--tx" as string]: `${t.x}px`,
                    ["--ty" as string]: `${t.y}px`,
                  }}
                />
              ))}
            </div>

            <div className={styles.menuHead}>
              <div className={styles.left}>
                <Dialog.Close className={styles.menuButton} aria-label="Close menu">
                  <span className={styles.cross} aria-hidden="true" />
                  <span className={styles.menuText} aria-hidden="true">
                    Close
                  </span>
                </Dialog.Close>
                <SoundButton />
              </div>
              <Dialog.Title className={styles.menuTitle}>
                <span className="sr-only">Menu</span>
                <AspirantLogo className={styles.logo} decorative />
              </Dialog.Title>
              <p className={styles.here} aria-hidden="true">
                <span className={styles.hereLabel}>Archive index</span>
              </p>
            </div>

            <nav aria-label="Menu" className={styles.menuNav}>
              <ul
                className={styles.menuList}
                data-hovering={active !== null}
                onPointerLeave={settle}
              >
                {navItems.map((item, i) => {
                  const pair = MENU_PAIRS[item.href];
                  const isCurrent = isActiveRoute(pathname, item.href);
                  const shown = active === i ? "hover" : isCurrent ? "current" : "off";
                  return (
                    <li
                      key={item.href}
                      className={styles.menuItem}
                      data-i={i}
                      style={{ ["--i" as string]: i }}
                    >
                      <TLink
                        href={item.href}
                        className={styles.menuLink}
                        aria-current={isCurrent ? "page" : undefined}
                        transitionLabel={item.label}
                        data-active={active === i}
                        onClick={() => {
                          setOpen(false);
                        }}
                        onPointerEnter={(e) => {
                          if (e.pointerType === "touch") return;
                          bloom(i, e.clientX, e.clientY);
                          audio.blip("hover");
                        }}
                        onFocus={(e) => {
                          if (!e.currentTarget.matches(":focus-visible")) return;
                          const r = e.currentTarget.getBoundingClientRect();
                          bloom(i, r.left + r.width / 2, r.top + r.height / 2);
                          audio.blip("hover");
                        }}
                        onBlur={settle}
                      >
                        <span className={styles.plate} aria-hidden="true" />
                        <span className={styles.menuIndex} aria-hidden="true">
                          {item.index}
                        </span>
                        <span className={styles.menuMask}>
                          <span className={styles.menuLabel}>{item.label}</span>
                        </span>
                        {pair ? (
                          <span className={styles.pair} data-shown={shown} aria-hidden="true">
                            {/* Plain <img>: static export, art already sized and cropped. */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img className={styles.figL} src={asset(pair.left)} alt="" />
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img className={styles.figR} src={asset(pair.right)} alt="" />
                          </span>
                        ) : null}
                      </TLink>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className={styles.menuFoot}>
              <p className="m-0 hud-label">Selrick Academy / Resonance terminal</p>
              <MotionToggle labeled />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </header>
  );
}
