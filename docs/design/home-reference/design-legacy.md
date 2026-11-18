# Home rebuild: design language cheat sheet and the old home map

Written 18 Nov 2026 for the implementers of the new `/`. Facts only, with file paths. Everything here was read from the repository or measured on the running site. Screenshots (1440x900) of the pages studied were taken from the running site and are not stored in the repository: `/about`, `/collection`, Films, Music, Animation, Arts, the old home and the first-visit loader.

Read this first: `localhost:3000` currently runs `next dev -p 3000` with `NEXT_DIST_DIR=.next-preview`, not `serve out` (HANDOFF says production, reality differs). The black "N" circle at the bottom left of every screenshot is the Next dev indicator, not part of the design. Judge speed on a production build only (`docs/design/performance.md`).

## 1. Design language cheat sheet

### 1.1 Where the truth is (the docs are partly stale)

- Tokens: `apps/web/src/styles/tokens.css`. Tailwind mapping: `@theme inline` in `apps/web/src/app/globals.css`. Element defaults: `styles/base.css`. Utilities (`display`, `serif`, `mono`, `hud-label`, `shell`, `chamfer`, `scanlines`, `grid-hex`, `link`...): `styles/utilities.css`. `packages/config` holds only eslint, prettier and tsconfig (no Tailwind theme). `packages/ui` holds Radix wrappers (accordion, dialog, slider, switch, tabs, tooltip) mapped to the tokens with `--radius: 0`.
- `docs/design/design-system.md` documents components that do NOT exist in `apps/web/src/components/`: SplitText, ScatterText, Typewriter, Reveal, Marquee, HudPanel, Tag, Meter, PostFX, PointerRig, EmberField, PageIntro. What exists: `ui/{hover-card,lightbox,star-button}`, `frame/{frame,frame-image,frame-shapes}`, `text/lamp-text`, `gl/{gl-stage,use-gl-ready}`, `audio/waveform`, `image-viewer/`, `nav/`, `hud/`, `logo/`, `curtain/`, `transition/`, `next-footer/`, `video-player/`, `theme-zone`, `star-glyph`, `focus-star`, `lantern-cursor`, `smooth-scroll`. Trust the code and the About and Collection pages, not that file.
- The same file says "Radius is 0 everywhere, chamfered corners". The pages the owner named (About, Films, Music, Animation, Arts) do not follow it: they use pills and circles. Corner counts across all CSS: `border-radius: 50%` 182, `999px` 85, `8px` 10, `4px` 10, `2rem` 7, `22px` 7, `0` 8. Treat the chamfered `StarButton` and `HudPanel` look as the older HUD voice. New work: pills, circles, rounded media windows.
- Reference voices to copy, in order: `/about` (`features/about/`), the Collection rooms (`features/library/`), the nav and HUD chrome (`components/nav`, `components/hud`).

### 1.2 Palette (hex)

Default world is Daybreak (`<html data-theme="daybreak">`, light). Storm (dark) only where a scene needs it, switch a subtree with `<ThemeZone theme="storm">` (`components/theme-zone.tsx`) or `data-theme` on the element.

| Token                | Daybreak                        | Storm                           |
| -------------------- | ------------------------------- | ------------------------------- |
| `--bg` / `--bg-2`    | `#f4f6f9` / `#e9edf2`           | `#05070c` / `#0a0e16`           |
| `--panel`            | `#ffffff`                       | `#0e141f`                       |
| `--line`             | `rgb(11 11 14 / .14)`           | `rgb(170 196 235 / .2)`         |
| `--line-strong`      | `rgb(11 11 14 / .42)`           | `rgb(190 214 250 / .42)`        |
| `--text`             | `#0b0b0e`                       | `#eef3fa`                       |
| `--text-dim`         | `#3b3f48`                       | `#aab6c8`                       |
| `--text-faint`       | `#626773` (micro labels only)   | `#7d8aa0`                       |
| `--accent` (default) | `#c8006a` hot pink              | `var(--amber)` `#ffa24a`        |
| `--accent-2`         | `#8a5a00`                       | `var(--violet)` `#b59cff`       |
| `--glow`             | `rgb(255 46 144 / .35)`         | `var(--light-amber)`            |
| `--focus`            | `#1336d1`                       | `#ffe58a`                       |
| `--on-accent`        | `#ffffff`                       | `#05070c`                       |
| cyan, gold, amber    | `#00718c`, `#8a5a00`, `#a3460a` | `#5ce1ff`, `#ffcf5c`, `#ffa24a` |
| violet, magenta, red | `#5b3fc4`, `#a8237a`, `#b4192f` | `#b59cff`, `#ff6ac8`, `#ff5468` |
| `--hud-ink`          | `rgb(11 11 14 / .42)`           | `rgb(214 228 250 / .55)`        |

- Constants that never flip (use for glows, particles, art, WebGL): `--ink #05070c`, `--graphite #141a25`, `--ceramic #f3f5f9`, `--light-cyan #5ce1ff`, `--light-gold #ffcf5c`, `--light-amber #ffa24a`, `--light-violet #b59cff`, `--light-magenta #ff6ac8`, `--light-crimson #ff5468`. Never set body text in a `--light-*` colour on Daybreak. Themed accents are tuned to 4.5:1 on their own surface (Lighthouse accessibility is a hard gate, see 3.5).
- Page ground: `body` carries a drafting-paper dot grid, `radial-gradient(circle, color-mix(in srgb, var(--text) 9%, transparent) 1px, transparent 1.4px)` at `28px 28px`. Selection is `--accent` on `--on-accent`.
- Per-room signature colours (`features/library/registry.ts`, `colour`): arts `#e0245e`, video `#2a5bff`, music `#7c4dff`, voicelines `#08a39f`, 3D models `#ff7a1a`, comic `#f0b100`, lore `#2f8f5b`, design `#ff3d97`, animation `#10a5d8`, others `#5d6b82`. Each entry also has `index` ("01".."10"), `tagline`, `line`, `ink`, `cover` (useful for the Archive section copy and tiles).
- Logo and mascot colours: black plate, gold outline, pink mascot (about `#ff2e90`). The About drone is cyan (`--light-cyan` tick). TheMLabel orange is `#f14c02`. Boot cover (`.gate-cover`): `#f4f6f9` ground, `#140e26` ink, `#e040a0` bar.
- `viewport.themeColor #f3f5f9`, manifest `background_color #f4f6f9`.

### 1.3 Type

Four self-hosted `@fontsource` families, imported in `app/layout.tsx` (`big-shoulders-display/wght`, `hanken-grotesk/wght`, `jetbrains-mono/wght` variable; `instrument-serif` 400 and 400-italic).

- Display, `--font-display-stack` (Big Shoulders Display, weight 800): there is no real italic, the browser slants it (`font-synthesis: style`). `h1` to `h4` are already display, italic, `line-height .92`, `letter-spacing -0.01em`, `text-wrap: balance`. The `display` utility adds uppercase and `line-height .86`. Giant headings: About `h2.title` is `font-size: clamp(3.5rem, 11.4vw, 13rem); line-height .84`, set in hand-masked lines.
- Serif, `--font-serif-stack` (Instrument Serif, true italic): narration and lead lines. Pattern: `font-style: italic; font-size: var(--step-2); line-height 1.16; max-width ~31ch; color: var(--text-dim)`. On `/about` the word "Aspirant" is the serif in `--accent`, rotated -4.5deg, overlapping the giant display "ABOUT" (see `about_-0.png`). That overlap of black display and pink serif is the site's signature title.
- Mono, `--font-mono-stack` (JetBrains Mono): every label, counter, button face. `hud-label` = `--step--2`, weight 500, `letter-spacing .14em`, uppercase, tabular numerals, `--text-faint`.
- Body, `--font-body-stack` (Hanken Grotesk), `--step-0`, `line-height 1.6`.
- Fluid scale `--step--2` to `--step-8` (px at 390 / 1440 / 1920): -2 12/12/13, -1 13/14/15, 0 16/18/19, 1 19/22/23, 2 22/27/29, 3 28/35/39, 4 34/48/54, 5 42/66/77, 6 53/92/111, 7 66/133/164, 8 83/185/232.
- Tailwind: `text-step-5`, `font-display`, `font-serif`, `font-mono`, `font-sans`. Letter-spacing in use by count: `.14em` 148, `.1em` 91, `.16em` 91, `.12em` 74, `.2em` 51, `.22em` 43.

### 1.4 Space, grid, hairlines, radius, depth

- Fluid space (px at 390 / 1440 / 1920): 3xs 4/5/5, 2xs 8/9/10, xs 12/14/15, s 16/19/20, m 24/28/30, l 32/39/42, xl 49/59/64, 2xl 65/84/93, 3xl 98/133/149, 4xl 131/183/206. Tailwind prefix `sp-` (`p-sp-m`).
- `--gutter` 18 / 72 / 84 px at 390 / 1440 / 1920 (it clears the HUD rails from 900 px up), `--content-max` 112rem, `--measure` 68ch, `--nav-h` 4rem (5rem from 900 px). Wrap content in `.shell` or use `px-gutter`.
- Hairlines: 1px, `--line` (quiet) or `--line-strong` (rules, buttons, plate edges). Rules draw themselves from the left (`transform: scaleX(0)` to 1, origin `0 50%`, 900 to 1200 ms).
- Radius: pills 999px for chips and buttons, circles for icon buttons (40 to 44 px), media windows `clamp(14px, 1.5vw, 26px)` (About film, `opening/film.module.css`), inner clips `calc(var(--radius) * .4)`.
- Z order: `--z-content 1`, `--z-hud 40`, `--z-nav 50`, `--z-consent 60`, `--z-menu 70`, `--z-popover 75`, `--z-modal 80`, `--z-transition 90`, `--z-cursor 95`, `--z-gate 100`, `--z-skip 110`. About's own stack inside the page: `LAYER = { text 1, drone 2, film 3, cover 6 }` (`features/about/layout.ts`). A home canvas must stay under the bar (50).
- Corner brackets: `components/hud/hud-frame.tsx`, four 22px SVG corners at 14px from the edges (top ones at `nav-h + 10px`), colour `--hud-ink`; a 2px hairline scroll bar at the very top (`scaleX(p)` written on its own ref, never on `<html>`).

### 1.5 Label conventions

- Eyebrow: mono, `--step--2`, `.14em`, uppercase, `--text-dim`, with the number in `--accent`: `01 / THE SERIES`, `02 BRIEFING`. A 2.75rem hairline rule may follow (`.eyebrowRule`). Top strips are three mono labels with a hairline under them: `THEMLABEL SERIES | SINCE JANUARY 2022 | NOW IN PHASE V`.
- Counters: display italic number, huge, with a tiny mono caption at the right edge, a hairline above each row (`10 SKINS`, `5 PHASES`, `4+ YEARS` on `/about`).
- Index and clock readouts: `01 / 10`, `00:07 / 03:00`, mono, `.7rem`.
- Pair labels with a rule between them: `SELENA ---- OBSIDIA`, `03:00 ---- CINEMATIC TRAILER` (Films room, drawn as two mono words and a 1px line).
- Nav right slot: `02 ABOUT` (index in accent, label in `--text-dim`), `.6875rem`, `.16em`.
- Never uppercase body text with CSS when it has a `lang` other than English; copy is written in sentence case and the CSS uppercases only labels.

### 1.6 Buttons and their hover and press

Three live families. Every one is a real `<a>` or `<button>`, 44 px high at least, focus ring `outline 2px var(--focus), offset 3px` (never clip-path a focusable element).

- Pill (newest, About and Collection): `height 2.75rem; padding 0 1.4rem; border 1px solid currentColor (or rgb(255 255 255 / .5) on dark); border-radius 999px; mono .7rem, .14em, uppercase`. Hover (About `.pill` in `mlabel.module.css`): a colour fill rises from below, `::before` `translate3d(0,101%,0)` to `none` in 450 ms on `cubic-bezier(.32,.72,0,1)`. Press: `transform: scale(.96)` in 300 ms `--ease-out`. The Back pill (`features/library/shell/room-chrome.module.css`): arrow nudges `translateX(-3px)` in 240 ms. Primary filled pill (Music room `.primary`): background `--ink`, text white, hover turns the border to the room colour. Round icon buttons: 40 px circle, 1px border.
- Nav plate (`components/nav/nav.module.css .menuButton`): 44 px, `1px --line-strong`, mono `.6875rem .16em`; hover paints an ink layer with `scaleX(0)` to `1` from the left in `--dur-slow` and flips the text colour. Press springs with `--ease-spring`.
- `StarButton` (`components/ui/star-button`): chamfered clip-path plate behind the text (`::before` border, `::after` fill, so the button is never clipped), mono `.8125rem .2em`, height 3.25rem (`lg` 4rem, `sm` 2.75rem), star core icon. Solid has a diagonal sheen that moves on hover (`background-position`, `--dur-slow`); ghost sweeps the fill in from the left. Press: `translateY(1px) scale(.985)`. Used by `NextFooter`, 404 and the story landing. One `pulse` per screen.
- Cards that are links: hover lifts with `transform` only. Hover sound: `audio.blip("hover")` on mouse `pointerenter` only (never touch), `blip("click")` on press. Usage today: click 138, hover 60, whoosh 7, star 6, confirm 3.

### 1.7 Cursor

`components/lantern-cursor.tsx`, fine pointers only, mounted once in the layout, native cursor stays.

- A 36px ring that lags the pointer (`damp` factor 11, 18 when snapped; the dot-disc follows at 32) with a 3px accent diamond in the middle, `1px` border at 55% of `--text`. Over any `a[href], button, [role=button], input, select, textarea, label, summary, [data-cursor]` the ring scales to 1.75 (`damp` 14). On Daybreak there is no glow disc (it is `mix-blend-mode: screen`, Storm only).
- Label plate: `data-cursor="VIEW"` shows an accent plate (`.625rem`, `.18em`, uppercase, `--on-accent`) next to the ring. Words in use by count: VIEW 13, PLAY 13, READ 7, BACK 5, OPEN 4, SHOW 3, NEXT 3, GO 3, ZOOM 2, HEAR/STOP 7, POSE 2, HELLO 2. The owner's "tooltip to view the image" is `data-cursor="VIEW"`, "click to view" is the same attribute.
- `data-snap` on an element pulls the ring onto its centre (`SNAP_SCALE`, ring border turns accent, centre dot hides). `data-cursor-theme="light|dark"` forces the ring colour. `data-state` on the cursor root says idle, hover, snap, pressed. Nothing is ever written to `<html>` per frame (a test guards this).

### 1.8 Motion

- CSS tokens: `--ease-out cubic-bezier(.16,1,.3,1)` (726 uses, the default), `--ease-spring` (a `linear()` spring, 87 uses, overshoot to 1.106, Daybreak feel), `--ease-in-out (.65,0,.35,1)`, `--ease-heavy (.83,0,.17,1)`, `--ease-in (.7,0,.84,0)`. Durations `--dur-instant 90ms, fast 160, base 260, slow 420, slower 700, epic 1100`. JS mirror: `lib/motion.ts` (`easings`, `gsapEase`, `durations`, `springs {soft 170/18, snappy 420/30, heavy 90/20x1.4}`, `springStep`).
- The "house" curve is `cubic-bezier(.32,.72,0,1)` but it is local, defined as `--house` in 8 About stylesheets, not a global token. Other frequent raw curves: `(.2,.8,.2,1)` 25, `(.32,.72,0,1)` 21, `(.22,1,.36,1)` 19, `(.16,1,.3,1)` 11, springy `(.34,1.4,.64,1)` and `(.34,1.56,.64,1)`. GSAP eases in use: `power2.out` 12, `power2.inOut` 10, `power2.in` 10, `sine.inOut` 8, `expo.out` 5, `power1.inOut` 5, `elastic.out(1,.35..0.5)`, `back.out(2..2.4)`.
- Typical durations: reveals 800 to 1100 ms, mask line rise 1000 ms with 80 ms stagger (`calc(var(--i) * 80ms)`), rules 1200 ms, hovers 160 to 450 ms, big scenes 900 ms.
- Reveal grammar (the live one, `features/about/sections/kit.module.css` + `sections/arrive.ts` `useArrive`): markup carries `data-in="false"`; an IntersectionObserver (`rootMargin "0px 0px -14% 0px"`, per-part override `data-in-at="<percent>"`) sets it to `"true"` once; CSS does the rest with transitions of transform and opacity. Hidden states are written only under `:root.js` so no-JS and crawlers see everything. Kinds: `.mask` plus `.line` (`translate3d(0,122%,0)` to 0, `overflow-y: clip`, never clip the slant at the sides), `.rise` (`opacity 0, translate3d(0,1.1rem,0)`), `.rule` (`scaleX(0)` to 1). The watched box never moves, a child does.
- Smooth scroll: Lenis (`components/smooth-scroll.tsx`) `lerp .12, wheelMultiplier 1, touchMultiplier 1.2, syncTouch false`, driven by `gsap.ticker` (`lagSmoothing(0)`), `ScrollTrigger` registered once there and updated on every Lenis scroll. `useLenis()` gives `scrollTo, pause, resume (counted), getLenis`.
- Scroll joins: `useScrollSnap(id, getRange, {idleMs 1500 default (About uses 1000), snapSeconds .9, onSnap})` in `features/character/vexana/seams/snap.ts`; `useScrollLock().lock(limitMs)` in `seams/scroll-lock.ts` swallows wheel, touchmove and scroll keys and pauses Lenis, but releases by itself after `LOCK_LIMIT_MS = 3000` unless the caller passes a longer `limitMs`. `BareScrollbar` (`vexana/shared/bare-scrollbar.tsx`) sets `html[data-bare-scroll]`. `useFreshStart` makes a reload start at the top. `features/about/*` already imports these from `features/character/vexana/*`.
- Page ready: `expectReady(id)` (`lib/page-ready.ts`, 30 s safety cap) holds the curtain until a scene draws. Intro flag: `sessionStorage["aspirants:intro"] === "off"` is how tests skip every intro and hold (About director, TheMLabel, Tetra, roster intro all read it). The home must read it too.

### 1.9 Chrome around every page

- Nav (`components/nav/site-nav.tsx`, `nav.module.css`): fixed, `height var(--nav-h)`, three-column grid `1fr auto 1fr`. Left: MENU plate and SOUND plate (7 bars, "ON" in accent) and `NowPlaying`. Centre: `<TLink class=brand data-logo-host>` holding `<AspirantLogo variant="interactive" class=logo>` (SVG, viewBox `0 0 3018 897`, aspect 3.364; height 2.25rem below 56.3125em, 3.25rem from there, so about 175 x 52 px at 1440). Right: `01 HOME` style label. The plate (`::before`, `--bg` 88%, blur 10px, bottom hairline) shows only after scrolling (`data-scrolled`).
- Hiding bits of the bar: `lib/nav-lock.ts` `useNavLock` zustand store with `theme`, `bare`, `fade`, `away` and nothing for the logo or the buttons. The owner wants an empty bar with no logo during the home opening and the logo morphing into `[data-logo-host]`: that needs a new field in `NavLock` plus `data-*` and CSS in `site-nav.tsx` / `nav.module.css` (shared files, edit once, tell the other implementers). The morph target is the `[data-logo-host] svg` rect (query it, do not hard-code).
- Menu (Radix Dialog) has five titles and the pair art `public/img/menu/<page>-<left|right>.webp` (home pair already exists). Sound: `useSiteStore().muted` defaults to `false` (sound ON); audio unlocks inside the first `pointerdown` or `keydown` (`LoaderGate`) and `audio.unlock()` must be called synchronously in a gesture handler.
- Sticky chrome rule: pages with big canvases use `useNavLock.setState({ theme: "daybreak", bare: true, fade: false, away: false })` in a `useEffect` and reset it on unmount (see `features/about/about-root.tsx`).

### 1.10 What the reference pages look like (observed)

- `/about` (`about_-0.png`): paper ground and dots, giant slanted black ABOUT, pink serif Aspirant over it, three-label mono strip with hairline, big close-up 3D drone cut by the left edge, lead paragraph in the body face at roughly 26 to 28 px, a rounded video preview (1920 by 810, `REEL_ASPECT`) with a round play chip and "OPEN THE FILM" mono caption, counters at the right. Sections below are the kit in 1.8.
- `/collection` (`collection_-0.png`): a WebGL shelf of ten tilted colour covers on two white shelves over a soft grey ground, caption at top left, a bordered "NEXT DESTINATION / CONTINUE TO HOME [N]" plate at top right, a 10-column index row at the bottom (mono number, name, count).
- Films (`collection_video_films_-0.png`): full-bleed film, mono labels at mid-left (`SELENA ---- OBSIDIA` plus the title in display italic), mid-right (`03:00 ---- CINEMATIC TRAILER`), bottom row of outlined pills and 40px round icon buttons, `01 / 10` and the clock.
- Music (`collection_music_-0.png`): large 3D vinyl discs tilted on a light ground, title in display italic 40px, hairline-separated credit rows (mono label left, value right), round platform icons, a black `PLAY 2:55` pill, bottom disclaimer in mono.
- Animation (`collection_animation_-0.png`): dark blue segmented-bar ground, big slanted video cards at angles with a thumbnail strip, display-italic name, a white `LAUNCH` pill with arrow.
- Arts (`collection_arts_-0.png`): centred picture stepper, index list on the left and credit list on the right in faint mono, serif caption under the picture, mono tab row at the bottom, black "TAKEDOWN" chip.
- Old home (`home-0.png`, `home-1.png`) is what is being replaced: portal hero with a character, giant THE ASPIRANTS, a dark chamfered control panel, then a lamp-lit manifesto in condensed serif.
- First-visit loader today (`loader-1500.png`, `loader-4000.png`): the boot cover shows "THE ASPIRANTS" spaced caps, a 2px pink sweep and "Loading the site"; then the logo curtain: logo centred (`layoutFor`: width `min(62% vw, 34% vh * aspect)`, centre at 44% of the height), segmented black bar with `DRAWING THE PAGE` and a percent, corner brackets, hairline crosshair, mono corner labels `SELRICK ACADEMY ARCHIVE` and `A5-01`.

### 1.11 Existing rules that collide with the owner's request (listed, not resolved here)

- "Psychological tricks so it looks like it is still loading" versus "never fake progress, never add a timer that pretends to load" (the root rules file). Rotating notes must be tied to real `PreloadItem.label` values and the percent must be real. After 15 s (`SLOW_AFTER_MS` in `components/loader-gate.tsx`) the screen already says the connection is slow and shows real bytes.
- "Touch anywhere to continue" versus `docs/design/spec.md` 4.1 ("nothing to click"). Keyboard needs Enter and Space too, and the gesture handler must call `audio.unlock()` synchronously.
- "A lite or shorter load for speed" versus "one version, no cut version, wait for the whole waited list". The owner asks that the home loads only first-screen items and streams the rest: that is the `deferred` flag of `PreloadItem` (`priority`, `group`), which already exists.
- Chromatic aberration, the blurred drawer and the video overlay effects versus "no `filter`, `backdrop-filter` or `mix-blend-mode` over the live picture or on an element with animated children". Do them inside the shader or on a baked texture.
- Autoplay: The root rules file lists eight autoplay exceptions. The home trailer, the muted clips and the Selena and Obsidia loops need a ninth entry written into that file.
- "Scroll is locked during the sequence" is allowed (seams lock) but `useScrollLock` releases after 3000 ms unless `limitMs` is passed. No scroll cue inside a join (the rules file's Performance section).
- The sitemap, `/about` has "no shortcut to takedown". Any fan art on the home is non-canon content: a `ReportLink` (`features/legal/takedown/report-link`) and `CanonBadge` and `CreditLine` rules apply to fan art and to pictures marked "Made for this site". The viewer (`components/image-viewer`) takes `credit` and `report`.
- Copy: "2022 [en dash U+2013] Present" in the request must ship as "2022 - Present" (hyphen) or "2022 to Present". The owner's `>` in lines such as `PSYCHOACTIVE > The Aspirants` means "replace the first with the second". "Guienvere" in the voice list is Guinevere. Spelling: Terrinia, Selrick, Storm Citadel, "aspirant power".

## 2. The old home, mapped for clean removal

### 2.1 `apps/web/src/features/home/` (22 files, 5,538 lines, no unit tests)

| File                                                |            Lines | What it was                                                                                                                                                            |
| --------------------------------------------------- | ---------------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data.ts`                                           |              429 | Server only view models: `getPortalPairs`, `getVersusPairings`, `getRoster`, `getContrast`, `getCounters`, `getFanArt`, `fanArtTotal`. Reads `public/data/fanart.json` |
| `types.ts`                                          |              124 | `VoiceRef, PortalFigure, PortalPair, VersusSide, VersusPairing, RosterCard, ContrastView, FanArtView, CounterView`                                                     |
| `hero/PortalHero.tsx`                               |              429 | Hero client island, `expectReady("home-hero")`, plays intro when `useSiteStore().entered` turns true (420 ms later)                                                    |
| `hero/PortalScene.tsx`                              |              237 | R3F scene (`useFrame`, `useThree`), lazy chunk, id `home-scene` in route-preloads                                                                                      |
| `hero/portalController.ts`                          |              310 | Per-frame pointer and portal state                                                                                                                                     |
| `hero/portalShader.ts`                              |              233 | Depth-map portal fragment shader                                                                                                                                       |
| `hero/HeroTitle.tsx`                                |              170 | `h1` with scatter letters (GSAP)                                                                                                                                       |
| `hero/hero.module.css`                              |            1,031 | Hero styles                                                                                                                                                            |
| `manifesto/{Manifesto,Counters,LampRail}.tsx` + css | 40, 76, 67 + 191 | Lamp-lit words (`LampText`), counters, rail                                                                                                                            |
| `versus/VersusStage.tsx` + css                      |        232 + 500 | Off track / on track diagonal split with voice lines                                                                                                                   |
| `before-after/BeforeAfter.tsx` + css                |        108 + 198 | Struck line strip, links to `collectionRoute("lore")`                                                                                                                  |
| `ten/TheTen.tsx` + css                              |        289 + 263 | Draggable rail of ten framed cards                                                                                                                                     |
| `hall/HallOfFame.tsx` + css                         |        196 + 152 | Fan art in frames and `Lightbox`                                                                                                                                       |
| `doors/TwoDoors.tsx` + css                          |         73 + 190 | Story and Collection doors                                                                                                                                             |

### 2.2 Who imports it from outside the folder (the whole blast radius)

- `src/app/page.tsx` imports `BeforeAfter, TwoDoors, HallOfFame, PortalHero, Manifesto, TheTen, VersusStage` and `getContrast, getCounters, getFanArt, fanArtTotal, getPortalPairs, getRoster, getVersusPairings`. It also renders `NextFooter` (`label="About"`, `href={routes.about}`, `image="/img/hero-stills/selena-obsidia-01.webp"`) and exports `metadata = { title: { absolute: "The Aspirants: Someone is always waiting." }, description: siteCopy.meta.home }`.
- `src/lib/route-preloads.ts` line 74 (the `"/"` branch is lines 68 to 84): `import("@/features/home/hero/PortalScene")`, inside the `path === "/"` branch (lines 68 to 84): `chunkItem("home-scene", ..., 4)`, six `imageItem`s (`/img/portal/vexana/{base,depth,alt,depth-alt}.webp`, `/img/char/vexana/splash-sm.webp`, `/img/char/vexana/extra-1.webp`) and `fontsItem()`.
- Nothing else. `knip.jsonc` has no home entry. The only cross-feature dependency pointing out of the folder is `data.ts` importing `chapterName as legacyChapterName` from `@/features/story/chapter-href`; after deletion `chapterName` stays used by `chapter-href.test.ts` only (knip counts test files as entries, so it stays green).
- Other places that mention the route: `components/nav/menu-pairs.ts` (home pair art, keep), `lib/site.ts` (`routes.home`, `navItems[0]`, `isActiveRoute`), `app/sitemap.ts` (`navItems` gives `/` priority 1), `app/not-found.tsx`, `features/legal/legal-page.tsx`, `features/library/shelf/continue-home.tsx` (`router.push(routes.home)`), `manifest.ts` (`start_url`).

### 2.3 What deleting the folder orphans (knip will fail `pnpm check` on these)

Whole files with no user left (verified by grep, not by a dry run): `components/gl/gl-stage.tsx`, `components/text/lamp-text.tsx` and `components/text/text-effects.module.css`, `components/frame/frame.tsx`, `components/frame/frame-image.tsx`, `components/frame/frame.module.css`, `components/ui/lightbox.tsx` and `components/ui/lightbox.module.css`. Stays: `components/frame/frame-shapes.ts` (used by `features/character/art.ts`), `components/gl/use-gl-ready.ts` (7 users), `star-glyph`, `star-button`, `theme-zone`, `next-footer` (5 other pages). `features/character/media.ts` mentions the lightbox only in a comment.

Dependencies that become unused: `@react-three/fiber` (only `gl-stage.tsx` and `PortalScene.tsx` import it) and `@gsap/react` (only `lamp-text.tsx`). Fix, pick one: delete the orphans and remove both from `pnpm-workspace.yaml` catalog, `apps/web/package.json` and the lockfile; or keep using them in the new home; or add them to `apps/web.ignoreDependencies` in `knip.jsonc` (the file already ignores `class-variance-authority` that way). `ogl` (library animation), `three`, `@types/three`, `gsap`, `lenis` stay used elsewhere.

Exports in shared files that only the old home used (`useRafLoop`, `requestTiltPermission`, `useViewport`...) are tagged `@public` in `lib/hooks.ts`, `lib/motion.ts`, `lib/audio.ts`, so knip ignores them. The exported types `UsePointer`, `NavItem`, `StarButtonProps`, `ThemeZoneProps` already have no importer today and knip passes, so nothing to do.

### 2.4 Copy and data tied to the old home

- `content/site-copy.ts`: block `home` (lines 84 to 99: `whatIs`, `versus`, `beforeAfter {before, after, link}`, `theTen`, `hallOfFame`, `doors`) is read only by `features/home/data.ts` and `doors/TwoDoors.tsx`. `meta.home` (line 176, "Ten Aspirants, one academy, and a world that keeps a lamp lit.") is read by `app/page.tsx`. `siteCopy.brand`, `.loader`, `.nav` stay. `brand.tagline` "Someone is always waiting." is also `siteConfig.tagline` and the default title.
- Data that stays because others use it: `public/data/fanart.json` (read by `features/character/media.ts`), `public/data/manifest.json` (same file), `content/characters`, `content/pairs`, `content/world` (`contrasts`) and `content/story` (all are knip entries via `src/content/**`).
- Voice lines referenced by the old versus stage live under `public/audio/voice/<slug>/` and stay.

### 2.5 Assets used only by the old home (small, optional to delete)

- `public/img/portal/{guinevere-vexana,selena-obsidia,vexana}/{base,alt,depth,depth-alt}.webp`: 12 files, 1.8 MB. Used by `features/home`, `route-preloads.ts`, `e2e/a11y.spec.ts:39`, `scripts/assets/portal.mjs` (+ `depth.py`, `build.mjs` STAGES list entry `"portal"`, `scripts/assets/.cache/portal.json`), 12 rows in `public/data/manifest.json` (`kind: image`, `role: portal-base|portal-alt|...`), `docs/design/assets.md`, a mention in `scripts/story/README.md` line 37. `public/data/story/*` does not reference them.
- `public/img/hero-stills/`: only three of sixteen are home-only: `selena-obsidia-01.webp` (NextFooter image), `fanny-layla-02.webp` and `guinevere-vexana-04.webp` (TwoDoors), about 87 KB. The rest are used by `features/character/duo/duo-media.ts` (ruby-angela) and `public/data/library/others.json` + `scripts/library/others/build.py` (`fanny-layla-01`, `guinevere-vexana-01`), or by nothing visible.
- Honest saving: about 1.9 MB of a 4.8 GB `apps/web/out`, and git history keeps the files anyway. Do it last or skip it. If you do it, regenerate `manifest.json` through `scripts/assets/manifest.mjs` (never hand-edit) and drop the `portal` stage together with its script.
- Menu art (`public/img/menu/home-*.webp`), `img/char/<slug>/splash*.webp`, `img/char/<slug>/extra-1.webp` are shared, keep.

### 2.6 Tests that touch the home

No `*.test.*` file exists under `features/home/`. No unit test imports home code. E2E (`apps/web/e2e/`, Playwright against `out/`, projects phone 390x844 dpr2, tablet 820x1180, desktop 1440x900):

- `home.spec.ts` (delete or rewrite whole): 10 tests: loads with one h1 and five h2s and a "Begin the story" link; portal pointer opens and relaxes (`data-portal-radius`); tabs by click and arrows (`#portal-panel`); Toggle form and Hold portal open; touch drag and tap; reduced-motion ignored; versus stage (`#versus-panel`); before and after (`data-state`); the ten (`#ten-rail`, 10 links, arrow keys); hall of fame lightbox; axe after interacting. Launch args `--use-angle=swiftshader`.
- `a11y.spec.ts`: axe (wcag2a, 2aa, 21a, 21aa, 22aa, best-practice; fails on serious or critical) on `ROUTES` including `/`; plus line 39 `page.route("**/img/portal/vexana/depth.webp", hold)` to keep the loader gate up and assert `#site-shell` has `inert === true` while the gate is up and axe is clean. Change the held URL to a file in the new home's waited list.
- `smoke.spec.ts` for `/`: status 200, exactly one visible `h1`, one `main#main`, no horizontal overflow, every `img[src]` answers 200, no console errors or page errors, `networkidle` reached; sitemap contains `/`. `helpers.ts` `streamsVideo(route)` regex decides `load` versus `networkidle`: add `/` there if the home autoplays video, or the wait times out.
- `shell.spec.ts` on `/`: first Tab is the skip link and Enter focuses `main#main`; menu button "Open menu", dialog link "Home" has `aria-current="page"`, "Story" link opens `/story/` with h1 "Aspirant Story"; `getByRole("banner").getByRole("button", { name: "Sound" })` has `aria-pressed="true"` and `M` toggles it; the chain: on `/` a button named `/^Continue to/` opens `/about/`; from `/character/` the chain continues to `/collection/` and then `/` (the shelf's "Continue to Home" must still land on the new home); scrolling to `document.documentElement.scrollHeight` reaches `/about/` within 8 s (twice, the second with `reducedMotion: "reduce"`, which the site ignores). So: a `Continue to ...` control, the `N` key, scroll-to-bottom navigation and no holds when intro is off.
- `menu.spec.ts` and `roster-intro.spec.ts:156`: load `/`, click "Open menu" at once, so Menu and Sound must be present and unblocked when `aspirants:intro` is `off` and `aspirants:entered` is `1`.
- `skipGate(page)` in `e2e/helpers.ts` sets `sessionStorage aspirants:entered=1`, `aspirants:intro=off`, and `localStorage aspirants:consent = rejected`. The new opening, every hold and every scroll lock must be skipped under these flags.
- HANDOFF note: a few home specs flake under load; run with `--workers=3` and alone before believing a failure. E2E needs a fresh `pnpm build` first.

### 2.7 Docs, README, rules that name the old home (update in the same commit)

- `README.md` line 13 (route table row for `/`), line 118 (`scripts/assets/build.mjs` row "...and the home portal faces").
- The root rules file: no section describes the old home; add "The Home page" like "The About page", add the ninth autoplay exception, keep "Continue to Home" queue lines (about line 102). It also says `Light mode by default (data-theme="daybreak")`.
- `docs/HANDOFF.md` line 9 (page list), line 161 (the home contrast text that uses `legacyChapterInfo`), "Repository map" lists `home` among features. `docs/HISTORY.md` lines 9 and 96 are history: append a dated entry, do not rewrite.
- `docs/design/spec.md`: IA table row `/` (line 47) and section 4.2 "Home" (lines 68 to 77, the portal hero, manifesto, versus, strip, ten, hall, doors). `docs/design/design-system.md`: documents `GLStage`, `Frame`, `Lightbox`, `LampText`, route chain (line 108); already stale for SplitText and the rest. `docs/design/assets.md`: lines 11, 40, 105 to 117 (portal images). `docs/design/references.md`: landonorris and kprverse rows. `scripts/story/README.md` line 37.
- New request is already stored at `docs/superpowers/specs/2026-11-18-home-page-request.md` (untracked); the design doc named in its header, `2026-11-18-home-page-redesign.md`, does not exist yet.
- `.github/workflows/ci.yml` verification step still tests `experience/index.html` and `lighthouserc.json` still lists `/experience/index.html` (both redirects now, harmless).

### 2.8 Sitemap, manifest, metadata for `/`

`app/sitemap.ts` adds every `navItems` entry through `absolute(href)` (domain `https://aspirant.cc`, trailing slash); `/` gets `priority: 1`, others 0.8. `app/manifest.ts` `start_url` is `${basePath}/`. Root `app/layout.tsx` sets `metadataBase`, title template `%s | The Aspirants`, default title `The Aspirants: Someone is always waiting.`, `alternates.canonical "./"` (resolves to `/`), openGraph and twitter cards, `app/opengraph-image.png` is the share card. The home page uses `title: { absolute: ... }` so the template is not appended. Keep that and update only the description.

## 3. Gates and tools

### 3.1 `scripts/qa/scan-text.mjs`

- Default roots: `apps/web/src`, `apps/web/public/data`, `docs`, `apps/web/out`. Scanning `out` (4.8 GB) did not finish in over 3 minutes: pass explicit roots, e.g. `node scripts/qa/scan-text.mjs apps/web/src apps/web/public/data docs` (1 second, 1,464 files). Skips `node_modules .next .turbo .git coverage`. Text extensions: ts tsx js mjs cjs jsx json md mdx css html htm txt xml svg yml yaml srt vtt webmanifest rsc.
- Fails on: em dash U+2014, en dash U+2013 (in code, comments, CSS, docs, data, everywhere, including the example "2022 - Present"), the banned synonym for "aspirant power", three misspellings of Terrinia, the parody academy name, and the wrong name for Storm Citadel (word rules are waived only in `docs/design/canon-rules.md`, `docs/OPEN-QUESTIONS.md`, `scripts/qa/scan-text.mjs`). Also, for site text only (anything under `apps/web/src/`, `apps/web/public/data/`, and built pages in `out` except `.js`): the code host name, the repository owner name and the two-word phrase for the project's own code. So a code comment in `apps/web/src` containing those words fails too.
- Today: 1 problem, the en dash in the new request file `docs/superpowers/specs/2026-11-18-home-page-request.md` line 30 column 1969. The first commit must replace it (the digest files in `docs/design/home-reference/` are scanned too).

### 3.2 `pnpm check` (root `package.json`)

`pnpm format:check && pnpm typecheck && pnpm lint && pnpm test && pnpm knip`, in this order, stops at the first failure.

| Step           | Runs                                                                                                                                                                                                                                              | Cold time here (machine busy with other work) |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `format:check` | `prettier --check .` (config `@aspirant/config/prettier`: semi, double quotes, trailing commas all, width 100, LF, `prettier-plugin-tailwindcss` with `cn cva clsx`; `.prettierignore` skips generated library data, story data, `out`, `.next*`) | 181 s                                         |
| `typecheck`    | `turbo run typecheck`: `next typegen && tsc --noEmit` for `apps/web` and `packages/ui` (TypeScript ~6.0, `typedRoutes: true`, include `.next/types`)                                                                                              | 43 s                                          |
| `lint`         | `turbo run lint`: `eslint .` in both (type-aware, `projectService`)                                                                                                                                                                               | 87 s                                          |
| `test`         | `turbo run test`: `vitest run --passWithNoTests`, jsdom, 146 test files, testTimeout 20 s                                                                                                                                                         | about 38 s                                    |
| `knip`         | `knip` (root `knip.jsonc`)                                                                                                                                                                                                                        | 15 s                                          |

- Warm turbo cache replays typecheck, lint and test in under a second each ("FULL TURBO"), so a green run after no change proves nothing. Use `pnpm exec turbo run lint --force`. HANDOFF says "about 2 minutes" on an idle machine; plan on 5 to 6 minutes cold.
- Right now `pnpm check` FAILS at step 1: Prettier flags the untracked request file (not formatted, plus the dash). Husky `pre-commit` runs `lint-staged` (`prettier --write` on staged ts, tsx, js, json, md, css, yml, html), so a commit re-formats staged files by itself; `format:check` still sees an unformatted file that is not staged.
- CI (`.github/workflows/ci.yml`): quality (format, typecheck, lint, knip), unit (test + coverage), build (`pnpm build`, checks `out/index.html`, `404.html`, `story`, `character`, `collection`), e2e matrix phone, tablet, desktop (45 min cap), audit, commitlint (PRs only). Lighthouse (`lighthouserc.json`, desktop preset, `staticDistDir apps/web/out`): `categories:accessibility` minScore 1 is an error on `/index.html` (a fresh browser profile, so the loader gate is up when it audits); best-practices 0.9, seo 0.9 and performance 0.6 only warn. Pages deploy (`pages.yml`) runs on every push to `main`, 8 to 12 minutes.

### 3.3 Lint rules that bite a big animation feature

`packages/config/eslint/{base,next}.mjs`: `recommendedTypeChecked` + `stylisticTypeChecked` + Next core-web-vitals + Prettier compat.

- Errors: `consistent-type-imports` (inline `type` imports), `no-explicit-any`, `no-floating-promises`, `no-misused-promises` (attributes allowed), `no-unsafe-assignment`, `no-unsafe-call`, `no-unsafe-member-access` (three.js loader results and `userData` need typing), `prefer-nullish-coalescing`, `prefer-optional-chain`, `restrict-template-expressions`, `no-unnecessary-type-assertion`, `non-nullable-type-assertion-style`, `array-type: array-simple` (`T[]` for simple, `Array<...>` for complex), `eqeqeq` (null ok), `no-unused-vars` (prefix `_`), `react/jsx-key`. `no-console` warns (allows `warn`, `error`). `@next/next/no-img-element` warns and is silenced with `// eslint-disable-next-line @next/next/no-img-element -- static export, plain img` in 167 places; `react-hooks/exhaustive-deps` is a warning (19 disables).
- The React Compiler rules of `eslint-plugin-react-hooks` 7.1 are ERRORS: `react-hooks/refs` (no `ref.current` read or write during render), `purity` (no `performance.now()`, `Date.now()`, `Math.random()` in render), `immutability` (no mutating props, state or hook results: do not mutate `three` objects held in props or from `useThree`), `set-state-in-effect`, `set-state-in-render`, `globals`, `static-components`, `use-memo`, `preserve-manual-memoization`, `error-boundaries`, `config`, `gating`; `incompatible-library` and `unsupported-syntax` warn. The existing pattern that passes: engines as plain TS classes in `.ts` files (`features/about/drone/*`, `features/library/*/engine.ts`) with a thin `"use client"` component that creates them in `useEffect` and disposes them.
- Knip (`knip.jsonc`): entries are `src/app/**/{page,layout,not-found,error,loading,template,default}.tsx`, `src/app/**/{route,sitemap,robots,manifest}.ts`, `e2e/**`, `src/content/**/*.ts`; project is `src/**/*.{ts,tsx}` and e2e. Anything in the new feature folder that no entry reaches is an "unused file", and an export nobody imports is an "unused export" unless its JSDoc has `@public`. Test files count as entries, so an export used only by its `*.test.ts` is fine. CSS imports are not followed (a hint says so), so an unused `.module.css` is never flagged. `scripts/**` is a second entry set; the model build pages under `scripts/about/*/page/**` are ignored. Unused dependencies fail too (see 2.3).
- Commit rules: `@commitlint/config-conventional` ^21 with body and footer line-length rules off. Header at most 100 characters, type in `feat fix docs style refactor perf test build ci chore revert`, subject not sentence-case or upper-case, no final period (HANDOFF: lowercase subject). Husky `commit-msg` runs it. The root rules file overrides any tool default: no `Co-Authored-By`, no session link, no mention of any assistant or tool in commits, PRs, docs, comments. Check with `git log -1 --format=%B`. Push to `main` when done.

### 3.4 Machine and workflow facts that cost time

- Git Bash turns a lone `/` argument into `C:/Program Files/Git/`: use `MSYS_NO_PATHCONV=1` for routes in env vars. Python is `C:\Users\muham\anaconda3\python.exe` with `-I`. Probes (`scripts/qa/probes/*.cjs`, `lib.cjs` `launch()` uses real Chrome) need `BASE` and write to `OUT`. Playwright bundled Chromium cannot play H.264.
- Helpers must not run `pnpm build` (it replaces `apps/web/out`, which e2e and `serve` use); one session builds, checks, runs e2e and pushes. `apps/web/out` is 4.8 GB; `pnpm build` 1 to 2 minutes. Dev server compile of a heavy route is slow; production numbers differ 2 to 3 times.
- The two tool-written guidance files (one at the repo root, one in `apps/web`) warn: this Next.js (16.4.3) and Turborepo differ from what you remember; read `apps/web/node_modules/next/dist/docs/` (`01-app` guides and API reference) before writing route code. Those files are rewritten by the tools and are untracked here.

### 3.5 Accessibility gates for the home

Axe on `/` with the gate up and after load, Lighthouse accessibility score 1 on `/index.html`, one `h1`, labelled landmarks, every control named, targets 44 px, `aria-hidden` on decorative canvases and floating art, text over images on a scrim, nothing flashing more than three times a second. WebGL must fail soft: smoke and a11y run headless without SwiftShader flags and the page may log no console error when WebGL is missing (a failed scene is handled, not a lite version).

## 4. Proposed structure for the new Home

Route: keep `apps/web/src/app/page.tsx` as a Server Component, the same shape as `app/about/page.tsx`: it exports `metadata` and returns one feature component. Keep the feature folder name `apps/web/src/features/home/` (delete the 22 old files first so no stale import survives). Static export, `trailingSlash: true`, `/` has no dynamic segments.

```
app/page.tsx                      server: metadata (title.absolute kept, new description) + <HomePage />
features/home/
  home-page.tsx                   server: composes the root and every section from the content object
  home-root.tsx                   "use client": useFreshStart, BareScrollbar, useNavLock bare, data-home-phase, store reset
  content.ts                      typed copy and links for every section (plain constants, safe in server and client)
  home-data.ts                    server only: reads fanart.json and the library data files at build time, returns slim props (never imported by a client file)
  layout.ts                       numbers shared by CSS and choreography (track lengths in screens, LAYER map)
  stage-bus.ts                    zustand store: phase of the opening, scroll holds, drone anchors (like features/about/stage-bus.ts)
  preload-items.ts                homeItems(): waited list + deferred items; route-preloads.ts calls it for "/"
  choreo/                         pure, unit-tested arithmetic (spiral, morph, flight paths); no React, no DOM
  opening/  hero/  sections/<name>/  drone/  companions/  silverbolt/  doll/  selena/  tetra/  archive/  footer/
```

- Server versus client: every section's heading, copy and link is rendered by a Server Component from `content.ts` as ordinary `<section aria-labelledby>`, `<h2>`, `<p>`, `<TLink>`, so the static HTML carries all text for crawlers and visitors without JavaScript. Interactive parts are thin `"use client"` islands around that markup (they still render their HTML on the server). Hidden start states live in CSS under `:root.js` only (About's `data-in` pattern) and never in inline styles or in JS that runs before first render. The one `h1` ("The Aspirants") sits in the hero as a visible heading, or with the `.name` visually hidden copy used by `features/about/opening/title.module.css` when the visible title is drawn art.
- `next/dynamic(..., { ssr: false })` is not allowed in a Server Component: every lazy WebGL scene is imported inside a `"use client"` file. Scenes are plain `three` (not R3F), engines in `.ts`, canvases `aria-hidden`, loaded when their section nears the screen except the opening scene, which is waited for through `chunkItem` plus `expectReady("home-opening")`. Keep concurrent WebGL contexts few (About holds at most three: drone, Tetra, the companions).
- Loading: replace the `path === "/"` branch of `lib/route-preloads.ts` with `[...shared, ...homeItems()]` (About does the same with `aboutItems()`); remove its `PortalScene` import. Waited: first screen only (the loader scene, the drone model, fonts, the hero art, the first seconds of the trailer clip). Deferred (`deferred: true`, `priority`, `group`): the far sections, long films, voice lines, the Selena scene and so on. Big media goes through `lib/media-store.ts` (`mediaItem`), small bytes through `cachedFetch`; a changed file under the same URL needs a new cache name in `media-store.ts`.
- First visit versus in-site arrival: the first-visit gate is `components/loader-gate.tsx` (`readEntered()`, `boot()` from the transition provider, logo curtain `components/curtain/logo-curtain.tsx`), shown only when `sessionStorage aspirants:entered` is not `1`. The in-site transitions (`TLink` to `/`) keep the curtain: `lib/route-history.ts` `routeBefore("/")` tells a page whether it was opened from another page. The drone loader is a home-only replacement of the curtain's boot look and still has to honour `html[data-gate]`, `#site-shell inert` while loading, `window.__aspirantsGate`, the 15 s slow note and the offline note (`lib/loading-note.ts`). Open question for the owner's request: it says "when the user first visits from another source"; whether that means only `/` or any landing route is not stated, the old rule paints one loader for any landing page.
- Footer and hand-off to `/about`: write a new footer component for the home (the current `components/next-footer/next-footer.tsx` is used by 5 other pages and must stay as it is). Keep its contract: a button named `Continue to About`, the `N` hotkey, navigation through `useTransitionRouter().push(routes.about, ...)` when the scroll reaches the end (arm at 98 percent, 520 ms lock, cancel below 94 percent in the old one), no holds when `aspirants:intro` is `off`. The About opening is a clock run by `features/about/drone/director.ts` and starts straight at `done` when the page opens part way down, so a drone hand-off needs the About director and `stage-bus.ts` as the contract.
- Shared files an implementer will touch (edit once, announce): `lib/nav-lock.ts`, `components/nav/site-nav.tsx` and `nav.module.css` (logo and buttons hidden during the opening), `lib/route-preloads.ts`, `content/site-copy.ts` (`home` block and `meta.home`), `e2e/helpers.ts`, `e2e/a11y.spec.ts`, the root rules file, `README.md`, the docs in 2.7.
- Assets: site-owned first-paint files go under `public/img/home/`, `public/video/home/`, `public/models/home/` (like `public/models/about/`: `drone.glb` 250 KB, `companion.glb` 241 KB, `tetra.glb` 574 KB), built by a script in `scripts/home/` with a README (never edit outputs by hand). Library media (collection arts, music, voicelines, films) stays in the R2 bucket and is addressed with `libUrl(key)` from `lib/library.ts` and the data files in `public/data/library/*.json`; never copy library media into `public/`. Every public path goes through `asset()`.
- Reuse before writing: `components/image-viewer` (`ImageViewer`, `ViewerImage {src, thumb, alt, width, height, title, set, setLabel, credit, report?}`) for the splash-art preview window; `components/video-player` `PlayerOverlay` for "Play Films"; `features/about/drone/*`, `companions/*`, `tetra/*` for the three models; `features/library/music` disc and audio store ideas for the gramophone; `features/library/voicelines` data for the curated voice rows; `lib/audio.ts` (`playVoice`, `playMusic`, `blip`) and `useVoiceState`.
- Tests to add with the rebuild: unit tests for `choreo/` and `content.ts` (copy has no banned characters), `e2e/home.spec.ts` rewritten for the contracts in 2.6 (one h1, sections present by heading, links to `/about`, `/collection/video/films/`, `/story`, `/collection/animation/`, `/collection/voicelines/`, `/collection/comic/`, `/collection/arts/fanart/`, no overflow, no console errors without WebGL), and a probe `scripts/qa/probes/home.cjs` in the style of `about.cjs`.

## 5. One-page checklist of gotchas

1. The request file breaks `format:check` and `scan-text` today (unformatted, en dash on line 30). Fix before anything else or `pnpm check` is red from step 1.
2. Deleting the old home without handling `@react-three/fiber` and `@gsap/react` turns knip red (unused dependencies), and five component files become unused files.
3. Every intro, hold and scroll lock needs the `aspirants:intro = off` and `aspirants:entered = 1` escape; the existing e2e suite depends on Menu, Sound, the skip link, a `Continue to` button and scroll-to-bottom reaching `/about/` all working at once.
4. `useScrollLock` lets go after 3 s unless told otherwise; no scroll cue inside a join; joins snap after one quiet second.
5. React Compiler lint rules are errors; keep three.js and GSAP state out of component bodies.
6. Only `transform` and `opacity` animate; no `filter`, `backdrop-filter` or blend over live pictures; chromatic aberration and blur go in shaders or baked textures; no per-frame writes on `<html>` or `<body>`.
7. One version only: nothing is gated on device, connection or reduced motion; a missing WebGL is a handled failure, not a lite variant.
8. All text in the server HTML; start states under `:root.js`; exactly one h1.
9. Dashes: none, in code, comments, copy, docs. Hyphen for "2022 - Present".
10. Do not run `pnpm build` from a helper; judge speed on a production build, not on the dev server that currently owns port 3000.
