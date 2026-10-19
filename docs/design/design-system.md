# The Aspirants: design system and shell

Read this and `spec.md` before you build a page. The `/kit` reference page existed during development and has been removed; the pages themselves are the reference now.

Contents: [Run it](#run-it) · [Tokens](#tokens) · [Utilities](#utilities) · [The shell](#the-shell) · [Components](#components) · [Hooks and lib](#hooks-and-lib) · [Audio](#audio) · [Motion rules](#motion-rules) · [Accessibility rules](#accessibility-rules) · [Responsive rules](#responsive-rules) · [How to build a page](#how-to-build-a-page)

## Run it

```bash
# Private dev server (port 3000 is the owner's preview). Pick your own port and dist dir.
NEXT_DIST_DIR=.next-<you> pnpm --filter @aspirant/web exec next dev -p 3101
# PowerShell
$env:NEXT_DIST_DIR=".next-<you>"; pnpm --filter @aspirant/web exec next dev -p 3101

pnpm check                    # format, typecheck, lint, unit tests, knip
pnpm build                    # static export to apps/web/out
BASE_PATH=/aspirant pnpm build  # production base path (Git Bash: prefix MSYS_NO_PATHCONV=1)
pnpm test:e2e                 # Playwright on the export: phone, tablet, desktop
node scripts/qa/scan-text.mjs # dashes and banned words
```

The e2e server detects the base path from `out/index.html`, so the same command tests both builds. Tests skip the loader by setting `sessionStorage["aspirants:entered"] = "1"` (see `apps/web/e2e/helpers.ts`).

## Tokens

All tokens live in `apps/web/src/styles/tokens.css`. Tailwind utilities map onto them (`apps/web/src/app/globals.css`).

### Two worlds

`data-theme="storm"` (void black, the default on `<html>`) and `data-theme="daybreak"` (white ceramic). Every themed token flips inside an element with `data-theme`, so a section switches world with `<ThemeZone theme="daybreak">`.

| Token                                                | Use                                                                  | Tailwind                            |
| ---------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------- |
| `--bg`, `--bg-2`                                     | page and raised surfaces                                             | `bg-bg`, `bg-bg-2`                  |
| `--panel`, `--panel-glass`                           | panels (solid, translucent)                                          | `bg-panel`                          |
| `--line`, `--line-strong`                            | hairlines, borders                                                   | `border-line`, `border-line-strong` |
| `--text`                                             | headings, primary text (17:1 or more)                                | `text-text`                         |
| `--text-dim`                                         | body text (9.8:1 storm, 8.5:1 daybreak)                              | `text-text-dim`                     |
| `--text-faint`                                       | micro labels only (4.5:1 or more)                                    | `text-text-faint`                   |
| `--cyan --gold --amber --violet --magenta --crimson` | accents, tuned per theme to read at 4.5:1 or more on every surface   | `text-cyan`, `bg-gold`...           |
| `--focus`                                            | focus ring (gold white on storm, blue on daybreak)                   | `outline-focus`                     |
| `--accent`, `--accent-2`, `--glow`                   | per page or per component colour (characters set their palette here) | `text-accent`, `bg-accent`          |
| `--on-accent`                                        | text on an accent fill                                               | `text-on-accent`                    |
| `--scrim`                                            | modal backdrops                                                      |                                     |

Constant (never flips): `--ink` (#05070c), `--graphite`, `--ceramic` (#f3f5f9) and the bright light colours `--light-cyan --light-gold --light-amber --light-violet --light-magenta --light-crimson` for glows, particles and art overlays. Do not set body text in a `--light-*` colour on Daybreak.

Character palette: set it on a wrapper, everything inside follows.

```tsx
<div style={{ "--accent": "var(--magenta)", "--glow": "var(--light-magenta)" } as CSSProperties}>
```

### Type

| Voice                     | Family                           | Class                                           |
| ------------------------- | -------------------------------- | ----------------------------------------------- |
| Display, condensed, heavy | Big Shoulders Display (variable) | `display` (upper case, tight) or `font-display` |
| Narration, italic too     | Instrument Serif                 | `serif` (+ `italic`)                            |
| HUD labels, numbers       | JetBrains Mono (variable)        | `mono`, `hud-label`                             |
| Body                      | Hanken Grotesk (variable)        | default on `body`                               |

All four are self-hosted through `@fontsource` packages (imported in `app/layout.tsx`). Japanese falls back to the system CJK fonts.

Fluid scale from a 320 px to a 3440 px viewport: `--step--2` to `--step-8`, utilities `text-step--2` ... `text-step-8`. Body is `step-0` (16 to 21 px). Page titles use `step-7` or `step-8`, section titles `step-5`, leads `step-2` or `step-3`.

### Space, shape, depth

- Fluid space `--space-3xs` ... `--space-4xl`. Tailwind: `p-sp-m`, `gap-sp-xs`, `mt-sp-2xl` (the `sp-` prefix keeps Tailwind's own sizes such as `max-w-xl` intact).
- `--gutter` (page side padding; on desktop it also clears the HUD rails), `--nav-h`, `--measure` (68ch), `--content-max`. Tailwind: `px-gutter`, `top-nav`, `scroll-mt-nav`.
- Radius is 0 everywhere. Corners are cut with clip-path: `--cut` (14 px), `--cut-sm`, `--cut-lg`.
- Z order: `--z-ember 0`, `--z-content 1`, `--z-hud 40`, `--z-nav 50`, `--z-menu 70`, `--z-popover 75`, `--z-modal 80`, `--z-transition 90`, `--z-cursor 95`, `--z-gate 100`, `--z-skip 110`. Tailwind: `z-(--z-modal)`.

### Motion tokens

CSS: `--ease-out`, `--ease-in`, `--ease-in-out`, `--ease-heavy` (Storm), `--ease-spring` (Daybreak, a `linear()` spring), `--dur-instant 90ms`, `--dur-fast 160ms`, `--dur-base 260ms`, `--dur-slow 420ms`, `--dur-slower 700ms`, `--dur-epic 1100ms`.

JS (`@/lib/motion`): `easings` (bezier arrays for Motion), `gsapEase` (`out: "expo.out"`, `heavy: "power4.inOut"`...), `durations` (seconds), `durationsMs`, `springs` (`soft`, `snappy`, `heavy`), `springStep(state, target, dt, config)` for hand-rolled springs, `cssEase(name)`.

## Utilities

Declared with `@utility` in `styles/utilities.css`, so variants work (`md:chamfer`).

| Class                                   | Effect                                                                                         |
| --------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `display`, `serif`, `mono`, `hud-label` | type voices (`hud-label`: mono, upper case, tracked, `--text-faint`)                           |
| `shell`                                 | content width plus `--gutter` side padding                                                     |
| `below-nav`                             | top padding that clears the fixed nav                                                          |
| `chamfer`, `chamfer-4`                  | cut corners (2 or 4), size with `--cut`                                                        |
| `scanlines`, `scan-band`                | CRT lines; a slow light band                                                                   |
| `grid-hex`, `grid-dots`                 | hex or dot grid behind content (`--grid-color`, `--grid-size`)                                 |
| `fade-edges`                            | radial mask so grids do not end in a hard line                                                 |
| `link`                                  | inline link with a directional underline                                                       |
| `lantern-mask`                          | masks the element to the lantern disc (needs `data-lantern` on an ancestor, see LanternCursor) |
| `text-balance`                          | Tailwind's own                                                                                 |

Never put `clip-path` on a focusable element: it clips the focus outline. Clip a background layer (pseudo element or child) instead. Every component here follows that rule.

## The shell

`app/layout.tsx` renders, in order: boot script (sets `html.js`, `data-motion`, `data-pointer`, and `data-gate` before paint), `#site-shell` (skip link, `EmberField`, `SiteNav`, `HudFrame`, `<main id="main" tabIndex={-1}>`), `LanternCursor`, `FocusStar`, `LoaderGate`. Providers (`SiteProviders`): store hydration and `<html>` attribute sync, `SmoothScrollProvider`, `TransitionProvider`, Radix `TooltipProvider`.

There is no site footer: every page ends with a `NextFooter`.

### Routes and the next chain

`/` → `/experience/` → `/story/` → `/character/` → `/collection/` → `/`. Character pages loop in queue order (`fanny` ... `selena` → `fanny`). The static export uses trailing slashes; write hrefs without them (`routes.story` is `"/story"`), Next adds them.

```ts
import { routes, characterRoute, navItems } from "@/lib/site";
import { CHARACTER_SLUGS, CHARACTER_NAMES, nextSlug, prevSlug, isCharacterSlug } from "@/lib/slugs";
```

## Components

Each export has a TS doc comment in its file. Paths are under `apps/web/src`.

### Layout and world

**`ThemeZone`** `@/components/theme-zone`: `{ theme: "storm" | "daybreak"; as?: tag; surface?: boolean (paint the bg, default true) } & HTML attributes`. Server rendered.

```tsx
<ThemeZone theme="daybreak" aria-labelledby="places-title" className="py-sp-2xl">
  <h2 id="places-title">Where you are</h2>
</ThemeZone>
```

**`PageTheme`** same file: `<PageTheme theme="daybreak" />` switches `<html>` for a whole page after hydration. Prefer `ThemeZone`.

**`PageIntro`** `@/components/page-intro`: stub hero (`code`, `title` as the h1, `lead`, `note`, `theme`). Replace it with your own hero.

### Navigation

**`TLink`** `@/components/transition/t-link`: every internal link. Renders Next `<Link>` (real `<a>`, prefetch, base path). Plain left click runs the hexagon transition; modifier keys, middle click, `target` and `download` behave natively. External URLs (`https://...`) open in a new tab. Props: Link props plus `href: Route | ExternalHref`, `transitionLabel?`, `transition?: boolean`, `blip?: boolean`.

```tsx
<TLink href={characterRoute("layla")} transitionLabel="Layla" className="link">
  Layla
</TLink>
```

**`useTransitionRouter()`** `@/components/transition/transition-provider`: `{ push(href, { origin?, label? }), prefetch(href), isTransitioning(), reveal({ tone }) }`. The iris covers, navigates, scrolls to top, reveals, then focuses `<main>`. Reduced motion: a 150 ms crossfade.

```tsx
const router = useTransitionRouter();
router.push(routes.collection, { label: "Collection", origin: { x: e.clientX, y: e.clientY } });
```

**`NextFooter`** `@/components/next-footer/next-footer`: `{ eyebrow?: string (default "Next destination"); label: string; sublabel?: string; href: Route; image?: string (public path, decorative); accent?: string }`. 140 vh region, sticky stage, ring fills with scroll, opens `href` at 98 percent (scroll back to cancel), Continue button, `N` key, polite live announcement. Reduced motion: no auto-advance. Exactly one per page, last in `<main>`.

```tsx
<NextFooter
  label="Layla"
  sublabel="Unit 02 of 10"
  href={characterRoute("layla")}
  image="/img/char/layla/splash.webp"
  accent="var(--cyan)"
/>
```

**`SiteNav`**, **`HudFrame`**, **`LoaderGate`**, **`LanternCursor`**, **`FocusStar`**, **`EmberField`** (fixed) are mounted once in the layout. Do not mount them again.

### Buttons

**`StarButton`** `@/components/ui/star-button`: the primary action. `{ variant?: "solid" | "ghost"; size?: "sm" | "md" | "lg"; emblem?: boolean (icon only, needs aria-label); pulse?: boolean; arrow?: boolean; href?: Route (renders a TLink); transitionLabel?; blip?: BlipKind | false } & button attributes`. One `pulse` per screen.

```tsx
<StarButton pulse onClick={start}>Enter the archive</StarButton>
<StarButton variant="ghost" href={routes.story}>Read the world</StarButton>
<StarButton emblem size="sm" aria-label="Play line 3" aria-pressed={playing} data-cursor="PLAY" />
```

**`SoundToggle`**, **`MotionToggle`** `@/components/hud/preference-toggles`: `{ labeled?: boolean; className? }`. `MotionToggle` is in the HUD and the menu. The nav has its own `SoundButton` (below); use these toggles in a page only for an in-context control.

### Text

All text effects keep the full text for assistive tech (a visually hidden copy) and put the split spans under `aria-hidden`. Under reduced motion they render static. Before hydration, text is visible (no-JS safe).

**`SplitText`** `@/components/text/split-text`: `{ text: string; as?: tag (default "span"); by?: "chars" | "words" | "lines" (default "words"); trigger?: "mount" | "inview"; delay? (s); stagger? (s); className? }`.

```tsx
<SplitText as="h2" by="chars" className="display text-step-6" text="The Aspirants" />
```

**`ScatterText`** `@/components/text/scatter-text`: letters scatter from the pointer or finger and spring back. `{ text; as?; radius? (90); strength? (1); className?; letterClassName? }`.

```tsx
<ScatterText as="h1" text="Selena" className="display text-step-8" />
```

**`LampText`** `@/components/text/lamp-text`: words light up as the block scrolls past, like a lamp moving over it (ScrollTrigger scrub). `{ text; as? ("p"); start? ("top 80%"); end? ("bottom 45%"); className? }`.

```tsx
<LampText
  className="max-w-[24ch] serif text-step-4"
  text="Aspirant is a story about ten Aspirants..."
/>
```

**`Typewriter`** `@/components/text/typewriter`: `{ text; as?; speed? (38 chars/s); startDelay? (s); trigger?; caret? (true); onDone?; className? }`.

```tsx
<Typewriter trigger="inview" className="mono" text="Resonance link established." />
```

### Panels and bits

**`HudPanel`** `@/components/ui/hud-panel`: chamfered panel with corner ticks and a mono header. `{ label?; code?; scan?: boolean; accent?; tone?: "solid" | "glass"; as?; className?; bodyClassName? }`. No hooks, usable in server components.

```tsx
<HudPanel label="Unit 07 / Twilight Star" code="SYNC 1.62" accent="var(--violet)">
  <p className="m-0 text-text-dim">Age 15. Daybreak.</p>
</HudPanel>
```

**`Tag`** `@/components/ui/tag`: `{ variant?: "outline" | "solid" | "warn"; accent? }`. Use `warn` for "Non-canon parody". With `solid`, pass a themed token (`var(--violet)`), not a `--light-*` colour.

**`Meter`** `@/components/ui/meter`: segmented coupling meter, `role="meter"`. `{ value; max? (1); segments? (20); label; showValue?; format?; orientation?: "horizontal" | "vertical"; accent? }`.

```tsx
<Meter label="Coupling" value={2.1} max={2.5} format={(v) => v.toFixed(2)} />
```

**`Marquee`** `@/components/ui/marquee`: `{ speed? (40 px/s); reverse?; pauseOnHover? (true); gap?; label? }`. Copies are `aria-hidden` and `inert`; stops off screen and under reduced motion.

**`Reveal`** `@/components/ui/reveal`: in-view reveal wrapper. `{ as?; variant?: "fade-up" | "fade" | "mask-up" | "scale" | "clip"; delay? (ms); once? (true) }`.

```tsx
<Reveal variant="mask-up">
  <h2 className="display text-step-5">The ten</h2>
</Reveal>
```

### Frames

**`Frame`** `@/components/frame/frame`: `{ shape?: "chamfer" | "hex" | "star" | "arch" | "parallelogram" | "rift" | "bite" | "ticket" | "circle" | "emblem"; tilt? (true); maxTilt? (8); glow? (true); accent?; label? (HUD caption); as?: "div" | "figure" | "li" | "article" | "section" | "span"; mediaClassName? }`. Size it from outside (width, aspect ratio). `circle`, `bite`, `emblem` and `hex` want a square box. For a linked frame, wrap the Frame in a TLink.

**`FrameImage`** `@/components/frame/frame-image`: `{ src; alt; width; height (all required); parallax?: boolean | number; priority?; sizes?; srcSet?; objectPosition? }`. Lazy by default; `src` goes through `asset()`.

```tsx
<Frame
  as="figure"
  shape="hex"
  accent="var(--magenta)"
  label="UNIT 08 / TWILIGHT STAR"
  className="aspect-square w-64"
>
  <FrameImage
    src="/img/char/vexana/splash-sm.webp"
    alt="Vexana"
    width={800}
    height={450}
    parallax
  />
</Frame>
```

Shape data (`@/components/frame/frame-shapes`): `FRAME_SHAPE_NAMES`, `FRAME_SHAPES` (vertices as `[x%, x px, y%, y px]`), `FRAME_CLIP_PATHS` (CSS `polygon()` strings), `framePoints(shape, w, h)`, `framePath(shape, w, h)` for your own SVG or canvas work.

### Overlays

**`HoverCard`** `@/components/ui/hover-card`: entity card for running text. `{ children (trigger text); card: ReactNode; accent?; label?; className? }`. Opens on hover (150 ms intent), focus and tap; Esc closes; portal with viewport-aware placement; `aria-describedby` while open. If the card holds a link, click or Enter pins it and moves focus inside.

```tsx
<p>
  In Tanner's Row, <HoverCard card={<EntityCard id="layla" />}>Layla</HoverCard> waits.
</p>
```

**`Lightbox`** `@/components/ui/lightbox`: `{ items: LightboxItem[] ({ type: "image" | "video"; src; alt; width; height; caption?; credit?: { name; href? }; poster? }); index: number | null; onIndexChange; label? }`. Focus trap, Esc, arrows, swipe, credits. Always credit fan art.

```tsx
const [i, setI] = useState<number | null>(null);
<Lightbox items={art} index={i} onIndexChange={setI} label="Hall of fame" />;
```

**`Dialog`** `@/components/ui/dialog`: `Dialog`, `DialogTrigger`, `DialogContent`, `DialogTitle`, `DialogDescription`, `DialogClose` (Radix, themed). For bespoke modals use `Dialog` from `radix-ui` directly and pause scrolling with `useLenis().pause()`.

### Light, particles, WebGL

**`EmberField`** `@/components/ember-field`: `{ contained?: boolean; theme?: "storm" | "daybreak"; density? (1); className? }`. Fixed in the layout already. For one section: put it first inside a `relative isolate overflow-hidden` block.

```tsx
<ThemeZone theme="daybreak" className="isolate overflow-hidden">
  <EmberField contained />
  <div className="relative">...</div>
</ThemeZone>
```

**`LanternCursor`** (layout): pointer devices only. On any element: `data-cursor="PLAY"` shows a label on the ring, `data-cursor-theme="light" | "dark"` forces its colour. Lantern reveals: mark a block with `data-lantern` (it receives local `--mx/--my`) and put the `lantern-mask` utility on the layer to reveal. `<html>` also gets `--lx/--ly` (viewport px) and `data-lantern="on"`. Content revealed this way must also exist in readable form (touch has no lantern).

```tsx
<div data-lantern className="relative">
  <p className="text-text-faint">The window is dark.</p>
  <p aria-hidden className="absolute inset-0 text-gold lantern-mask">
    The lamp is on.
  </p>
</div>
```

**`GLStage`** `@/components/gl/gl-stage` (default export): R3F `<Canvas>` with DPR capped at 1.75, frame loop paused off screen and in hidden tabs, WebGL check and error boundary. `{ children; fallback?: ReactNode; camera?; dpr?; eventSource?; label?; className? }`. Always load it with `next/dynamic` and `ssr: false`.

**`PointerRig`** `@/components/gl/pointer-rig`: damped camera that follows the shared pointer. `{ strength? (0.35); rotate? (0.08); damping? (4); lookAt?; tilt? }`.

**`PostFX`** `@/components/gl/post-fx`: bloom plus optional chromatic aberration. `{ bloom?: boolean | { intensity?; threshold?; radius? }; chromatic?: boolean | number; enabled? }`. Off on weak devices and under reduced motion.

**`useGLReady()`**, **`hasWebGL()`** `@/components/gl/use-gl-ready`: `{ supported: boolean | null; tier; reduced; ready }`.

```tsx
const GLStage = dynamic(() => import("@/components/gl/gl-stage"), { ssr: false });
const Scene = dynamic(() => import("./portal-scene"), { ssr: false });
<GLStage camera={{ position: [0, 0, 5], fov: 40 }} fallback={<StaticArt />}>
  <Scene />
</GLStage>;
```

### Audio UI

**`Waveform`** `@/components/audio/waveform`: `{ url?: string; color?; bars? (48); className? }`. Draws the shared analyser while its voice line plays; decorative.

```tsx
<StarButton emblem aria-label="Play line 1" onClick={() => void audio.playVoice(src)} />
<Waveform url={src} className="h-10 w-48" />
```

## Hooks and lib

| Import                                                 | What                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `asset(path)` `@/lib/asset`                            | prefix any public file URL with the base path (idempotent, external URLs pass through). Never hardcode `/img/...` in `src`, `href` or `fetch`.                                                                                                                                     |
| `withBase(href)`                                       | base path plus trailing slash for a raw `<a>` or a share URL. `TLink` does not need it.                                                                                                                                                                                            |
| `useSiteStore` `@/lib/stores`                          | `{ entered, setEntered, muted, setMuted, toggleMute, motion: "auto" \| "reduced", setMotion, theme, setTheme, lastChapter, setLastChapter }`. `muted`, `motion`, `lastChapter` persist in localStorage (`aspirants:prefs`, validated with zod); `entered` lives in sessionStorage. |
| `useReducedMotion()` `@/lib/hooks`                     | OS setting or the in-app toggle. `prefersReducedMotion()` for handlers.                                                                                                                                                                                                            |
| `usePointer({ tilt? })`                                | `{ ref, subscribe }`: one shared, smoothed pointer for mouse, touch and pen (`x, y` in -1..1, `clientX/Y`, `speed`, `type`, `active`, `tiltX/Y`). Read `ref.current` in rAF; no re-renders. `requestTiltPermission()` from a tap on iOS.                                           |
| `useMediaQuery(q)`, `useIsTouch()`, `useViewport()`    | `useViewport` gives `{ w, h, aspect, orientation, isUltrawide (21:9+), isTall }`                                                                                                                                                                                                   |
| `useInView(ref, { rootMargin, threshold, once })`      | IntersectionObserver as state                                                                                                                                                                                                                                                      |
| `useRafLoop((dt, t) => ..., enabled)`                  | rAF loop, paused in hidden tabs, `dt` capped                                                                                                                                                                                                                                       |
| `usePageVisible()`, `useMounted()`                     | visibility; client-only gate without hydration mismatch                                                                                                                                                                                                                            |
| `useHotkey("n", handler)`                              | single-key shortcut, ignored while typing or with modifiers                                                                                                                                                                                                                        |
| `useScrollProgress(cb)`, `useThemeAt(point)`           | page progress 0..1; theme under a viewport point (for fixed UI)                                                                                                                                                                                                                    |
| `useVoiceState()`                                      | `{ url, playing }` of the current voice line                                                                                                                                                                                                                                       |
| `useLenis()` `@/components/smooth-scroll`              | `{ scrollTo(target, { offset, immediate, duration }), pause(), resume(), getLenis() }`                                                                                                                                                                                             |
| `useDeviceTier()`, `detectDeviceTier()` `@/lib/device` | `"low" \| "mid" \| "high"` from hardware hints and a short FPS probe                                                                                                                                                                                                               |
| `@/lib/math`                                           | `clamp`, `lerp`, `damp`, `map`, `smoothstep`, `wrap`, `mulberry32`                                                                                                                                                                                                                 |
| `cn` `@aspirant/ui/lib/utils`                          | class merge                                                                                                                                                                                                                                                                        |

GSAP: `ScrollTrigger` is registered once by `SmoothScrollProvider` (Lenis drives the GSAP ticker). Import `gsap` and `ScrollTrigger` normally and use `useGSAP` from `@gsap/react` for cleanup.

## Audio

`import { audio } from "@/lib/audio"`. One Web Audio graph; nothing throws.

| Call                                                                        | Notes                                                                                                                          |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `audio.unlock()`                                                            | call synchronously inside a click, tap or key handler. The loader's Enter and the sound toggle do it.                          |
| `audio.blip(kind)`                                                          | `"hover" \| "click" \| "confirm" \| "whoosh" \| "star" \| "error"`, synthesised, rate limited, silent when muted or locked     |
| `audio.playVoice(url, { onEnd, volume })`                                   | decodes and plays one line through the shared analyser, stops the previous line, ducks music. Resolves `true` when it started. |
| `audio.preloadVoice(url)`, `audio.stopVoice()`                              |                                                                                                                                |
| `audio.getAnalyser()`                                                       | `AnalyserNode` for waveforms (null before unlock)                                                                              |
| `audio.onVoiceChange(cb)`, `audio.getVoiceState()`                          | or `useVoiceState()`                                                                                                           |
| `audio.playMusic(url, { loop, volume, fadeMs })`, `audio.stopMusic(fadeMs)` | crossfades between two media elements                                                                                          |
| `audio.setMuted(bool)`                                                      | the store does this; use `useSiteStore().toggleMute` in UI                                                                     |

Always pass file URLs through `asset()`. Voice and music are AAC `.m4a`. `M` toggles sound everywhere.

## Motion rules

- Daybreak motion is springy (`--ease-spring`, `springs.soft`); Storm motion is slow and heavy (`--ease-heavy`, `springs.heavy`).
- Animate `transform` and `opacity` only. No layout properties in loops. Read layout, then write.
- Loops run on rAF, stop when settled, pause in hidden tabs (`useRafLoop`, `usePageVisible`) and off screen (`useInView`).
- Listeners are passive; clean up on unmount; GSAP through `useGSAP`.
- Reduced motion (OS or toggle, `html[data-motion="reduced"]`): no particles, no parallax, no pinning, no tilt, no auto-advance; crossfades only. CSS animations are already cut globally; check `useReducedMotion()` before any JS motion. Content and interaction stay.
- No scroll-jacking. Keep pinned sections short. Lenis smooths native scroll.
- Hover sound: `blip("hover")` on mouse pointerenter only, never on touch.

## Accessibility rules

Lighthouse accessibility 100 is a hard gate. axe runs on every route in e2e.

- One `h1` per page (the page's title). Sections use `h2` with `aria-labelledby`.
- Landmarks: the layout gives `header` (nav) and `main` (the HUD frame is decorative and hidden from assistive tech). Pages add `section`s. No content outside `main`.
- Every control has a name. Icon buttons get `aria-label`; toggles use `aria-pressed`; the visible label must be part of the accessible name.
- Focus: the global outline plus the `FocusStar`. Never remove outlines. Never clip a focusable element.
- Every hover effect has a focus and a tap equivalent. Touch targets at least 44 px.
- Modals (Radix) trap and restore focus. Nothing else traps focus. Duplicated decorative content is `aria-hidden` and `inert`.
- Contrast: body copy in `--text` or `--text-dim`; `--text-faint` only for micro labels; accents only from the themed tokens. Text over images needs a scrim.
- Images: `alt` describes the art ("Layla, official splash art"); decorative backdrops use `alt=""`. Fan art always shows the artist credit and link.
- Motion: respect `useReducedMotion()`; nothing flashes more than three times a second.

## Responsive rules

- Design at 360, 768, 1280, 1920 and 2560, check 320 and 3440, portrait and landscape, and 21:9 and 32:9 (`useViewport().isUltrawide`) and tall phones (`isTall`).
- Breakpoint for the shell is 900 px: above it the HUD lives in the side rails (inside `--gutter`); at 900 and below the HUD becomes a 2 px top progress bar. The nav is the same at every size (menu and sound left, logo centre on 768 px and up, logo right below that).
- Use `shell` (or `px-gutter`) for page content so nothing sits under the HUD rails. Full-bleed art is fine; text is not.
- Use `dvh`/`svh` for full-height blocks, `env(safe-area-inset-*)` at screen edges.
- No horizontal scroll at any size (e2e checks `scrollWidth <= innerWidth`). Long display words: `break-words` and fluid steps.
- Ultrawide: cap text at `--measure` and spread art, not text.

## How to build a page

1. Put the route in `app/<route>/page.tsx` (server component). Export `metadata` (`title` only: the template adds " | The Aspirants"; plus a plain `description`).
2. Put page code in `src/features/<page>/`. Client islands get `"use client"`; heavy scenes load with `next/dynamic` and `ssr: false`.
3. Start with your hero and exactly one `h1`. Use `ThemeZone` for each section's world. Keep text in `shell`.
4. Every public file through `asset()`. Every internal link through `TLink` or `StarButton href`. Content from `src/content` or `public/data`, never invented lore (see `canon-rules.md`).
5. Interactive things: hover, `focus-visible`, active and touch states, sound blips on mouse hover and click, `data-cursor` labels where useful.
6. Check reduced motion (toggle in the HUD) and keyboard only (Tab, Enter, Space, Esc, `N`, `M`).
7. End with one `NextFooter` pointing to the next stop in the chain.
8. Run `pnpm check`, `pnpm build`, `pnpm test:e2e` and `node scripts/qa/scan-text.mjs`. No em dashes, no en dashes, anywhere.

## Additions

Primitives that page engineers added to shared code. One line each.

- `audio.getMusicElement()`, `audio.getMusicAnalyser()`, `audio.pauseMusic()`, `audio.resumeMusic()`, `audio.setMusicVolume(v)` (`lib/audio.ts`, Collection): a music player needs time, seeking, pause and a level. The music analyser is separate from the voice analyser, so voice waveforms never draw the music.

## Navbar and menu

`components/nav/`. The bar is sticky and never hides. Left: the **Menu** plate button (opens the menu) and the **sound button**. Centre: the large vector logo (`AspirantLogo`, 52 px on desktop, 36 px on phones). Right: the current page ("03 Story"). `--nav-h` is 4 rem, 5 rem from 900 px.

**Sound button** (`sound-button.tsx`). Seven bars driven on the GSAP ticker. Sound on: the bars move like a waveform. Off: they ease into a flat line of dots. Hover lifts the wave and speeds it up, a press kicks it and sends a pink ring out, an orange keyline draws round the plate, and the ON / OFF read-out slides. `aria-pressed` means sound is on. The `M` key does the same.

**Menu** (`site-nav.tsx`, Radix Dialog). It covers the whole screen. Opening: an ink sheet sweeps down while the paper wipes in, then the five titles rise out of masks one by one. The titles are big, centred and slanted. Hover or keyboard focus on a title:

- The page colour blooms from the pointer behind the menu (tints in `menu-pairs.ts`).
- An ink plate wipes in behind the title and the text turns white.
- The other titles fade back.
- Two aspirants appear either side of the title, art only, no names. They drift a little with the pointer.

The pairs: Home is Fanny (left) and Layla (right), Experience is Angela and Ruby, Story is Chang'e and Lesley, Characters is Guinevere and Vexana, Collection is Selena and Obsidia. Left art faces right, right art faces left.

**Portrait art** (`scripts/menu/build.py`, output `public/img/menu/<slug>.webp`). The source busts differ in crop and scale, so the script scales each one until the eye-to-chin distance is the same and places the eye at the same height on a fixed canvas. All ten figures end up the same size and both eyes of a pair sit on one line, which is also the centre line of the title. The eye and chin points are measured by hand on the sources and stored in the script. In the source folder `vexana-left.png` is Selena. Rebuild with `python -I scripts/menu/build.py "<source folder>"`.

On narrow or tall screens nothing hovers and the title fills the width, so the pair of the current page stands at the bottom of the menu instead. The art is warmed after the site opens (it is not in the loading bar, because the menu is not first paint).

## Video player

`components/video-player/`. One custom player for the whole site. A `VideoCard` is the thumbnail: a chamfered plate with the poster, a crystal play button and a tag. A video never starts by itself. A click grows the player out of the thumbnail until it fills the page (not the display). The poster then melts into the first frame with a soft diagonal wipe (no snap), and the video plays. Closing does the same backwards: the poster wipes back over the picture, then the player shrinks into the thumbnail.

- **Picture.** The video is as wide as the window and never taller than it (width matched, no zoom). Any space left above and below is black.
- **Cursor.** The system cursor is replaced inside the player. It takes the shape of what a click will do. The middle half of the screen (25 to 75 percent of the width) is a white disc with Play or Pause. The outer quarter on each side is a pink rounded square with Leave, and a click closes the player. Near the timeline the cursor snaps onto the track, becomes a bigger orange diamond with a ring, follows the pointer along the track and shows the time above it; a click there seeks. Over buttons it is a small dot, and while the video buffers an ink disc with bouncing bars. The cursor glides to each position and morphs with a spring. When the controls hide while it plays, the cursor hides with them and comes back when the pointer moves. Touch screens have no cursor: a tap plays or pauses.
- **Controls.** Play and pause, back and forward 10 seconds, volume (the slider slides out on hover), time, quality, captions when there is a track. The timeline has a buffered range, drag to scrub and arrow keys. A pulse in the middle confirms play and pause. Keys: Space or K, J and L (10 s), arrows (5 s and volume), M, C, 0 to 9, Home, End, Esc. There is no close button; Esc and the Leave zones close it.
- **Quality.** Auto (the default), then each size the video exists in. Auto picks the smallest size that is sharp enough for the picture as it appears on this screen in device pixels, one step down under 1.5 Mbit/s. Changing size carries on from the same moment.
- **Loading.** A hexagon plate draws itself in the middle while the video buffers or seeks.
- **Sound.** The video's sound is on whenever the site sound is on, and follows the sound button and the M key. Only the volume is remembered. While the player is open nothing else makes a sound: the page's music and any voice line stop, and the music carries on when the player closes.
- **Use.** `<VideoCard video={{ sources: [{ label, height, src }], poster, title, captions? }} duration tag className />`. Colours come from `--card-edge-colour`, `--card-accent-colour` and `--card-play-colour`. Today it is used on Selena's page. The collection cinema still has its own player.

## Selena's page

`features/character/selena/`. The page is one picture that does not scroll. It has nothing from the other character pages (no profile, voice wall or gallery).

**The videos** come from the Live2D recordings in `C:/Users/muham/Videos/selena` (3840x1728, 60 fps). `scripts/selena/build.py` cuts and encodes them into `public/video/selena/<tier>/` in three sizes and writes `timeline.generated.ts` (frame numbers, phases and byte sizes). All tiers are H.264, so every browser plays them (H.265 gave no saving here).

| Tier | Size      | Total  | For                            |
| ---- | --------- | ------ | ------------------------------ |
| 1080 | 1920x864  | 83 MB  | phones, tablets, small windows |
| 1440 | 2560x1152 | 115 MB | full HD and QHD screens        |
| 2160 | 3840x1728 | 175 MB | 4K and retina screens          |

The page picks the tier from the display (`pickTier` in `media.ts`): the picture covers the screen, so the video must be as wide as it appears in device pixels (82 percent is enough). Touch devices stop at 1440, and low memory or data saving gives 1080. The visitor loads one tier only.

The cuts, in frames at 60 fps:

| Video     | Cut                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `welcome` | Frames 86 to 1034 of `welcome.mkv`. The recording opens on the game's hero-select screen, and the animation starts with a hard cut between 85 and 86. At frame 1034 the animation has settled into the idle pose and the game UI has not started to fade in (it does from about 1036). That frame matches idle frame 1470. The last 6 frames dissolve into idle frames 1465 to 1470, and 3 more idle frames follow. |
| `idle`    | Idle frames 1471 to 1956, 486 frames, 8.1 s. That is the shortest true cycle: the pose repeats every 162 frames, but only the 486 frame cycle also repeats the hair and the drifting debris (mse 14 against 50). The loop starts on the frame that follows the welcome cut. The last 20 frames dissolve into the 20 before the start, so the wrap is hidden.                                                        |
| Pages     | About, Skills, Gallery and Others are four more poses, each cut in three. `in`: from 36 frames before the action to the loop start (plus 3 frames). `loop`: one cycle of the page's own animation, 486 frames for Skills and Gallery and 240 for About and Others, dissolved at the seam. `out`: from the last frame that still matches the loop to about a second after the idle resumes.                          |
| Shorts    | `short-1`, `short-2` and `short-3`: from 36 frames before the action to about a second after it ends.                                                                                                                                                                                                                                                                                                               |

Mapping: About is `phone-empty`, Skills is `horizontal`, Gallery is `vertical`, Others is `phone-messages`. `startPhases` are the idle loop frames an entrance can start at (3, 162 frames apart). `endPhase` is the idle loop frame the idle resumes at. The About and Others recordings and `short-1`, `short-2` and `short-3` were made with the pointer elsewhere, so their idle pose differs a little from the idle loop. They dissolve over 420 ms, the others over 140 ms.

**The director** (`director.ts`, no React) puts one video on top at a time. welcome to idle: when the welcome is 6 frames from its end. Idle to entrance (or short): the visitor presses a button, the scene waits (the button shows moving bars) until the idle loop reaches a frame it can start at, and starts 3 frames early to cover the play latency. Entrance to page loop: 6 frames before the entrance ends, and the page loop plays until the visitor presses Back. Leaving: the page loop waits for the frame its exit starts on, the exit plays, and the idle loop resumes 6 frames before the frame that matches the exit's last. Frame maths is in `phase.ts`. Everything is covered by unit tests with fake video elements.

**Loading.** Every video of the chosen tier is fetched whole into memory (`lib/media-store.ts`) by the loading bar, which reports the bytes received, so nothing waits on the network once the page is open and swaps never stall. Items may take up to two minutes before the site goes on without them. The music and the album art are in the bar too. The memory is freed when the page is left. The curtain also waits for the stage (`expectReady("selena-stage")`), and the welcome starts only after the page transition has finished.

**The page.** The welcome plays once, with a Skip button. Skip covers the whole screen with a slanted wipe (gold, then violet), jumps to the idle loop under it and uncovers. Random Animation, under the trailer, is only a button, not a page: it plays `short-1`, `short-2` and `short-3` in turn and repeats. The button shows moving bars while the short waits for its frame (a second press cancels), the panel steps aside while the short plays, and it comes back when the short ends. Esc leaves a short early under the same cover wipe. A page opened from the four buttons shows only Back, which plays its exit. Esc backs out one step. The Next button (bottom left, top right on phones) and the N key go to the next character. Reduced motion: no welcome, the idle loop stays on its first frame, pages show their first frame and no video loops. If a video cannot play (no codec) the still image stays and the buttons still work.

**The music.** `public/audio/music/silverbolt-raiko.m4a` plays and loops from the welcome until the page is left, through the audio engine, so the sound button silences it. The nav shows a record beside the sound button (`components/nav/now-playing.tsx`): a small vinyl with the album art on its label, spinning while the music plays, a tone arm that lowers onto it, the song "Silverbolt Raiko" and the artist "Mobile Legends: Bang Bang". A click pauses or resumes the music. The music steps back to a tenth of its level while a clip with its own sound plays, and stops while the video player is open. Any page can show a track with `startMusic` from `lib/now-playing.ts`.

**The look.** The buttons and the trailer card take their look from the picture: white armour plates, violet edges, the crimson crystal of her horns, gold trim, slanted type. On hover the plate turns deep violet, the crystal grows and a light sweeps across. A queued button turns crimson. The buttons sit in the empty top right of the picture, the trailer and Random Animation in the empty top left. On phones the picture is cropped to her and the buttons sit along the bottom in two rows.

### The About page

`features/character/selena/about/`. Pressing About plays the entrance, then two drawers slide in over the page loop: the profile from the left and the story from the right. She stays visible in the middle (each drawer is 28 percent of the width, 21 to 30 rem). Each drawer scrolls on its own, and a tab on its inner edge folds it away (the tab stays, flush with the screen edge). Back slides them away and plays the exit. On a narrow or tall screen they become one sheet at the bottom with Profile and Story tabs, so the top of the picture stays clear.

**Profile** (`profile-data.ts`), written like a resume: a picture with a Normal and Mecha switch (it changes the picture only, nothing else), name, Japanese name, aspirant title, a short summary, at a glance (age 19, birthday June 18, MBTI ENTP, species, occupation, side job, home, weapon), skills, experience, likes and dislikes, family and ties, projects, her two forms, personality and two voice lines: the normal form speaks line 1 and the Ender form line 19, each with the Japanese words and the English translation. The picture is the two halves of the concept sheet (`scripts/selena/about-assets.py` crops it). The source is small (484 px) and carries a "For survey only" watermark, so it shows small.

**Story** (`story-data.ts`), 21 sections from the storm at Hollin Reach to the lamp on the bell tower, in plain English and in time order. It is written from the novel text (each section links to the chapters it comes from) and the official trailers. Nothing is added, and how the duel with Obsidia ends is left open. Names in the text open a tooltip (`{{entity-id|words}}` markup, backed by the glossary in `content/entities.ts`, with a link to the character's page where there is one). A numbered index along the top jumps between sections. There are 15 pictures, each a frame from `selena.webm`, `trailer.webm` or `skin-showcase.webm` taken at the moment the text describes (`about-assets.py` lists the timestamps; a test checks that every picture is used and in the loading bar), and 34 voice lines placed where they fit the scene: quotes, dialogue and inner monologue. A voice card shows the Japanese words, the translation and a play button. One line plays at a time.

If a page video cannot play (no codec), the drawers still open over the still picture, and Back returns to the main panel.

### The Skills page

`features/character/selena/skills/`. Pressing Skills plays the entrance and then opens two drawers over the page loop, built on the same shell as About (`about/drawer-shell.tsx`: slide in from each side, fold tabs, one sheet with two tabs on narrow screens). She stays visible between them.

**Left: the skills** (`skills-data.ts`). The wording is ours and the numbers are from the Mobile Legends: Bang Bang wiki page for Selena. They are game rules, not story, and the page says so. A header with role (Assassin and Mage), specialty (Initiator and Finisher), lane, resource, damage type and the four ratings (durability 4, offense 7, control effects 10, difficulty 8). A switch between Elven Form and Abyssal Form. Each form lists its skills as cards with the icon from `media/others/skills-icon`, the slot, the name and tags. A card opens to the full text, a level table (cooldown, mana, damage, shield, speed and Magic Power bonus by level) and notes. The passive Symbiosis is in both forms. Under the list: how the forms work together (each ultimate resets the other form's skills).

| Form    | Skill 1      | Skill 2       | Ultimate                                |
| ------- | ------------ | ------------- | --------------------------------------- |
| Elven   | Abyssal Trap | Abyssal Arrow | Primal Darkness (to Abyssal)            |
| Abyssal | Soul Eater   | Garotte       | Blessing of the Moon Goddess (to Elven) |

**Right: the demonstration.** The clip of the chosen skill loops quietly at the top and stays there while the list under it scrolls. A button opens the same clip in the custom player, with sound, full page. Under it: four more clips from the skin showcase (the skin opening, Silverbolt in flight, the idle animation, the interactive animation) and a chip for every skill clip.

**The clips** are cut from `skin-showcase.webm` by `scripts/selena/skills-assets.py`, which also copies the icons and writes `clips.generated.ts`. Only Selena is shown. The showcase has Obsidia's skin too, and its idle and interactive parts are split screen with Obsidia on the left, so those two are cropped to Selena's half (and the label bar is cropped off). The skill times came from reading the skill bar on screen, which lights the skill being cast, and from frame differences to find the cuts. All clips are 1080p H.264 with sound, 29 MB in all, loaded into memory by the loading bar like the rest of the page.

| Clip            | Time in the showcase | Shows                                |
| --------------- | -------------------- | ------------------------------------ |
| trap            | 56.5 to 63.6 s       | Elven Skill 1                        |
| soul-eater      | 63.7 to 67.3 s       | Abyssal Skill 1                      |
| arrow           | 67.4 to 73.9 s       | Elven Skill 2                        |
| garotte         | 73.9 to 76.65 s      | Abyssal Skill 2                      |
| primal-darkness | 76.7 to 79.9 s       | Elven ultimate                       |
| moon-goddess    | 81.6 to 83.45 s      | Abyssal ultimate                     |
| skin-intro      | 5.37 to 11.1 s       | The skin's opening cinematic         |
| skin-flight     | 49.2 to 53.9 s       | The flying scene                     |
| idle            | 84.1 to 101.9 s      | Idle animation, Selena's half        |
| interactive     | 102.0 to 108.4 s     | Interactive animation, Selena's half |

The showcase is edited, so the form changes between some demonstrations are cut and not shown. The passive has nothing to cast, so it shows the skin opening and says why.
