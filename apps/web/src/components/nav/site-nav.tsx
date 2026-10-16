"use client";

import { usePathname } from "next/navigation";
import { Dialog } from "radix-ui";
import { useEffect, useRef, useState } from "react";

import { StarGlyph } from "@/components/star-glyph";
import { MotionToggle, SoundToggle } from "@/components/hud/preference-toggles";
import { ScatterText } from "@/components/text/scatter-text";
import { TLink } from "@/components/transition/t-link";
import { Magnetic } from "@/components/ui/magnetic";
import { audio } from "@/lib/audio";
import { useLenis } from "@/components/smooth-scroll";
import { useThemeAt } from "@/lib/hooks";
import { isActiveRoute, navItems, routes, siteConfig } from "@/lib/site";

import styles from "./nav.module.css";

/**
 * Top bar: the star logo and "THE ASPIRANTS" wordmark (letters scatter on hover), the five
 * destinations with index numbers and current-page state, hover blips and magnetic links.
 * Hides while scrolling down and returns on scroll up or focus. At 900 px and below it shows
 * a sound toggle and a MENU button that opens a full-screen terminal menu (focus trapped,
 * Esc closes, focus returns to the button).
 */
export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pause, resume } = useLenis();
  const theme = useThemeAt((w) => ({ x: w / 2, y: 4 }));
  const lastY = useRef(0);

  useEffect(() => {
    let raf = 0;
    const read = () => {
      raf = 0;
      const y = window.scrollY;
      const dy = y - lastY.current;
      if (Math.abs(dy) > 6) {
        setHidden(dy > 0 && y > 160);
        lastY.current = y;
      }
      setScrolled(y > 12);
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

  // Close the menu after navigation and show the bar on every new page.
  const [shownPath, setShownPath] = useState(pathname);
  if (shownPath !== pathname) {
    setShownPath(pathname);
    setOpen(false);
    setHidden(false);
  }

  useEffect(() => {
    if (!open) return;
    pause();
    return resume;
  }, [open, pause, resume]);

  return (
    <header
      className={styles.nav}
      data-hidden={hidden && !open}
      data-scrolled={scrolled}
      data-theme={theme}
      data-overlay="nav"
    >
      <div className={styles.inner}>
        <TLink
          href={routes.home}
          className={styles.brand}
          aria-label={`${siteConfig.name}, home`}
          transitionLabel="Home"
          onPointerEnter={() => audio.blip("hover")}
        >
          <StarGlyph className={styles.brandStar} />
          <ScatterText text="The Aspirants" className={styles.wordmark} radius={70} />
        </TLink>

        <nav aria-label="Main">
          <ul className={styles.links}>
            {navItems.map((item) => {
              const active = isActiveRoute(pathname, item.href);
              return (
                <li key={item.href}>
                  <Magnetic strength={0.25} max={8}>
                    <TLink
                      href={item.href}
                      className={styles.link}
                      aria-current={active ? "page" : undefined}
                      transitionLabel={item.label}
                      onPointerEnter={() => audio.blip("hover")}
                      onFocus={() => audio.blip("hover")}
                    >
                      <span className={styles.linkIndex} aria-hidden="true">
                        {item.index}
                      </span>
                      <span className={styles.linkLabel}>{item.label}</span>
                    </TLink>
                  </Magnetic>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className={styles.right}>
          <span className={`${styles.status} hud-label`} aria-hidden="true">
            <span className={styles.statusDot} />
            Archive online
          </span>
          <SoundToggle className={styles.mobileOnly} />
          <Dialog.Root
            open={open}
            onOpenChange={(next) => {
              setOpen(next);
              audio.blip(next ? "click" : "hover");
            }}
          >
            <Dialog.Trigger className={styles.menuButton} aria-label="Open menu">
              <span className={styles.burger} aria-hidden="true" />
              <span aria-hidden="true">Menu</span>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Content
                className={styles.menu}
                data-theme={theme}
                aria-describedby={undefined}
                onCloseAutoFocus={(e) => {
                  // Keep focus where the transition put it after navigating.
                  if (document.activeElement?.id === "main") e.preventDefault();
                }}
              >
                <div className={styles.menuHead}>
                  <Dialog.Title className={`${styles.menuTitle} hud-label`}>
                    Archive index
                  </Dialog.Title>
                  <Dialog.Close className={styles.close} aria-label="Close menu">
                    <span aria-hidden="true">Close</span>
                    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                      <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.4" />
                    </svg>
                  </Dialog.Close>
                </div>
                <nav aria-label="Menu">
                  <ul className={styles.menuList}>
                    {navItems.map((item, i) => {
                      const active = isActiveRoute(pathname, item.href);
                      return (
                        <li
                          key={item.href}
                          className={styles.menuItem}
                          style={{ ["--i" as string]: i }}
                        >
                          <TLink
                            href={item.href}
                            className={styles.menuLink}
                            aria-current={active ? "page" : undefined}
                            transitionLabel={item.label}
                            onClick={() => setOpen(false)}
                          >
                            <span className={styles.menuIndex} aria-hidden="true">
                              {item.index}
                            </span>
                            <span className={styles.menuLabel}>{item.label}</span>
                          </TLink>
                        </li>
                      );
                    })}
                  </ul>
                </nav>
                <div className={styles.menuFoot}>
                  <p className="m-0 hud-label">Selrick Academy / Resonance terminal</p>
                  <div className={styles.menuToggles}>
                    <SoundToggle labeled />
                    <MotionToggle labeled />
                  </div>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </div>
    </header>
  );
}
